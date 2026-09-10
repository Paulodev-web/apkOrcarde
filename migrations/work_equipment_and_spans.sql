-- ═══════════════════════════════════════════════════════════════════════════
-- Execução de equipamento e de rede
--
-- Até aqui o módulo só registrava o POSTE executado. O projeto já descrevia o
-- que cada poste deveria receber (post_item_groups) e quais ligações existem
-- (work_project_connections), mas não havia onde gravar o que foi de fato
-- montado e lançado em campo. Estas tabelas fecham esse vão.
--
-- Anatomia espelhada de work_pole_installations: RLS por work_members,
-- client_event_id NOT NULL UNIQUE para idempotência forte da fila offline,
-- tabela de mídia irmã, e o timestamp do aparelho separado do created_at.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Equipamento montado num poste ──────────────────────────────────────
-- Um registro por ida ao poste: o gerente marca as estruturas que subiu
-- naquela visita e salva de uma vez. O mesmo poste acumula vários registros
-- em datas diferentes — é o histórico do poste.

CREATE TABLE IF NOT EXISTS public.work_pole_equipment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id         uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES public.work_pole_installations(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  -- Momento em que foi montado, medido no aparelho. Preserva a linha do tempo
  -- real quando o registro passa horas na fila offline.
  installed_at    timestamptz NOT NULL DEFAULT now(),
  notes           text,
  client_event_id text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- As estruturas daquele registro. `material_id` só existe quando o item veio
-- do catálogo do projeto; montagem fora do projeto entra com label livre.
CREATE TABLE IF NOT EXISTS public.work_pole_equipment_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.work_pole_equipment(id) ON DELETE CASCADE,
  work_id      uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  material_id  uuid REFERENCES public.materials(id),
  label        text NOT NULL,
  quantity     numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- false = "montei algo fora do projeto". O engenheiro precisa ver isso
  -- destacado: é divergência entre projeto e execução.
  from_project boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_pole_equipment_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.work_pole_equipment(id) ON DELETE CASCADE,
  work_id      uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('image', 'video')),
  storage_path text NOT NULL,
  mime_type    text,
  size_bytes   bigint,
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Trecho de rede lançado ─────────────────────────────────────────────
-- Vai de um poste a outro. Quando o trecho existe no projeto, `connection_id`
-- amarra os dois lados; quando o campo lançou algo não previsto, fica NULL e
-- os postes de ponta seguram a referência.

CREATE TABLE IF NOT EXISTS public.work_network_spans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id         uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  connection_id   uuid REFERENCES public.work_project_connections(id) ON DELETE SET NULL,
  from_post_id    uuid REFERENCES public.work_project_posts(id) ON DELETE SET NULL,
  to_post_id      uuid REFERENCES public.work_project_posts(id) ON DELETE SET NULL,
  category        text NOT NULL CHECK (category IN ('BT', 'MT', 'iluminacao')),
  -- Metragem vem do projeto, mas o campo corrige: o que foi lançado é o que
  -- vale para medição.
  meters          numeric NOT NULL CHECK (meters > 0),
  meters_planned  numeric,
  cable_type      text,
  notes           text,
  gps_lat         double precision,
  gps_lng         double precision,
  installed_at    timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  client_event_id text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_network_span_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  span_id      uuid NOT NULL REFERENCES public.work_network_spans(id) ON DELETE CASCADE,
  work_id      uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('image', 'video')),
  storage_path text NOT NULL,
  mime_type    text,
  size_bytes   bigint,
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Índices ────────────────────────────────────────────────────────────
-- Postgres não indexa chave estrangeira sozinho, e toda leitura do APK começa
-- por work_id. Sem estes índices o ON DELETE CASCADE varre a tabela inteira.

