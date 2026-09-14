-- Migration: fix_update_work_last_activity_on_milestone_old_ref_on_insert
-- Aplicada via Supabase MCP em 2026-09-14 no projeto dev (cvumyonqcazhnwxpclms)
--
-- update_work_last_activity_on_milestone() dispara em dois gatilhos:
--   trg_milestone_event_activity  AFTER INSERT ON work_milestone_events
--   trg_milestone_status_activity AFTER UPDATE ON work_milestones
--
-- A versao anterior testava tudo numa condicao so:
--   IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
-- Isso quebra em todo INSERT: o Postgres prepara a expressao inteira na
-- primeira execucao, OLD.status incluido, mesmo que o curto-circuito do OR
-- nunca chegasse a usa-la (OLD nao existe em gatilho de INSERT). Era o que
-- travava rpc_report_milestone (e qualquer outro INSERT em
-- work_milestone_events) com "record OLD has no field status".
--
-- Fix: separar em IF/ELSIF, um ramo por TG_OP, para que a expressao com
-- OLD.status so seja preparada quando o gatilho e mesmo de UPDATE.

CREATE OR REPLACE FUNCTION public.update_work_last_activity_on_milestone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    BEGIN
      UPDATE public.works
         SET last_activity_at = now()
       WHERE id = NEW.work_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha ao atualizar last_activity_at em works (marco): %', SQLERRM;
    END;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      UPDATE public.works
         SET last_activity_at = now()
       WHERE id = NEW.work_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha ao atualizar last_activity_at em works (marco): %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;
