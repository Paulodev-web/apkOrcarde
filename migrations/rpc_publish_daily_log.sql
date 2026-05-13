-- Migration: rpc_publish_daily_log
-- Bloco 4 — Diario de obra
-- Convencoes: docs/apk-contracts/13-rpc-conventions.md
-- Aplicar no Supabase Dashboard > SQL Editor do projeto dev (ubqyjbtjkzxlexbuxoum)
--
-- Esta RPC publica um diario de obra (primeira publicacao OU republicacao apos rejeicao).
-- Logica:
--   - Se nao existe daily_log para (work_id, log_date): cria log + revision + medias
--   - Se existe com status='rejected': cria nova revision + medias, muda status -> pending_approval
--   - Se existe com status='pending_approval' ou 'approved': rejeita (ja publicado)
-- Idempotencia: client_event_id na REVISION (nao no daily_log).
-- FK ciclica: current_revision_id usa SET CONSTRAINTS DEFERRED.

CREATE OR REPLACE FUNCTION rpc_publish_daily_log(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id             UUID;
  v_log_date            DATE;
  v_published_by        UUID;
  v_daily_log_id        UUID;
  v_provided_log_id     UUID;
  v_revision_id         UUID;
  v_client_event_id     TEXT;
  v_crew_present        JSONB;
  v_activities          TEXT;
  v_posts_installed     INTEGER;
  v_meters_installed    JSONB;
  v_materials_consumed  JSONB;
  v_incidents           TEXT;
  v_rejection_reason    TEXT;
  v_media               JSONB;
  v_revision_number     INTEGER;
  v_existing_status     TEXT;
  v_is_new_log          BOOLEAN := FALSE;
  v_is_new_revision     BOOLEAN := TRUE;
  v_att                 JSONB;
BEGIN
  -- ---------------------------------------------------------------
  -- 0. Defer cyclic FK constraint
  -- ---------------------------------------------------------------
  SET CONSTRAINTS ALL DEFERRED;

  -- ---------------------------------------------------------------
  -- 1. Parse input
  -- ---------------------------------------------------------------
  v_work_id           := (input->>'work_id')::UUID;
  v_log_date          := (input->>'log_date')::DATE;
  v_provided_log_id   := (input->>'daily_log_id')::UUID;
  v_published_by      := auth.uid();
  v_client_event_id   := input->>'client_event_id';
  v_crew_present      := input->'crew_present';
  v_activities        := input->>'activities';
  v_posts_installed   := COALESCE((input->>'posts_installed_count')::INTEGER, 0);
  v_meters_installed  := input->'meters_installed';
  v_materials_consumed := input->'materials_consumed';
  v_incidents         := input->>'incidents';
  v_rejection_reason  := input->>'rejection_reason';
  v_media             := COALESCE(input->'media', '[]'::JSONB);

  -- ---------------------------------------------------------------
  -- 2. Validar campos obrigatorios
  -- ---------------------------------------------------------------
  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_log_date IS NULL THEN
    RAISE EXCEPTION 'log_date e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_client_event_id IS NULL OR v_client_event_id = '' THEN
    RAISE EXCEPTION 'client_event_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_activities IS NULL OR length(v_activities) < 10 THEN
    RAISE EXCEPTION 'activities deve ter pelo menos 10 caracteres' USING errcode = 'P0001';
  END IF;

  IF length(v_activities) > 4000 THEN
    RAISE EXCEPTION 'activities nao pode exceder 4000 caracteres' USING errcode = 'P0001';
  END IF;

  IF v_crew_present IS NULL OR jsonb_array_length(v_crew_present) = 0 THEN
    RAISE EXCEPTION 'crew_present deve ter pelo menos 1 membro' USING errcode = 'P0001';
  END IF;

  -- ---------------------------------------------------------------
  -- 3. Validar membership
  -- ---------------------------------------------------------------
  PERFORM 1 FROM work_members
    WHERE work_id = v_work_id
      AND user_id = v_published_by;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  -- ---------------------------------------------------------------
  -- 4. Checar idempotencia da revision ANTES de tudo
  -- ---------------------------------------------------------------
  SELECT r.id, r.daily_log_id, r.revision_number
    INTO v_revision_id, v_daily_log_id, v_revision_number
    FROM work_daily_log_revisions r
    WHERE r.client_event_id = v_client_event_id;

  IF FOUND THEN
    -- Revision ja existe (retry idempotente)
    v_is_new_revision := FALSE;
    RETURN jsonb_build_object(
      'dailyLogId', v_daily_log_id,
      'revisionId', v_revision_id,
      'revisionNumber', v_revision_number,
      'isNew', FALSE
    );
  END IF;

  -- ---------------------------------------------------------------
  -- 5. Buscar daily_log existente para (work_id, log_date)
  -- ---------------------------------------------------------------
  SELECT id, status
    INTO v_daily_log_id, v_existing_status
    FROM work_daily_logs
    WHERE work_id = v_work_id
      AND log_date = v_log_date;

  IF FOUND THEN
    -- Daily log existe. Verificar se pode publicar.
    IF v_existing_status = 'pending_approval' THEN
      RAISE EXCEPTION 'Diario desta data ja esta aguardando aprovacao'
        USING errcode = 'P0001';
    END IF;

    IF v_existing_status = 'approved' THEN
      RAISE EXCEPTION 'Diario desta data ja foi aprovado'
        USING errcode = 'P0001';
    END IF;

    -- status = 'rejected' → republicacao permitida
    v_is_new_log := FALSE;
  ELSE
    -- Nao existe → criar novo daily_log
    v_is_new_log := TRUE;
    v_daily_log_id := COALESCE(v_provided_log_id, gen_random_uuid());

    INSERT INTO work_daily_logs (id, work_id, log_date, published_by, status)
    VALUES (v_daily_log_id, v_work_id, v_log_date, v_published_by, 'pending_approval');
  END IF;

  -- ---------------------------------------------------------------
  -- 6. Calcular proximo revision_number
  -- ---------------------------------------------------------------
  SELECT COALESCE(MAX(revision_number), 0) + 1
    INTO v_revision_number
    FROM work_daily_log_revisions
    WHERE daily_log_id = v_daily_log_id;

  -- ---------------------------------------------------------------
  -- 7. Usar revision_id do cliente (para storage paths) ou gerar
  -- ---------------------------------------------------------------
  v_revision_id := COALESCE((input->>'revision_id')::UUID, gen_random_uuid());

  -- ---------------------------------------------------------------
  -- 8. Inserir revision (imutavel)
  -- ---------------------------------------------------------------
  INSERT INTO work_daily_log_revisions (
    id,
    daily_log_id,
    revision_number,
    crew_present,
    activities,
    posts_installed_count,
    meters_installed,
    materials_consumed,
    incidents,
    rejection_reason,
    client_event_id
  ) VALUES (
    v_revision_id,
    v_daily_log_id,
    v_revision_number,
    v_crew_present,
    v_activities,
    v_posts_installed,
    v_meters_installed,
    v_materials_consumed,
    v_incidents,
    v_rejection_reason,
    v_client_event_id
  );

  -- ---------------------------------------------------------------
  -- 9. Inserir medias da revision
  -- ---------------------------------------------------------------
  IF jsonb_array_length(v_media) > 0 THEN
    FOR v_att IN SELECT * FROM jsonb_array_elements(v_media)
    LOOP
      INSERT INTO work_daily_log_media (
        id,
        revision_id,
        daily_log_id,
        work_id,
        kind,
        storage_path,
        mime_type,
        size_bytes,
        width,
        height,
        duration_seconds
      ) VALUES (
        COALESCE((v_att->>'id')::UUID, gen_random_uuid()),
        v_revision_id,
        v_daily_log_id,
        v_work_id,
        v_att->>'kind',
        v_att->>'storage_path',
        v_att->>'mime_type',
        (v_att->>'file_size_bytes')::INTEGER,
        (v_att->>'width')::INTEGER,
        (v_att->>'height')::INTEGER,
        (v_att->>'duration_seconds')::NUMERIC
      );
    END LOOP;
  END IF;

  -- ---------------------------------------------------------------
  -- 10. Atualizar daily_log: current_revision_id + status
  -- ---------------------------------------------------------------
  IF v_is_new_log THEN
    -- Novo: apenas setar current_revision_id
    UPDATE work_daily_logs
      SET current_revision_id = v_revision_id
      WHERE id = v_daily_log_id;
  ELSE
    -- Republicacao: mudar status rejected → pending_approval + atualizar revision
    UPDATE work_daily_logs
      SET current_revision_id = v_revision_id,
          status = 'pending_approval',
          rejected_at = NULL
      WHERE id = v_daily_log_id;
  END IF;

  -- ---------------------------------------------------------------
  -- 11. Atualizar last_activity_at da obra
  -- ---------------------------------------------------------------
  UPDATE works
    SET last_activity_at = now()
    WHERE id = v_work_id;

  -- ---------------------------------------------------------------
  -- 12. Retorno
  -- ---------------------------------------------------------------
  RETURN jsonb_build_object(
    'dailyLogId', v_daily_log_id,
    'revisionId', v_revision_id,
    'revisionNumber', v_revision_number,
    'isNew', TRUE
  );
END;
$$;

-- ---------------------------------------------------------------
-- Permissoes
-- ---------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION rpc_publish_daily_log FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rpc_publish_daily_log TO authenticated;

-- ---------------------------------------------------------------
-- Comentario
-- ---------------------------------------------------------------
COMMENT ON FUNCTION rpc_publish_daily_log IS
  'Publica diario de obra (nova publicacao ou republicacao apos rejeicao). '
  'Cria daily_log + revision + medias em transacao atomica. '
  'Idempotente por client_event_id na revision. '
  'FK ciclica current_revision_id tratada com SET CONSTRAINTS DEFERRED. '
  'APK Bloco 4 — v1.0.0';