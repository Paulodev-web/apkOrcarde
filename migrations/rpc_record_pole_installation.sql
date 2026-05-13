-- Migration: rpc_record_pole_installation
-- Bloco 3 — Marcacao de postes no PDF
-- Convencoes: docs/apk-contracts/13-rpc-conventions.md
-- Aplicada via Supabase MCP em 2026-05-12 (version 20260512051628)
--
-- Esta RPC registra um poste instalado em campo com N midias em transacao atomica.
-- Idempotencia FORTE: client_event_id e NOT NULL UNIQUE (nao parcial).
-- Se duplicado, retorna registro existente sem erro.

CREATE OR REPLACE FUNCTION rpc_record_pole_installation(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id             UUID;
  v_installation_id     UUID;
  v_created_by          UUID;
  v_x_coord             NUMERIC;
  v_y_coord             NUMERIC;
  v_gps_lat             NUMERIC;
  v_gps_lng             NUMERIC;
  v_gps_accuracy        NUMERIC;
  v_numbering           TEXT;
  v_pole_type           TEXT;
  v_notes               TEXT;
  v_installed_at        TIMESTAMPTZ;
  v_client_event_id     TEXT;
  v_media               JSONB;
  v_is_new              BOOLEAN := TRUE;
  v_result_id           UUID;
  v_att                 JSONB;
BEGIN
  -- 1. Parse input
  v_work_id           := (input->>'work_id')::UUID;
  v_installation_id   := (input->>'installation_id')::UUID;
  v_created_by        := auth.uid();
  v_x_coord           := (input->>'x_coord')::NUMERIC;
  v_y_coord           := (input->>'y_coord')::NUMERIC;
  v_gps_lat           := (input->>'gps_lat')::NUMERIC;
  v_gps_lng           := (input->>'gps_lng')::NUMERIC;
  v_gps_accuracy      := (input->>'gps_accuracy_meters')::NUMERIC;
  v_numbering         := input->>'numbering';
  v_pole_type         := input->>'pole_type';
  v_notes             := input->>'notes';
  v_installed_at      := COALESCE((input->>'installed_at')::TIMESTAMPTZ, now());
  v_client_event_id   := input->>'client_event_id';
  v_media             := COALESCE(input->'media', '[]'::JSONB);

  IF v_installation_id IS NULL THEN
    v_installation_id := gen_random_uuid();
  END IF;

  -- 2. Validar campos obrigatorios
  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_client_event_id IS NULL OR v_client_event_id = '' THEN
    RAISE EXCEPTION 'client_event_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_x_coord IS NULL OR v_y_coord IS NULL THEN
    RAISE EXCEPTION 'x_coord e y_coord sao obrigatorios' USING errcode = 'P0001';
  END IF;

  -- 3. Validar ranges
  IF v_x_coord < 0 OR v_x_coord > 6000 THEN
    RAISE EXCEPTION 'x_coord deve estar entre 0 e 6000 (recebido: %)', v_x_coord
      USING errcode = 'P0001';
  END IF;

  IF v_y_coord < 0 OR v_y_coord > 6000 THEN
    RAISE EXCEPTION 'y_coord deve estar entre 0 e 6000 (recebido: %)', v_y_coord
      USING errcode = 'P0001';
  END IF;

  IF v_gps_lat IS NOT NULL AND (v_gps_lat < -90 OR v_gps_lat > 90) THEN
    RAISE EXCEPTION 'gps_lat deve estar entre -90 e 90' USING errcode = 'P0001';
  END IF;

  IF v_gps_lng IS NOT NULL AND (v_gps_lng < -180 OR v_gps_lng > 180) THEN
    RAISE EXCEPTION 'gps_lng deve estar entre -180 e 180' USING errcode = 'P0001';
  END IF;

  IF v_notes IS NOT NULL AND length(v_notes) > 1000 THEN
    RAISE EXCEPTION 'notes nao pode exceder 1000 caracteres' USING errcode = 'P0001';
  END IF;

  -- 4. Validar membership
  PERFORM 1 FROM work_members
    WHERE work_id = v_work_id
      AND user_id = v_created_by;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  -- 5. Insert com idempotencia forte (client_event_id NOT NULL UNIQUE)
  INSERT INTO work_pole_installations (
    id,
    work_id,
    created_by,
    x_coord,
    y_coord,
    gps_lat,
    gps_lng,
    gps_accuracy_meters,
    numbering,
    pole_type,
    notes,
    installed_at,
    client_event_id
  ) VALUES (
    v_installation_id,
    v_work_id,
    v_created_by,
    v_x_coord,
    v_y_coord,
    v_gps_lat,
    v_gps_lng,
    v_gps_accuracy,
    v_numbering,
    v_pole_type,
    v_notes,
    v_installed_at,
    v_client_event_id::UUID
  )
  ON CONFLICT (client_event_id) DO NOTHING
  RETURNING id INTO v_result_id;

  -- 6. Se nao inseriu: buscar existente
  IF v_result_id IS NULL THEN
    SELECT id INTO v_result_id
      FROM work_pole_installations
      WHERE client_event_id = v_client_event_id::UUID;

    v_is_new := FALSE;
  END IF;

  -- 7. Se inseriu: criar midias
  IF v_is_new AND jsonb_array_length(v_media) > 0 THEN
    FOR v_att IN SELECT * FROM jsonb_array_elements(v_media)
    LOOP
      INSERT INTO work_pole_installation_media (
        id,
        installation_id,
        work_id,
        kind,
        storage_path,
        mime_type,
        size_bytes,
        width,
        height,
        duration_seconds,
        is_primary
      ) VALUES (
        COALESCE((v_att->>'id')::UUID, gen_random_uuid()),
        v_result_id,
        v_work_id,
        v_att->>'kind',
        v_att->>'storage_path',
        v_att->>'mime_type',
        (v_att->>'file_size_bytes')::BIGINT,
        (v_att->>'width')::INTEGER,
        (v_att->>'height')::INTEGER,
        (v_att->>'duration_seconds')::NUMERIC,
        COALESCE((v_att->>'is_primary')::BOOLEAN, FALSE)
      );
    END LOOP;
  END IF;

  -- 8. Atualizar last_activity_at da obra
  IF v_is_new THEN
    UPDATE works
      SET last_activity_at = now()
      WHERE id = v_work_id;
  END IF;

  -- 9. Retorno
  RETURN jsonb_build_object(
    'installationId', v_result_id,
    'isNew', v_is_new
  );
END;
$$;

-- Permissoes
REVOKE EXECUTE ON FUNCTION rpc_record_pole_installation FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rpc_record_pole_installation TO authenticated;

-- Comentario
COMMENT ON FUNCTION rpc_record_pole_installation IS
  'Registra poste instalado em campo com midias. '
  'Idempotente (forte) por client_event_id NOT NULL UNIQUE. '
  'Coordenadas no quadro logico 6000x6000. GPS opcional. '
  'APK Bloco 3 — v1.0.0';