CREATE INDEX IF NOT EXISTS idx_work_pole_equipment_work        ON public.work_pole_equipment (work_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_pole_equipment_installation ON public.work_pole_equipment (installation_id);
CREATE INDEX IF NOT EXISTS idx_work_pole_equipment_created_by  ON public.work_pole_equipment (created_by);

CREATE INDEX IF NOT EXISTS idx_wpe_items_equipment ON public.work_pole_equipment_items (equipment_id);
CREATE INDEX IF NOT EXISTS idx_wpe_items_work      ON public.work_pole_equipment_items (work_id);
CREATE INDEX IF NOT EXISTS idx_wpe_items_material  ON public.work_pole_equipment_items (material_id);

CREATE INDEX IF NOT EXISTS idx_wpe_media_equipment ON public.work_pole_equipment_media (equipment_id);
CREATE INDEX IF NOT EXISTS idx_wpe_media_work      ON public.work_pole_equipment_media (work_id);

CREATE INDEX IF NOT EXISTS idx_work_network_spans_work       ON public.work_network_spans (work_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_network_spans_connection ON public.work_network_spans (connection_id);
CREATE INDEX IF NOT EXISTS idx_work_network_spans_from       ON public.work_network_spans (from_post_id);
CREATE INDEX IF NOT EXISTS idx_work_network_spans_to         ON public.work_network_spans (to_post_id);
CREATE INDEX IF NOT EXISTS idx_work_network_spans_created_by ON public.work_network_spans (created_by);

CREATE INDEX IF NOT EXISTS idx_wns_media_span ON public.work_network_span_media (span_id);
CREATE INDEX IF NOT EXISTS idx_wns_media_work ON public.work_network_span_media (work_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────
-- Mesmo modelo das demais tabelas do módulo: quem é membro da obra lê, quem é
-- membro com papel manager escreve, e só o autor mexe no que criou.
--
-- auth.uid() vai dentro de (SELECT ...) de propósito: assim o Postgres avalia
-- uma vez por consulta em vez de uma vez por linha.

ALTER TABLE public.work_pole_equipment       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_pole_equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_pole_equipment_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_network_spans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_network_span_media   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_pole_equipment_select ON public.work_pole_equipment;
CREATE POLICY work_pole_equipment_select ON public.work_pole_equipment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_members wm
    WHERE wm.work_id = work_pole_equipment.work_id
      AND wm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS work_pole_equipment_insert ON public.work_pole_equipment;
CREATE POLICY work_pole_equipment_insert ON public.work_pole_equipment FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1 FROM public.work_members wm
      WHERE wm.work_id = work_pole_equipment.work_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = 'manager'
    )
  );

DROP POLICY IF EXISTS work_pole_equipment_items_select ON public.work_pole_equipment_items;
CREATE POLICY work_pole_equipment_items_select ON public.work_pole_equipment_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_members wm
    WHERE wm.work_id = work_pole_equipment_items.work_id
      AND wm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS work_pole_equipment_items_insert ON public.work_pole_equipment_items;
CREATE POLICY work_pole_equipment_items_insert ON public.work_pole_equipment_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.work_pole_equipment e
    JOIN public.work_members wm
      ON wm.work_id = e.work_id AND wm.user_id = (SELECT auth.uid()) AND wm.role = 'manager'
    WHERE e.id = work_pole_equipment_items.equipment_id
      AND e.work_id = work_pole_equipment_items.work_id
      AND e.created_by = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS work_pole_equipment_media_select ON public.work_pole_equipment_media;
CREATE POLICY work_pole_equipment_media_select ON public.work_pole_equipment_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_members wm
    WHERE wm.work_id = work_pole_equipment_media.work_id
      AND wm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS work_pole_equipment_media_insert ON public.work_pole_equipment_media;
CREATE POLICY work_pole_equipment_media_insert ON public.work_pole_equipment_media FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.work_pole_equipment e
    JOIN public.work_members wm
      ON wm.work_id = e.work_id AND wm.user_id = (SELECT auth.uid()) AND wm.role = 'manager'
    WHERE e.id = work_pole_equipment_media.equipment_id
      AND e.work_id = work_pole_equipment_media.work_id
      AND e.created_by = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS work_network_spans_select ON public.work_network_spans;
CREATE POLICY work_network_spans_select ON public.work_network_spans FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_members wm
    WHERE wm.work_id = work_network_spans.work_id
      AND wm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS work_network_spans_insert ON public.work_network_spans;
CREATE POLICY work_network_spans_insert ON public.work_network_spans FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND EXISTS (
      SELECT 1 FROM public.work_members wm
      WHERE wm.work_id = work_network_spans.work_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = 'manager'
    )
  );

DROP POLICY IF EXISTS work_network_span_media_select ON public.work_network_span_media;
CREATE POLICY work_network_span_media_select ON public.work_network_span_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.work_members wm
    WHERE wm.work_id = work_network_span_media.work_id
      AND wm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS work_network_span_media_insert ON public.work_network_span_media;
CREATE POLICY work_network_span_media_insert ON public.work_network_span_media FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.work_network_spans s
    JOIN public.work_members wm
      ON wm.work_id = s.work_id AND wm.user_id = (SELECT auth.uid()) AND wm.role = 'manager'
    WHERE s.id = work_network_span_media.span_id
      AND s.work_id = work_network_span_media.work_id
      AND s.created_by = (SELECT auth.uid())
  ));

-- ── 5. Mantém a obra "viva" na lista ──────────────────────────────────────
-- works.last_activity_at ordena a tela inicial. Sem isto, uma obra onde só se
-- monta equipamento afundaria na lista.

CREATE OR REPLACE FUNCTION public.touch_work_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.works SET last_activity_at = now() WHERE id = NEW.work_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pole_equipment_last_activity ON public.work_pole_equipment;
CREATE TRIGGER trg_pole_equipment_last_activity
  AFTER INSERT ON public.work_pole_equipment
  FOR EACH ROW EXECUTE FUNCTION public.touch_work_last_activity();

DROP TRIGGER IF EXISTS trg_network_span_last_activity ON public.work_network_spans;
CREATE TRIGGER trg_network_span_last_activity
  AFTER INSERT ON public.work_network_spans
  FOR EACH ROW EXECUTE FUNCTION public.touch_work_last_activity();

-- ── 6. Correcao pos-advisor ───────────────────────────────────────────────
-- touch_work_last_activity() e funcao de TRIGGER. Sendo SECURITY DEFINER e
-- morando em `public`, o PostgREST a expunha em /rest/v1/rpc — qualquer
-- autenticado (e o anon) poderia carimbar last_activity_at de qualquer obra.
-- O gatilho continua funcionando: trigger nao passa por GRANT.
REVOKE EXECUTE ON FUNCTION public.touch_work_last_activity() FROM PUBLIC, anon, authenticated;
