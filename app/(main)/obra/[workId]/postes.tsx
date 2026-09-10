'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight, CloudOff, FileQuestion, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import Pdf from 'react-native-pdf';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { PlanViewport } from '@/components/obra/PlanViewport';
import { PoleDetailsSheet, type SelectedPole } from '@/components/obra/PoleDetailsSheet';
import { PolePin } from '@/components/obra/PolePin';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { ErrorState } from '@/design-system/composed/ErrorState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { NovoPosteSheet } from '@/components/obra/NovoPosteSheet';
import {
  asCoord,
  logicalToView,
  planFrame,
  viewToLogical,
  type StoredPlanGeometry,
} from '@/lib/plan/coords';
import { outboxEmitter } from '@/lib/offline/outbox';
import { captureException } from '@/lib/sentry';
import { ensureProjectPdf, getLocalProjectPdf, type CachedPdf } from '@/lib/project/pdf-cache';
import { supabase } from '@/lib/supabase/client';
import type { WorkPoleInstallation, WorkProjectPost } from '@/types';

/** Teto de quantas vezes a largura da tela a planta é rasterizada. */
const PLAN_RENDER_SCALE_MAX = 4;

/** Lado do ladrilho do AndroidPdfViewer, em pixels. É o `Constants.PART_SIZE`. */
const PDF_TILE_PX = 256;

/**
 * Quantos ladrilhos o renderizador entrega antes de desistir.
 *
 * O `Constants.Cache.CACHE_SIZE` da biblioteca vale 120. A folga cobre o
 * arredondamento da conta e o thumbnail, que também ocupa espaço.
 */
const PDF_TILE_BUDGET = 110;

/** Raio de acerto do dedo, em pixels de tela. */
const TAP_RADIUS_SCREEN = 26;

/**
 * Até onde dá para rasterizar a planta sem ela borrar da metade para baixo.
 *
 * O `react-native-pdf` usa o AndroidPdfViewer, que não desenha a página
 * inteira: corta em ladrilhos de 256 px e guarda no máximo 120. Os ladrilhos
 * são gerados linha por linha, de cima para baixo, mas quando o cache enche
 * ele descarta os MAIS ANTIGOS. Ou seja: a página inteira chega a ser
 * desenhada, e o que sobra viva são os ÚLTIMOS 120 ladrilhos. O topo é
 * despejado e cai para o thumbnail, que é a página a 0,3 do tamanho esticada
 * de volta.
 *
 * Verificado em emulador (1080×2424 @2,625) com uma prancha real: o topo fica
 * ilegível, a base fica nítida, e a transição acontece no MEIO de uma linha de
 * ladrilhos, com a esquerda borrada e a direita nítida. É a assinatura da
 * ordem linha a linha com despejo do mais antigo.
 *
 * Pedindo 4× a largura da tela nesse aparelho, a planta precisa de 187
 * ladrilhos para um orçamento de 120. Cerca de um terço dela é desenhado e
 * jogado fora.
 *
 * Esta função devolve o maior fator que ainda cabe no orçamento. É uma TROCA
 * consciente: perde-se detalhe no zoom máximo em nome de nitidez uniforme.
 * O conserto de verdade é trocar o renderizador por uma pirâmide de ladrilhos
 * nossa (ver `docs/plano-planta-e-postes-apk.md`, Fase 2); enquanto ela não
 * chega, uniforme e um pouco menos detalhada é melhor que metade borrada.
 */
function planRenderScale(viewportW: number, ratio: number): number {
  const dpr = PixelRatio.get();
  const cabe = (s: number) => {
    const w = viewportW * s * dpr;
    const h = w * ratio;
    return (
      Math.ceil(w / PDF_TILE_PX) * Math.ceil(h / PDF_TILE_PX) <= PDF_TILE_BUDGET
    );
  };

  let s = PLAN_RENDER_SCALE_MAX;
  while (s > 1 && !cabe(s)) s -= 0.1;
  // Abaixo de 1 a planta ficaria menor que a própria tela, o que é pior que
  // qualquer borrão. Nesse caso aceita-se estourar o orçamento de ladrilhos.
  return Math.max(1, Math.round(s * 10) / 10);
}

