-- Migration: rpc_mark_checklist_item
-- Bloco 5+6 — Marcos + Checklists
-- Convencoes: docs/apk-contracts/13-rpc-conventions.md
-- Aplicar no Supabase Dashboard > SQL Editor do projeto dev (ubqyjbtjkzxlexbuxoum)
--
-- Esta RPC marca/desmarca um item de checklist com notas e foto opcional.
-- Idempotencia: se client_event_id ja esta no item, nao faz nada.
-- Trigger on_checklist_item_marked auto-completa checklist se todos done.

CREATE OR REPLACE FUNCTION rpc_mark_checklist_item(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id           UUID;
  v_checklist_id      UUID;
  v_item_id           UUID;
  v_is_completed      BOOLEAN;
  v_notes             TEXT;
  v_client_event_id   TEXT;
  v_media             JSONB;
  v_actor_id          UUID;
  v_is_new            BOOLEAN := TRUE;
  v_existing_cev      TEXT;
  v_checklist_status  TEXT;
  v_requires_photo    BOOLEAN;
  v_att               JSONB;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. Parse input
  -- ---------------------------------------------------------------
  v_work_id         := (input->>'work_id')::UUID;
  v_checklist_id    := (input->>'checklist_id')::UUID;
  v_item_id         := (input->>'item_id')::UUID;
  v_is_completed    := COALESCE((input->>'is_completed')::BOOLEAN, TRUE);
  v_notes           := input->>'notes';
  v_client_event_id := input->>'client_event_id';
  v_media           := COALESCE(input->'media', '[]'::JSONB);
  v_actor_id        := auth.uid();

  -- ---------------------------------------------------------------
  -- 2. Validar campos obrigatorios
  -- ---------------------------------------------------------------
  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_checklist_id IS NULL THEN
    RAISE EXCEPTION 'checklist_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'item_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_client_event_id IS NULL OR v_client_event_id = '' THEN
    RAISE EXCEPTION 'client_event_id e obrigatorio' USING errcode = 'P0001';
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
  -- 4. Validar que checklist pertence a obra e esta em estado editavel
  -- ---------------------------------------------------------------
  SELECT status INTO v_checklist_status
    FROM work_checklists
    WHERE id = v_checklist_id
      AND work_id = v_work_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist nao encontrado nesta obra' USING errcode = 'P0001';
  END IF;

  -- Permitir marcar itens apenas em in_progress ou returned
  IF v_checklist_status NOT IN ('in_progress', 'returned') THEN
    RAISE EXCEPTION 'Checklist nao esta em estado editavel (status atual: %)', v_checklist_status
      USING errcode = 'P0001';
  END IF;

  -- ---------------------------------------------------------------
  -- 5. Validar que item pertence ao checklist
  -- ---------------------------------------------------------------
  SELECT client_event_id, requires_photo
    INTO v_existing_cev, v_requires_photo
    FROM work_checklist_items
    WHERE id = v_item_id
      AND work_checklist_id = v_checklist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item nao encontrado neste checklist' USING errcode = 'P0001';
  END IF;

  -- ---------------------------------------------------------------
  -- 6. Checar idempotencia: se client_event_id ja esta no item, retorna
  -- ---------------------------------------------------------------
  IF v_existing_cev IS NOT NULL AND v_existing_cev = v_client_event_id THEN
    v_is_new := FALSE;
    RETURN jsonb_build_object(
      'itemId', v_item_id,
      'isNew', FALSE
    );
  END IF;

  -- ---------------------------------------------------------------
  -- 7. Validar foto obrigatoria
  -- ---------------------------------------------------------------
  IF v_is_completed AND v_requires_photo AND jsonb_array_length(v_media) = 0 THEN
    RAISE EXCEPTION 'Este item exige foto para ser concluido' USING errcode = 'P0001';
  END IF;

  -- ---------------------------------------------------------------
  -- 8. Atualizar item
  -- ---------------------------------------------------------------
  UPDATE work_checklist_items
    SET is_completed = v_is_completed,
        completed_at = CASE WHEN v_is_completed THEN now() ELSE NULL END,
        completed_by = CASE WHEN v_is_completed THEN v_actor_id ELSE NULL END,
        notes = v_notes,
        client_event_id = v_client_event_id
    WHERE id = v_item_id;

  -- ---------------------------------------------------------------
  -- 9. Inserir midias (se marcando como completo e tem midias)
  -- ---------------------------------------------------------------
  IF v_is_completed AND jsonb_array_length(v_media) > 0 THEN
    FOR v_att IN SELECT * FROM jsonb_array_elements(v_media)
    LOOP
      INSERT INTO work_checklist_item_media (
        id, item_id, work_checklist_id, work_id, kind, storage_path,
        mime_type, size_bytes, width, height, duration_seconds
      ) VALUES (
        COALESCE((v_att->>'id')::UUID, gen_random_uuid()),
        v_item_id,
        v_checklist_id,
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
  -- 10. Atualizar last_activity_at
  -- ---------------------------------------------------------------
  UPDATE works
    SET last_activity_at = now()
    WHERE id = v_work_id;

  -- ---------------------------------------------------------------
  -- 11. Retorno
  -- Nota: o trigger on_checklist_item_marked no banco cuida do
  -- auto-complete (mover checklist pra awaiting_validation se todos done)
  -- ---------------------------------------------------------------
  RETURN jsonb_build_object(
    'itemId', v_item_id,
    'isNew', TRUE
  );
END;
$$;

-- Permissoes
REVOKE EXECUTE ON FUNCTION rpc_mark_checklist_item FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rpc_mark_checklist_item TO authenticated;

COMMENT ON FUNCTION rpc_mark_checklist_item IS
  'Marca/desmarca item de checklist com notas e foto opcional. '
  'Valida requires_photo. Idempotente por client_event_id no item. '
  'Trigger on_checklist_item_marked auto-completa checklist. '
  'APK Bloco 5+6 — v1.0.0';