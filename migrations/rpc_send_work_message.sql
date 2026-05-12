-- Migration: rpc_send_work_message
-- Bloco 2 — Chat do APK
-- Convencoes: docs/apk-contracts/13-rpc-conventions.md
-- Aplicar no Supabase Dashboard > SQL Editor do projeto dev (ubqyjbtjkzxlexbuxoum)
--
-- Esta RPC insere uma mensagem de chat com N attachments em transacao atomica.
-- Idempotencia: se client_event_id ja existe, retorna registro existente sem erro.
-- Seguranca: SECURITY DEFINER com validacao de membership explicita.

CREATE OR REPLACE FUNCTION rpc_send_work_message(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id       UUID;
  v_sender_id     UUID;
  v_content       TEXT;
  v_client_event_id TEXT;
  v_attachments   JSONB;
  v_message_id    UUID;
  v_is_new        BOOLEAN := TRUE;
  v_att           JSONB;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. Parse input
  -- ---------------------------------------------------------------
  v_work_id         := (input->>'work_id')::UUID;
  v_sender_id       := auth.uid();
  v_content         := input->>'content';  -- pode ser NULL (mensagem so-midia)
  v_client_event_id := input->>'client_event_id';
  v_attachments     := COALESCE(input->'attachments', '[]'::JSONB);

  -- ---------------------------------------------------------------
  -- 2. Validar campos obrigatorios
  -- ---------------------------------------------------------------
  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_client_event_id IS NULL OR v_client_event_id = '' THEN
    RAISE EXCEPTION 'client_event_id e obrigatorio' USING errcode = 'P0001';
  END IF;

  IF v_content IS NULL AND jsonb_array_length(v_attachments) = 0 THEN
    RAISE EXCEPTION 'Mensagem deve ter texto ou pelo menos um anexo' USING errcode = 'P0001';
  END IF;

  -- ---------------------------------------------------------------
  -- 3. Validar membership
  -- ---------------------------------------------------------------
  PERFORM 1 FROM work_members
    WHERE work_id = v_work_id
      AND user_id = v_sender_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  -- ---------------------------------------------------------------
  -- 4. Insert mensagem com idempotencia
  -- ---------------------------------------------------------------
  INSERT INTO work_messages (work_id, sender_id, content, client_event_id)
  VALUES (v_work_id, v_sender_id, v_content, v_client_event_id)
  ON CONFLICT (client_event_id) WHERE client_event_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_message_id;

  -- ---------------------------------------------------------------
  -- 5. Se nao inseriu (idempotencia): buscar existente
  -- ---------------------------------------------------------------
  IF v_message_id IS NULL THEN
    SELECT id INTO v_message_id
      FROM work_messages
      WHERE client_event_id = v_client_event_id;

    v_is_new := FALSE;
  END IF;

  -- ---------------------------------------------------------------
  -- 6. Se inseriu (novo): criar attachments
  -- ---------------------------------------------------------------
  IF v_is_new AND jsonb_array_length(v_attachments) > 0 THEN
    FOR v_att IN SELECT * FROM jsonb_array_elements(v_attachments)
    LOOP
      INSERT INTO work_message_attachments (
        id,
        message_id,
        file_type,
        file_name,
        file_size_bytes,
        mime_type,
        storage_path,
        width,
        height,
        duration_seconds
      ) VALUES (
        COALESCE((v_att->>'id')::UUID, gen_random_uuid()),
        v_message_id,
        v_att->>'file_type',
        v_att->>'file_name',
        (v_att->>'file_size_bytes')::INTEGER,
        v_att->>'mime_type',
        v_att->>'storage_path',
        (v_att->>'width')::INTEGER,
        (v_att->>'height')::INTEGER,
        (v_att->>'duration_seconds')::NUMERIC
      );
    END LOOP;
  END IF;

  -- ---------------------------------------------------------------
  -- 7. Atualizar last_activity_at da obra (feedback pro engineer)
  -- ---------------------------------------------------------------
  IF v_is_new THEN
    UPDATE works
      SET last_activity_at = now()
      WHERE id = v_work_id;
  END IF;

  -- ---------------------------------------------------------------
  -- 8. Retorno
  -- ---------------------------------------------------------------
  RETURN jsonb_build_object(
    'messageId', v_message_id,
    'isNew', v_is_new
  );
END;
$$;

-- ---------------------------------------------------------------
-- Permissoes: apenas usuarios autenticados podem chamar
-- ---------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION rpc_send_work_message FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rpc_send_work_message TO authenticated;

-- ---------------------------------------------------------------
-- Comentario para documentacao
-- ---------------------------------------------------------------
COMMENT ON FUNCTION rpc_send_work_message IS
  'Envia mensagem de chat (texto e/ou midias) em uma obra. '
  'Idempotente por client_event_id. '
  'Valida membership em work_members. '
  'Atualiza last_activity_at da obra. '
  'APK Bloco 2 — v1.0.0';