type Snapshot = {
  storagePath: string;
  renderVersion: number | null;
  /**
   * Geometria da prancha resolvida pelo portal no momento do import. Nula em
   * obra importada antes disso: aí o viewport cai no caminho antigo, que deduz
   * do que o `onLoadComplete` reporta.
   */
  planGeometry: StoredPlanGeometry;
};

/** Chave única da consulta de marcações, usada para ler e para escrever no cache. */
const marksKey = (workId: string) => ['poles', 'marks', workId] as const;

type PlanMarks = {
  installed: WorkPoleInstallation[];
  planned: WorkProjectPost[];
};

async function fetchSnapshot(workId: string): Promise<Snapshot | null> {
  const { data, error } = await supabase
    .from('work_project_snapshot')
    .select('pdf_storage_path, render_version, plan_geometry')
    .eq('work_id', workId)
    .maybeSingle();
  if (error || !data?.pdf_storage_path) return null;
  return {
    storagePath: data.pdf_storage_path as string,
    renderVersion: (data.render_version as number | null) ?? null,
    planGeometry: (data.plan_geometry as StoredPlanGeometry) ?? null,
  };
}

type ImpedimentoAberto = { id: string; title: string; severity: string; status: string } | null;

/**
 * O impedimento em aberto mais recente da obra.
 *
 * Aqui por um motivo: antes desta tela existia um painel de resumo que mostrava
 * "alertas pendentes", e ele saiu quando a obra passou a abrir na planta. Sem
 * isto, o gerente perderia de vista a obra parada. Mesma ideia da faixa do
 * portal: quem parou a obra nao deveria precisar navegar ate um lugar para
 * lembrar disso.
 */
async function fetchImpedimento(workId: string): Promise<ImpedimentoAberto> {
  const { data, error } = await supabase
    .from('work_alerts')
    .select('id, title, severity, status')
    .eq('work_id', workId)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1);

  // Sem sinal a leitura falha e a faixa some. Isso e aceitavel: ela e um
  // lembrete, nao a fonte da verdade, e quem abriu o impedimento foi ele.
  if (error) return null;
  return ((data ?? [])[0] as ImpedimentoAberto) ?? null;
}

async function fetchPlanMarks(workId: string): Promise<PlanMarks> {
  const [installed, planned] = await Promise.all([
    supabase
      .from('work_pole_installations')
      .select(
        'id, work_id, created_by, x_coord, y_coord, gps_lat, gps_lng, gps_accuracy_meters, numbering, pole_type, notes, installed_at, status, removed_at, removed_by, client_event_id, created_at',
      )
      .eq('work_id', workId)
      .eq('status', 'installed'),
    supabase
      .from('work_project_posts')
      .select('id, work_id, source_post_id, numbering, post_type, x_coord, y_coord, metadata')
      .eq('work_id', workId),
  ]);
  // Falha de leitura NÃO é "nenhum poste".
  //
  // Antes daqui as duas consultas caíam em `data ?? []`, e um erro de rede ou
  // de RLS virava uma planta vazia com o cabeçalho afirmando "0 de 9 postes".
  // Para quem está no canteiro isso se lê como "meus registros sumiram", que é
  // o pior recado possível num app cuja premissa é justamente guardar o que
  // foi feito. Pior ainda: como o erro era engolido, o React Query considerava
  // sucesso, não tentava de novo, e ainda guardava o zero em cache.
  //
  // Lançando, o React Query mantém o último resultado bom na tela, marca
  // `isError` e tenta de novo sozinho. E o erro passa a existir para ser lido.
  if (installed.error || planned.error) {
    const e = installed.error ?? planned.error;
    // Qual das duas caiu, e por quê. Sai no console do Metro em desenvolvimento,
    // que é onde dá para ler enquanto se reproduz o problema no aparelho.
    console.error('[PLANTA] falha ao ler marcações', {
      instalados: installed.error ?? 'ok',
      projeto: planned.error ?? 'ok',
    });
    captureException(e);
    throw new Error(e?.message ?? 'Falha ao carregar os postes da planta.');
  }

  return {
    installed: (installed.data ?? []) as WorkPoleInstallation[],
    planned: (planned.data ?? []) as WorkProjectPost[],
  };
}

