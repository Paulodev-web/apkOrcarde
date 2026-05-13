-- Migration: rpc_report_milestone
-- Bloco 5+6 — Marcos + Checklists
-- Convencoes: docs/apk-contracts/13-rpc-conventions.md
-- Aplicar no Supabase Dashboard > SQL Editor do projeto dev (ubqyjbtjkzxlexbuxoum)
--
-- Esta RPC registra que o manager reportou um marco como concluido.
-- Cria evento 'reported' + midias de evidencia + atualiza status do marco.
-- Idempotencia por client_event_id no evento.

CREATE OR REPLACE FUNCTION rpc_report_milestone(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id           UUID;
  v_milestone_id      UUID;
  v_event_id          UUID;
  v_actor_id          UUID;
  v_notes             TEXT;
  v_client_event_id   TEXT;
  v_media             JSONB;
  v_is_new            BOOLEAN := TRUE;
  v_result_event_id   UUID;
  v_current_status    TEXT;
  v_att               JSONB;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. Parse input
  -- ---------------------------------------------------------------
  v_work_id         := (input->>'work_id')::UUID;
  v_milestone_id    := (input->>'milestone_id')::UUID;
  v_event_id        := COALESCE((input->>'event_id')::UUID, gen_random_uuid());
  v_actor_id        := auth.uid();
  v_notes           := input->>'notes';
  v_client_event_id := input->>'client_event_id';
  v_media           := COALESCE(input->'media', '[]'::JSONB);

  -- ---------------------------------------------------------------
  -- 2. Validar campos obrigatorios
  -- ---------------------------------------------------------------
  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_milestone_id IS NULL THEN
    RAISE EXCEPTION 'milestone_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_client_event_id IS NULL OR v_client_event_id = '' THEN
    RAISE EXCEPTION 'client_event_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_notes IS NOT NULL AND length(v_notes) > 1000 THEN
    RAISE EXCEPTION 'notes nao pode exceder 1000 caracteres' USING errcode = 'P0001';
  END IF;

  -- ---------------------------------------------------------------
  -- 3. Validar membership
  -- ---------------------------------------------------------------
  PERFORM 1 FROM work_members
    WHERE work_id = v_work_id
      AND user_id = v_actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  -- ---------------------------------------------------------------
  -- 4. Validar que marco pertence a obra
  -- ---------------------------------------------------------------
  SELECT status INTO v_current_status
    FROM work_milestones
    WHERE id = v_milestone_id
      AND work_id = v_work_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marco nao encontrado nesta obra' USING errcode = 'P0001';
  END IF;

  -- Validar que status permite report (pending, in_progress, rejected)
  IF v_current_status NOT IN ('pending', 'in_progress', 'rejected') THEN
    RAISE EXCEPTION 'Marco nao pode ser reportado no status atual: %', v_current_status
      USING errcode = 'P0001';
  END IF;

  -- ---------------------------------------------------------------
  -- 5. Insert evento com idempotencia
  -- ---------------------------------------------------------------
  INSERT INTO work_milestone_events (
    id, milestone_id, work_id, event_type, actor_id, actor_role, notes, client_event_id
  ) VALUES (
    v_event_id, v_milestone_id, v_work_id, 'reported', v_actor_id, 'manager', v_notes, v_client_event_id
  )
  ON CONFLICT (client_event_id) WHERE client_event_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_result_event_id;

  -- ---------------------------------------------------------------
  -- 6. Se nao inseriu (idempotencia): buscar existente
  -- ---------------------------------------------------------------
  IF v_result_event_id IS NULL THEN
    SELECT id INTO v_result_event_id
      FROM work_milestone_events
      WHERE client_event_id = v_client_event_id;

    v_is_new := FALSE;
  END IF;

  -- ---------------------------------------------------------------
  -- 7. Se inseriu: criar midias + atualizar marco
  -- ---------------------------------------------------------------
  IF v_is_new THEN
    -- Inserir midias
    IF jsonb_array_length(v_media) > 0 THEN
      FOR v_att IN SELECT * FROM jsonb_array_elements(v_media)
      LOOP
        INSERT INTO work_milestone_event_media (
          id, event_id, work_id, milestone_id, kind, storage_path,
          mime_type, size_bytes, width, height
        ) VALUES (
          COALESCE((v_att->>'id')::UUID, gen_random_uuid()),
          v_result_event_id,
          v_work_id,
          v_milestone_id,
          v_att->>'kind',
          v_att->>'storage_path',
          v_att->>'mime_type',
          (v_att->>'file_size_bytes')::INTEGER,
          (v_att->>'width')::INTEGER,
          (v_att->>'height')::INTEGER
        );
      END LOOP;
    END IF;

    -- Atualizar marco: status → awaiting_approval
    -- O trigger work_milestones_protect_fields valida a transicao
    UPDATE work_milestones
      SET status = 'awaiting_approval',
          reported_by = v_actor_id,
          reported_at = now(),
          notes = COALESCE(v_notes, notes),
          rejection_reason = NULL,
          rejected_at = NULL
      WHERE id = v_milestone_id;

    -- Atualizar last_activity_at
    UPDATE works
      SET last_activity_at = now()
      WHERE id = v_work_id;
  END IF;

  -- ---------------------------------------------------------------
  -- 8. Retorno
  -- ---------------------------------------------------------------
  RETURN jsonb_build_object(
    'eventId', v_result_event_id,
    'isNew', v_is_new
  );
END;
$$;

-- Permissoes
REVOKE EXECUTE ON FUNCTION rpc_report_milestone FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rpc_report_milestone TO authenticated;

COMMENT ON FUNCTION rpc_report_milestone IS
  'Manager reporta marco como concluido (pending/in_progress/rejected → awaiting_approval). '
  'Cria evento reported + midias + atualiza status. '
  'Idempotente por client_event_id. '
  'APK Bloco 5+6 — v1.0.0';