-- Migration: rpc_open_alert
-- Bloco 7 — Alertas
-- Aplicar no Supabase Dashboard > SQL Editor do projeto dev

CREATE OR REPLACE FUNCTION rpc_open_alert(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id           UUID;
  v_alert_id          UUID;
  v_created_by        UUID;
  v_severity          TEXT;
  v_category          TEXT;
  v_title             TEXT;
  v_description       TEXT;
  v_gps_lat           NUMERIC;
  v_gps_lng           NUMERIC;
  v_gps_accuracy      NUMERIC;
  v_client_event_id   TEXT;
  v_media             JSONB;
  v_is_new            BOOLEAN := TRUE;
  v_result_id         UUID;
  v_att               JSONB;
BEGIN
  -- 1. Parse
  v_work_id         := (input->>'work_id')::UUID;
  v_alert_id        := COALESCE((input->>'alert_id')::UUID, gen_random_uuid());
  v_created_by      := auth.uid();
  v_severity        := input->>'severity';
  v_category        := input->>'category';
  v_title           := input->>'title';
  v_description     := input->>'description';
  v_gps_lat         := (input->>'gps_lat')::NUMERIC;
  v_gps_lng         := (input->>'gps_lng')::NUMERIC;
  v_gps_accuracy    := (input->>'gps_accuracy_meters')::NUMERIC;
  v_client_event_id := input->>'client_event_id';
  v_media           := COALESCE(input->'media', '[]'::JSONB);

  -- 2. Validar obrigatorios
  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id e obrigatorio' USING errcode = 'P0001';
  END IF;
  IF v_client_event_id IS NULL OR v_client_event_id = '' THEN
    RAISE EXCEPTION 'client_event_id e obrigatorio' USING errcode = 'P0001';
  END IF;
  IF v_severity IS NULL OR v_severity NOT IN ('low','medium','high','critical') THEN
    RAISE EXCEPTION 'severity invalido (deve ser low/medium/high/critical)' USING errcode = 'P0001';
  END IF;
  IF v_category IS NULL OR v_category NOT IN ('accident','material_shortage','safety','equipment','weather','other') THEN
    RAISE EXCEPTION 'category invalido' USING errcode = 'P0001';
  END IF;
  IF v_title IS NULL OR length(v_title) < 5 OR length(v_title) > 200 THEN
    RAISE EXCEPTION 'title deve ter entre 5 e 200 caracteres' USING errcode = 'P0001';
  END IF;
  IF v_description IS NULL OR length(v_description) < 10 OR length(v_description) > 2000 THEN
    RAISE EXCEPTION 'description deve ter entre 10 e 2000 caracteres' USING errcode = 'P0001';
  END IF;

  -- GPS bounds (se fornecido)
  IF v_gps_lat IS NOT NULL AND (v_gps_lat < -90 OR v_gps_lat > 90) THEN
    RAISE EXCEPTION 'gps_lat fora do range' USING errcode = 'P0001';
  END IF;
  IF v_gps_lng IS NOT NULL AND (v_gps_lng < -180 OR v_gps_lng > 180) THEN
    RAISE EXCEPTION 'gps_lng fora do range' USING errcode = 'P0001';
  END IF;

  -- 3. Membership
  PERFORM 1 FROM work_members WHERE work_id = v_work_id AND user_id = v_created_by;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  -- 4. Insert alerta com idempotencia forte
  INSERT INTO work_alerts (
    id, work_id, created_by, severity, category, title, description,
    gps_lat, gps_lng, gps_accuracy_meters, client_event_id
  ) VALUES (
    v_alert_id, v_work_id, v_created_by, v_severity, v_category, v_title, v_description,
    v_gps_lat, v_gps_lng, v_gps_accuracy, v_client_event_id
  )
  ON CONFLICT (client_event_id) DO NOTHING
  RETURNING id INTO v_result_id;

  -- 5. Idempotencia: buscar existente
  IF v_result_id IS NULL THEN
    SELECT id INTO v_result_id FROM work_alerts WHERE client_event_id = v_client_event_id;
    v_is_new := FALSE;
  END IF;

  -- 6. Se novo: midias + update 'opened'
  IF v_is_new THEN
    IF jsonb_array_length(v_media) > 0 THEN
      FOR v_att IN SELECT * FROM jsonb_array_elements(v_media)
      LOOP
        INSERT INTO work_alert_media (
          id, alert_id, work_id, kind, storage_path, mime_type,
          size_bytes, width, height, duration_seconds
        ) VALUES (
          COALESCE((v_att->>'id')::UUID, gen_random_uuid()),
          v_result_id, v_work_id,
          v_att->>'kind', v_att->>'storage_path', v_att->>'mime_type',
          (v_att->>'file_size_bytes')::INTEGER,
          (v_att->>'width')::INTEGER, (v_att->>'height')::INTEGER,
          (v_att->>'duration_seconds')::NUMERIC
        );
      END LOOP;
    END IF;

    -- Update entry 'opened'
    INSERT INTO work_alert_updates (
      alert_id, work_id, actor_id, actor_role, update_type, notes
    ) VALUES (
      v_result_id, v_work_id, v_created_by, 'manager', 'opened', NULL
    );

    UPDATE works SET last_activity_at = now() WHERE id = v_work_id;
  END IF;

  RETURN jsonb_build_object('alertId', v_result_id, 'isNew', v_is_new);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_open_alert FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rpc_open_alert TO authenticated;

COMMENT ON FUNCTION rpc_open_alert IS
  'Abre alerta de emergencia. Idempotente (forte) por client_event_id. APK Bloco 7.';