/**
 * A planta da obra.
 *
 * O PDF nunca vem da rede na hora de abrir: vem do arquivo que já está no
 * aparelho (ver `lib/project/pdf-cache`). A rede só entra para conferir se o
 * engenheiro reimportou o projeto. É isso que faz a planta abrir no canteiro
 * sem sinal — antes, a URL assinada exigia rede e expirava em 30 min.
 */
export default function PostesScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  const { isOnline } = useNetworkStatus();
  const router = useRouter();

  const [pdf, setPdf] = useState<CachedPdf | null>(() => (id ? getLocalProjectPdf(id) : null));
  const [preparing, setPreparing] = useState(false);
  const [renderErr, setRenderErr] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [selected, setSelected] = useState<SelectedPole | null>(null);
  const [novoPoste, setNovoPoste] = useState<{ x: number; y: number } | null>(null);
  const planScale = useSharedValue(1);
  const [mostrarDica, setMostrarDica] = useState(true);

  const snapshotQuery = useQuery({
    queryKey: ['projectSnapshot', 'pdf', id],
    queryFn: () => fetchSnapshot(id),
    enabled: id.length > 0,
  });

  const impedimentoQuery = useQuery({
    queryKey: ['impedimentoAberto', id],
    queryFn: () => fetchImpedimento(id),
    enabled: id.length > 0,
  });

  const queryClient = useQueryClient();

  const marksQuery = useQuery({
    queryKey: marksKey(id),
    queryFn: () => fetchPlanMarks(id),
    enabled: id.length > 0,
  });

  useEffect(() => {
    const snap = snapshotQuery.data;
    if (!id || !snap) return;

    let cancelled = false;
    setPreparing(true);
    void (async () => {
      const result = await ensureProjectPdf(id, snap);
      if (!cancelled) {
        setPdf(result);
        setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, snapshotQuery.data]);

  /**
   * Reconcilia com o servidor quando a fila anda.
   *
   * O pino já aparece na hora pelo `onSaved`, mas aquele objeto é local: não
   * tem `created_by`, nem o `id` que o servidor confirmou, nem as mídias. Assim
   * que o worker sincroniza qualquer coisa, o `outboxEmitter` avisa e a tela
   * relê, trocando o poste provisório pelo de verdade.
   *
   * Antes daqui nada avisava a tela: o único `invalidateQueries` do app está no
   * `useNetworkStatus`, e só dispara quando a conexão CAI e volta. Online o
   * tempo todo, ele nunca roda, e a tela ficava desatualizada até alguém sair e
   * entrar de novo.
   */
  useEffect(() => {
    if (!id) return;
    return outboxEmitter.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: marksKey(id) });
    });
  }, [id, queryClient]);

  // Memoizadas porque alimentam `initialFocus`, e `initialFocus` decide o
  // enquadramento de abertura. Sem isso, todo render enquanto a consulta está
  // vazia cria listas novas e faz o viewport reavaliar a abertura à toa.
  const installed = useMemo(() => marksQuery.data?.installed ?? [], [marksQuery.data]);
  const planned = useMemo(() => marksQuery.data?.planned ?? [], [marksQuery.data]);

  // O cabeçalho só afirma uma contagem quando ele tem uma contagem para
  // afirmar. Com a leitura falhando e sem dado anterior, "0 de 9 postes" seria
  // uma mentira dita com confiança.
  const subtitle = useMemo(() => {
    if (!marksQuery.data) {
      return marksQuery.isError ? 'Postes indisponíveis' : 'Planta do projeto';
    }
    return planned.length > 0
      ? `${installed.length} de ${planned.length} postes`
      : `${installed.length} postes registrados`;
  }, [installed.length, planned.length, marksQuery.data, marksQuery.isError]);

  const content = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return null;
    const ratio = pageSize && pageSize.width > 0 ? pageSize.height / pageSize.width : 1;

    // A planta é rasterizada MAIOR que a tela de propósito.
    //
    // O react-native-pdf rasteriza na largura do componente. Se ela fosse a
    // largura do viewport (~390 px), aproximar só ampliaria um bitmap de
    // 390 px — que é exatamente o borrão que aparecia. Dando ao componente
    // mais largura, ele gera um bitmap com sobra de pixel, e o viewport
    // encaixa por transformada. O zoom então revela detalhe real em vez de
    // esticar pixel.
    //
    // O fator é calculado, não fixo: acima do que o cache de ladrilhos aguenta
    // a planta borra da metade para baixo. Ver `planRenderScale`.
    const contentW = viewport.width * planRenderScale(viewport.width, ratio);
    return { contentW, contentH: contentW * ratio };
  }, [viewport, pageSize]);

  // Onde a planta se encaixa dentro do quadro 6000×6000 — a mesma conta do
  // web, para que um poste marcado aqui caia no lugar certo lá.
  const frame = useMemo(
    () =>
      planFrame(
        pageSize?.width ?? 0,
        pageSize?.height ?? 0,
        snapshotQuery.data?.renderVersion ?? null,
        snapshotQuery.data?.planGeometry ?? null,
      ),
    [pageSize, snapshotQuery.data?.renderVersion, snapshotQuery.data?.planGeometry],
  );

  /**
   * Onde a rede está dentro da prancha.
   *
   * Numa prancha de projeto o desenho ocupa uma fração do papel; o resto é
   * legenda, observações e carimbo. Abrir a planta inteira significa abrir na
   * legenda, com o traçado do tamanho de uma unha. Enquadrar nos postes faz o
   * app abrir onde o gerente trabalha.
   */
  const initialFocus = useMemo(() => {
    if (!content) return null;
    const pontos = [
      ...planned.map((p) => ({ x: asCoord(p.x_coord), y: asCoord(p.y_coord) })),
      ...installed.map((p) => ({ x: asCoord(p.x_coord), y: asCoord(p.y_coord) })),
    ];
    if (pontos.length === 0) return null;

    const cantos = pontos.map((p) =>
      logicalToView(p.x, p.y, content.contentW, content.contentH, frame),
    );
    const esq = Math.min(...cantos.map((c) => c.left));
    const dir = Math.max(...cantos.map((c) => c.left));
    const topo = Math.min(...cantos.map((c) => c.top));
    const base = Math.max(...cantos.map((c) => c.top));

    // Respiro em volta para o poste da ponta não colar na borda da tela.
    const folga = Math.max((dir - esq) * 0.12, (base - topo) * 0.12, 40);
    return {
      x: esq - folga,
      y: topo - folga,
      width: dir - esq + folga * 2,
      height: base - topo + folga * 2,
    };
  }, [content, frame, planned, installed]);

  const onSelectInstalled = useCallback((pole: WorkPoleInstallation) => {
    setSelected({
      kind: 'installed',
      id: pole.id,
      numbering: pole.numbering,
      poleType: pole.pole_type,
      gpsLat: pole.gps_lat,
      gpsLng: pole.gps_lng,
      gpsAccuracyMeters: pole.gps_accuracy_meters,
      notes: pole.notes,
      installedAt: pole.installed_at,
    });
  }, []);

  const onSelectPlanned = useCallback((pole: WorkProjectPost) => {
    setSelected({
      kind: 'planned',
      id: pole.id,
      numbering: pole.numbering,
      poleType: pole.post_type,
    });
  }, []);

  /**
   * Um toque, duas leituras possíveis.
   *
   * Perto de um poste existente = "quero ver este". Longe de todos = "levantei
   * um aqui". A decisão fica aqui, num lugar só, em vez de dividida entre o
   * gesto do pai e o toque de cada pino — que é o que fazia a pinça brigar
   * com o pino e nada acontecer no dedo.
   */
  const onTapPlan = useCallback(
    (contentX: number, contentY: number, currentScale: number) => {
      if (!content) return;
      setMostrarDica(false);

      // Raio de acerto medido na TELA, não no conteúdo: em zoom alto o alvo
      // não pode encolher junto.
      const raio = TAP_RADIUS_SCREEN / currentScale;

      let melhor: { dist: number; pick: () => void } | null = null;
      const considerar = (px: number, py: number, pick: () => void) => {
        const d = Math.hypot(px - contentX, py - contentY);
        if (d <= raio && (melhor === null || d < melhor.dist)) melhor = { dist: d, pick };
      };

      for (const pole of installed) {
        const pos = logicalToView(asCoord(pole.x_coord), asCoord(pole.y_coord), content.contentW, content.contentH, frame);
        considerar(pos.left, pos.top, () => onSelectInstalled(pole));
      }
      for (const pole of planned) {
        const pos = logicalToView(asCoord(pole.x_coord), asCoord(pole.y_coord), content.contentW, content.contentH, frame);
        considerar(pos.left, pos.top, () => onSelectPlanned(pole));
      }

      if (melhor) {
        (melhor as { pick: () => void }).pick();
        return;
      }

      const logico = viewToLogical(contentX, contentY, content.contentW, content.contentH, frame);
      setNovoPoste(logico);
    },
    [content, frame, installed, planned, onSelectInstalled, onSelectPlanned],
  );

  const temPlantaLocal = pdf != null;
  const semProjeto = snapshotQuery.isFetched && !snapshotQuery.data && !temPlantaLocal;

  return (
    <View style={styles.root}>
      <ObraHeader title="Planta" subtitle={subtitle} />

      {impedimentoQuery.data ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Impedimento aberto: ${impedimentoQuery.data.title}`}
          onPress={() => router.push(`/(main)/obra/${id}/alertas` as never)}
          style={styles.impedimentoStrip}
        >
          <AlertTriangle size={18} color={colors.danger} strokeWidth={2.2} />
          <View style={styles.impedimentoTexto}>
            <Text variant="bodyBold" style={{ color: colors.dangerText }}>
              Obra parada
            </Text>
            <Text variant="caption" style={{ color: colors.dangerText }} numberOfLines={1}>
              {impedimentoQuery.data.title}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.danger} strokeWidth={2.2} />
        </Pressable>
      ) : null}

      {snapshotQuery.isLoading && !temPlantaLocal ? (
        <LoadingState label="Abrindo a planta..." />
      ) : semProjeto ? (
        <EmptyState
          icon={FileQuestion}
          title="Planta não disponível"
          description="O engenheiro ainda não importou o projeto desta obra."
        />
      ) : !temPlantaLocal ? (
        <EmptyState
          icon={isOnline ? CloudOff : WifiOff}
          title={isOnline ? 'Não foi possível baixar a planta' : 'Planta ainda não baixada'}
          description={
            isOnline
              ? 'Tente de novo. A planta fica guardada no aparelho depois do primeiro download.'
              : 'Conecte-se uma vez para guardar a planta no aparelho. Depois ela abre sem sinal.'
          }
          cta={{ label: 'Tentar de novo', onPress: () => void snapshotQuery.refetch() }}
        />
      ) : renderErr ? (
        <ErrorState
          title="Não foi possível abrir a planta"
          description={renderErr}
          onRetry={() => {
            setRenderErr(null);
            void snapshotQuery.refetch();
          }}
        />
      ) : (
        <View style={styles.body}>
          {pdf?.stale ? (
            <View style={styles.staleStrip}>
              <CloudOff size={17} color={colors.warning} strokeWidth={1.9} />
              <Text variant="caption" style={{ color: colors.warningText, flex: 1 }}>
                {isOnline
                  ? 'Mostrando a planta guardada. Baixando a versão nova…'
                  : 'Sem sinal — mostrando a planta guardada no aparelho.'}
              </Text>
            </View>
          ) : null}

          {/*
            A planta tem cache offline; as marcações não têm.
            Enquanto isso não existe (ver plano, Fase 1), o mínimo é dizer que a
            leitura falhou em vez de desenhar uma planta vazia e deixar o
            gerente achar que perdeu o trabalho do dia.
          */}
          {marksQuery.isError ? (
            <Pressable style={styles.staleStrip} onPress={() => void marksQuery.refetch()}>
              <CloudOff size={17} color={colors.warning} strokeWidth={1.9} />
              <Text variant="caption" style={{ color: colors.warningText, flex: 1 }}>
                {marksQuery.data
                  ? 'Não deu para atualizar os postes. Mostrando os últimos que chegaram. Toque para tentar de novo.'
                  : 'Não deu para carregar os postes desta obra. Nada foi perdido. Toque para tentar de novo.'}
              </Text>
            </Pressable>
          ) : null}

          <View
            style={styles.pdfBox}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setViewport((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height },
              );
            }}
          >
            {content ? (
              <PlanViewport
                viewportW={viewport.width}
                viewportH={viewport.height}
                contentW={content.contentW}
                contentH={content.contentH}
                scale={planScale}
                onTap={onTapPlan}
                initialFocus={initialFocus}
                ready={pageSize != null}
              >
                <Pdf
                  source={{ uri: pdf.uri }}
                  style={{
                    width: content.contentW,
                    height: content.contentH,
                    backgroundColor: colors.surface,
                    pointerEvents: 'none',
                  }}
                  trustAllCerts={false}
                  singlePage
                  scrollEnabled={false}
                  enableDoubleTapZoom={false}
                  minScale={1}
                  maxScale={1}
                  scale={1}
                  fitPolicy={0}
                  onLoadComplete={(_pages, _path, size) => {
                    // Guarda de igualdade, igual à do `onLayout` acima. Sem
                    // ela cada chamada criava objeto novo, `content` mudava, o
                    // `<Pdf>` era remedido, e o `onLoadComplete` disparava de
                    // novo — um ciclo que reenquadrava a planta a cada volta.
                    if (!size?.width || !size?.height) return;
                    setPageSize((prev) =>
                      prev && prev.width === size.width && prev.height === size.height
                        ? prev
                        : { width: size.width, height: size.height },
                    );
                  }}
                  onError={(e) =>
                    setRenderErr(typeof e === 'string' ? e : 'Arquivo da planta corrompido.')
                  }
                />

                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {planned.map((pole) => {
                    const pos = logicalToView(
                      asCoord(pole.x_coord),
                      asCoord(pole.y_coord),
                      content.contentW,
                      content.contentH,
                      frame,
                    );
                    return (
                      <PolePin
                        key={`p-${pole.id}`}
                        kind="planned"
                        left={pos.left}
                        top={pos.top}
                        numbering={pole.numbering}
                        scale={planScale}
                        selected={selected?.kind === 'planned' && selected.id === pole.id}
                      />
                    );
                  })}
                  {installed.map((pole) => {
                    const pos = logicalToView(
                      asCoord(pole.x_coord),
                      asCoord(pole.y_coord),
                      content.contentW,
                      content.contentH,
                      frame,
                    );
                    return (
                      <PolePin
                        key={`i-${pole.id}`}
                        kind="installed"
                        left={pos.left}
                        top={pos.top}
                        numbering={pole.numbering}
                        scale={planScale}
                        selected={selected?.kind === 'installed' && selected.id === pole.id}
                      />
                    );
                  })}
                </View>
              </PlanViewport>
            ) : null}

            {preparing ? (
              <View style={styles.preparing}>
                <Text variant="caption" color="textInverse">atualizando planta…</Text>
              </View>
            ) : null}

            {mostrarDica ? (
              <View style={styles.dica} pointerEvents="none">
                <Text variant="caption" color="textInverse">
                  Toque num vazio para marcar um poste
                </Text>
              </View>
            ) : null}
          </View>


        </View>
      )}

      <PoleDetailsSheet pole={selected} onClose={() => setSelected(null)} />

      <NovoPosteSheet
        workId={id}
        coords={novoPoste}
        onClose={() => setNovoPoste(null)}
        onSaved={(pole) => {
          setNovoPoste(null);
          // Pinta o pino AGORA, a partir do que o aparelho já gravou.
          //
          // Pedir `refetch` aqui não funciona: o `enqueue` só escreve no outbox
          // local, e quem envia para o servidor é o worker, segundos depois. O
          // refetch disparado neste instante chega ao servidor ANTES do poste e
          // volta com a lista velha — foi exatamente por isso que o poste
          // marcado não aparecia e o contador não subia. Sem sinal seria pior:
          // o refetch nem completaria.
          queryClient.setQueryData<PlanMarks>(marksKey(id), (prev) =>
            prev
              ? { ...prev, installed: [...prev.installed, pole] }
              : { installed: [pole], planned: [] },
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  body: { flex: 1, padding: spacing.sm, gap: spacing.sm },
  impedimentoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.dangerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.dangerBorder,
  },
  impedimentoTexto: { flex: 1, gap: 1 },
  staleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  pdfBox: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dica: {
    position: 'absolute',
    left: spacing.md,
    right: 96,
    bottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(24,24,22,0.72)',
    alignItems: 'center',
  },
  preparing: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(24,24,22,0.7)',
  },
});
