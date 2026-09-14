-- Migration: rpc_record_pole_equipment
-- Bloco 3b — Equipamento montado no poste
--
-- Esta funcao nunca teve arquivo de migration proprio no repo (foi aplicada
-- direto via Supabase MCP junto com work_equipment_and_spans.sql). Este
-- arquivo documenta a versao ATUAL, ja simplificada: sem catalogo de
-- estruturas, so foto + descricao livre.
--
-- Aplicada via Supabase MCP em 2026-09-14 no projeto dev (cvumyonqcazhnwxpclms).
--
-- Historico: a versao anterior exigia `items[]` (selecao de estrutura de um
-- catalogo vindo de work_project_snapshot.materials_planned, com quantidade e
-- from_project). Esse catalogo dependia do orcamento copiar as estruturas pro
-- projeto, o que nunca foi feito — travava o registro de equipamento inteiro
-- por falta de um dado que a obra nao tinha. A partir desta versao, o
-- registro exige apenas `notes` (descricao livre) e ao menos uma foto em
-- `media`. A tabela work_pole_equipment_items continua existindo (com dados
-- antigos, se houver) mas deixa de ser escrita por esta RPC.

CREATE OR REPLACE FUNCTION public.rpc_record_pole_equipment(input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_work_id         UUID;
  v_installation_id UUID;
  v_equipment_id    UUID;
  v_created_by      UUID;
  v_notes           TEXT;
  v_installed_at    TIMESTAMPTZ;
  v_client_event_id TEXT;
  v_media           JSONB;
  v_is_new          BOOLEAN := TRUE;
  v_result_id       UUID;
  v_row             JSONB;
BEGIN
  v_work_id         := (input->>'work_id')::UUID;
  v_installation_id := (input->>'installation_id')::UUID;
  v_equipment_id    := COALESCE((input->>'equipment_id')::UUID, gen_random_uuid());
  v_created_by      := auth.uid();
  v_notes           := NULLIF(trim(input->>'notes'), '');
  v_installed_at    := COALESCE((input->>'installed_at')::TIMESTAMPTZ, now());
  v_client_event_id := input->>'client_event_id';
  v_media           := COALESCE(input->'media', '[]'::JSONB);

  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id e obrigatorio' USING errcode = 'P0001';
  END IF;
  IF v_installation_id IS NULL THEN
    RAISE EXCEPTION 'installation_id e obrigatorio' USING errcode = 'P0001';
  END IF;
  IF v_client_event_id IS NULL OR v_client_event_id = '' THEN
    RAISE EXCEPTION 'client_event_id e obrigatorio' USING errcode = 'P0001';
  END IF;
  -- Sem catalogo: a prova do que foi montado passa a ser a foto + a
  -- descricao, nao mais uma lista de itens escolhidos de um catalogo que
  -- dependia do orcamento (nunca copiado pro projeto).
  IF v_notes IS NULL THEN
    RAISE EXCEPTION 'Descreva o equipamento montado' USING errcode = 'P0001';
  END IF;
  IF length(v_notes) > 1000 THEN
    RAISE EXCEPTION 'notes nao pode exceder 1000 caracteres' USING errcode = 'P0001';
  END IF;
  IF jsonb_array_length(v_media) = 0 THEN
    RAISE EXCEPTION 'Uma foto do equipamento e obrigatoria' USING errcode = 'P0001';
  END IF;

  PERFORM 1 FROM work_members WHERE work_id = v_work_id AND user_id = v_created_by;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  -- O poste tem que existir, estar nesta obra e ainda estar em pe: equipamento
  -- em poste removido e dado invalido, nao erro de digitacao.
  PERFORM 1 FROM work_pole_installations
    WHERE id = v_installation_id AND work_id = v_work_id AND status = 'installed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poste nao encontrado nesta obra' USING errcode = 'P0001';
  END IF;

  INSERT INTO work_pole_equipment (
    id, work_id, installation_id, created_by, installed_at, notes, client_event_id
  ) VALUES (
    v_equipment_id, v_work_id, v_installation_id, v_created_by,
    v_installed_at, v_notes, v_client_event_id
  )
  ON CONFLICT (client_event_id) DO NOTHING
  RETURNING id INTO v_result_id;

  IF v_result_id IS NULL THEN
    SELECT id INTO v_result_id FROM work_pole_equipment WHERE client_event_id = v_client_event_id;
    v_is_new := FALSE;
  END IF;

  IF v_is_new THEN
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_media)
    LOOP
      INSERT INTO work_pole_equipment_media (
        equipment_id, work_id, kind, storage_path, mime_type, size_bytes, is_primary
      ) VALUES (
        v_result_id,
        v_work_id,
        v_row->>'kind',
        v_row->>'storage_path',
        v_row->>'mime_type',
        (v_row->>'file_size_bytes')::BIGINT,
        COALESCE((v_row->>'is_primary')::BOOLEAN, FALSE)
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('equipmentId', v_result_id, 'isNew', v_is_new);
END;
$function$;
