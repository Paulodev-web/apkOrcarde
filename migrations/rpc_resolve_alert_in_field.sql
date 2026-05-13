-- Migration: rpc_resolve_alert_in_field
-- Bloco 7 — Alertas
-- Aplicar no Supabase Dashboard > SQL Editor do projeto dev

CREATE OR REPLACE FUNCTION rpc_resolve_alert_in_field(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id           UUID;
  v_alert_id          UUID;
  v_actor_id          UUID;
  v_resolution_notes  TEXT;
  v_client_event_id   TEXT;
  v_media             JSONB;
  v_is_new            BOOLEAN := TRUE;
  v_result_update_id  UUID;
  v_current_status    TEXT;
  v_att               JSONB;
BEGIN
  -- 1. Parse
  v_work_id           := (input->>'work_id')::UUID;
  v_alert_id          := (input->>'alert_id')::UUID;
  v_actor_id          := auth.uid();
  v_resolution_notes  := input->>'resolution_notes';
  v_client_event_id   := input->>'client_event_id';
  v_media             := COALESCE(input->'media', '[]'::JSONB);

  -- 2. Validar
  IF v_work_id IS NULL OR v_alert_id IS NULL THEN
    RAISE EXCEPTION 'work_id e alert_id sao obrigatorios' USING errcode = 'P0001';
  END IF;
  IF v_client_event_id IS NULL OR v_client_event_id = '' THEN
    RAISE EXCEPTION 'client_event_id e obrigatorio' USING errcode = 'P0001';
  END IF;
  IF v_resolution_notes IS NULL OR length(v_resolution_notes) < 5 OR length(v_resolution_notes) > 1000 THEN
    RAISE EXCEPTION 'resolution_notes deve ter entre 5 e 1000 caracteres' USING errcode = 'P0001';
  END IF;

  -- 3. Membership
  PERFORM 1 FROM work_members WHERE work_id = v_work_id AND user_id = v_actor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  -- 4. Validar status do alerta
  SELECT status INTO v_current_status FROM work_alerts WHERE id = v_alert_id AND work_id = v_work_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alerta nao encontrado nesta obra' USING errcode = 'P0001';
  END IF;
  IF v_current_status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'Alerta nao pode ser resolvido no status atual: %', v_current_status
      USING errcode = 'P0001';
  END IF;

  -- 5. Insert update com idempotencia
  INSERT INTO work_alert_updates (
    alert_id, work_id, actor_id, actor_role, update_type, notes, client_event_id
  ) VALUES (
    v_alert_id, v_work_id, v_actor_id, 'manager', 'resolved_in_field', v_resolution_notes, v_client_event_id
  )
  ON CONFLICT (client_event_id) WHERE client_event_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_result_update_id;

  IF v_result_update_id IS NULL THEN
    SELECT id INTO v_result_update_id FROM work_alert_updates WHERE client_event_id = v_client_event_id;
    v_is_new := FALSE;
  END IF;

  -- 6. Se novo: atualizar alerta + midias
  IF v_is_new THEN
    UPDATE work_alerts
      SET status = 'resolved_in_field',
          field_resolution_at = now(),
          field_resolution_notes = v_resolution_notes
      WHERE id = v_alert_id;

    IF jsonb_array_length(v_media) > 0 THEN
      FOR v_att IN SELECT * FROM jsonb_array_elements(v_media)
      LOOP
        INSERT INTO work_alert_media (
          id, alert_id, work_id, kind, storage_path, mime_type,
          size_bytes, width, height, duration_seconds
        ) VALUES (
          COALESCE((v_att->>'id')::UUID, gen_random_uuid()),
          v_alert_id, v_work_id,
          v_att->>'kind', v_att->>'storage_path', v_att->>'mime_type',
          (v_att->>'file_size_bytes')::INTEGER,
          (v_att->>'width')::INTEGER, (v_att->>'height')::INTEGER,
          (v_att->>'duration_seconds')::NUMERIC
        );
      END LOOP;
    END IF;

    UPDATE works SET last_activity_at = now() WHERE id = v_work_id;
  END IF;

  RETURN jsonb_build_object('updateId', v_result_update_id, 'isNew', v_is_new);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_resolve_alert_in_field FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rpc_resolve_alert_in_field TO authenticated;

COMMENT ON FUNCTION rpc_resolve_alert_in_field IS
  'Manager resolve alerta em campo. Idempotente por client_event_id. APK Bloco 7.';