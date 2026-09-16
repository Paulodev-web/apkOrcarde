'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Flag,
  MapPin,
  RefreshCw,
  Rows3,
  Wrench,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useWorkId } from '@/hooks/useWorkId';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { getAllItems } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';

type Kind = 'poste' | 'equipamento' | 'alerta' | 'marco';

type Entry = {
  id: string;
  kind: Kind;
  title: string;
  detail: string;
  at: string;
  /** Ainda na fila local, nao confirmado pelo servidor. */
  queued?: boolean;
  href?: string;
};

/**
 * Os filtros sao o dia do gerente, mais a fila.
 *
 * Poste e equipamento sao o que ele faz o dia inteiro. "Na fila" e o que
 * ele confere quando o sinal volta. Impedimento e marco continuam aparecendo em
 * "Tudo", mas sao raros demais para ocupar um chip.
 */
const FILTERS: { key: Kind | 'all' | 'queued'; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'poste', label: 'Postes' },
  { key: 'equipamento', label: 'Equipamento' },
  { key: 'queued', label: 'Na fila' },
];

const VISUAL: Record<Kind, { icon: LucideIcon; tint: string; bg: string; border: string }> = {
  poste: { icon: MapPin, tint: colors.primary, bg: colors.infoBg, border: colors.infoBorder },
  equipamento: { icon: Wrench, tint: colors.success, bg: colors.successBg, border: colors.successBorder },
  alerta: { icon: AlertTriangle, tint: colors.danger, bg: colors.dangerBg, border: colors.dangerBorder },
  marco: { icon: Flag, tint: colors.success, bg: colors.successBg, border: colors.successBorder },
};

/** Acoes da fila local que aparecem na linha do tempo, e como rotula-las. */
const QUEUED_KIND: Record<string, { kind: Kind; title: string }> = {
  record_pole_installation: { kind: 'poste', title: 'Poste' },
  record_pole_equipment: { kind: 'equipamento', title: 'Equipamento' },
  open_alert: { kind: 'alerta', title: 'Alerta' },
  resolve_alert_in_field: { kind: 'alerta', title: 'Alerta resolvido' },
  add_alert_comment: { kind: 'alerta', title: 'Comentário em alerta' },
  report_milestone: { kind: 'marco', title: 'Marco reportado' },
};

function ResumoNumero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <View style={styles.resumoCartao}>
      <Text variant="metric" style={styles.resumoValor}>
        {valor}
      </Text>
      <Text variant="caption" color="textSecondary">
        {rotulo}
      </Text>
    </View>
  );
}

/** O PostgREST devolve relacao para-um ora como objeto, ora como array de um. */
function umRelacionado<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

async function fetchServerEntries(workId: string): Promise<Entry[]> {
  const [poles, equipamentos, alerts, events] = await Promise.all([
    supabase
      .from('work_pole_installations')
      .select('id, numbering, pole_type, installed_at')
      .eq('work_id', workId)
      .eq('status', 'installed')
      .order('installed_at', { ascending: false })
      .limit(30),
    supabase
      .from('work_pole_equipment')
      .select(
        'id, installed_at, notes, work_pole_installations:installation_id (numbering)',
      )
      .eq('work_id', workId)
      .order('installed_at', { ascending: false })
      .limit(30),
    supabase
      .from('work_alerts')
      .select('id, title, severity, status, created_at')
      .eq('work_id', workId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('work_milestone_events')
      .select('id, milestone_id, event_type, created_at, work_milestones(name)')
      .eq('work_id', workId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const out: Entry[] = [];

  // `installed_at` e nao `created_at`: a hora e a do aparelho. Um poste
  // levantado as 16h38 sem sinal e sincronizado as 19h12 pertence ao dia de
  // quem o levantou. E a mesma regra que o portal usa para montar o dia.
  for (const p of poles.data ?? []) {
    out.push({
      id: `poste-${p.id}`,
      kind: 'poste',
      title: p.numbering ? `Poste ${p.numbering}` : 'Poste sem numeração',
      detail: (p.pole_type as string | null) ?? 'levantado',
      at: p.installed_at as string,
      href: `/(main)/obra/${workId}/postes`,
    });
  }

  for (const e of equipamentos.data ?? []) {
    const poste = umRelacionado<{ numbering: string | null }>(e.work_pole_installations)?.numbering;
    out.push({
      id: `equipamento-${e.id}`,
      kind: 'equipamento',
      title: poste ? `Equipamento no poste ${poste}` : 'Equipamento montado',
      detail: (e.notes as string | null) ?? 'sem descrição',
      at: e.installed_at as string,
      href: `/(main)/obra/${workId}/postes`,
    });
  }

  for (const a of alerts.data ?? []) {
    out.push({
      id: `alerta-${a.id}`,
      kind: 'alerta',
      title: a.title as string,
      detail: `${severityLabel(a.severity as string)} · ${alertHint(a.status as string)}`,
      at: a.created_at as string,
      href: `/(main)/obra/${workId}/alertas/${a.id}`,
    });
  }

  for (const e of events.data ?? []) {
    const rel = e.work_milestones as { name: string } | { name: string }[] | null;
    const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    out.push({
      id: `marco-${e.id}`,
      kind: 'marco',
      title: `${name ?? 'Marco'} — ${milestoneEventLabel(e.event_type as string)}`,
      detail: 'marco da obra',
      at: e.created_at as string,
      href: `/(main)/obra/${workId}/marcos`,
    });
  }

  return out;
}

/** O que ainda esta no aparelho, esperando rede. Encabeca a lista. */
async function fetchQueuedEntries(workId: string): Promise<Entry[]> {
  const items = await getAllItems();
  const out: Entry[] = [];

  for (const item of items) {
    if (item.status === 'synced') continue;
    const spec = QUEUED_KIND[item.action_type];
    if (!spec) continue;

    let belongs = true;
    try {
      const payload = JSON.parse(item.payload) as { work_id?: string; workId?: string };
      const pWork = payload.work_id ?? payload.workId;
      belongs = !pWork || pWork === workId;
    } catch {
      belongs = true;
    }
    if (!belongs) continue;

    out.push({
      id: `fila-${item.id}`,
      kind: spec.kind,
      title: spec.title,
      detail: item.status === 'failed' ? 'falhou, revise na Fila' : 'aguardando envio',
      at: item.created_at,
      queued: true,
    });
  }

  return out;
}

/**
 * Registros: uma linha do tempo unica.
 *
 * Antes isto era uma aba por entidade — Postes, Diario, Marcos, Checklists,
 * Alertas. O gerente nao pensa por entidade; pensa "o que eu fiz hoje". Entao
 * tudo entra na mesma lista, em ordem de tempo, e o filtro por tipo fica como
 * chip, opcional.
 *
 * O que ainda esta na fila local aparece aqui junto do resto, marcado — o
 * registro existe para o gerente no instante em que ele fez, nao no instante
 * em que o servidor confirmou.
 */
export default function RegistrosScreen() {
  const workId = useWorkId();
  const id = typeof workId === 'string' ? workId : '';
  const router = useRouter();
  const [filter, setFilter] = useState<Kind | 'all' | 'queued'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const enabled = id.length > 0;
  const serverQ = useQuery({ queryKey: ['registros', 'server', id], queryFn: () => fetchServerEntries(id), enabled });
  const queuedQ = useQuery({ queryKey: ['registros', 'queued', id], queryFn: () => fetchQueuedEntries(id), enabled });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([serverQ.refetch(), queuedQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [serverQ, queuedQ]);

  const entries = useMemo(() => {
    const all = [...(queuedQ.data ?? []), ...(serverQ.data ?? [])];
    const filtered =
      filter === 'all'
        ? all
        : filter === 'queued'
          ? all.filter((e) => e.queued)
          : all.filter((e) => e.kind === filter);
    return filtered.sort((a, b) => b.at.localeCompare(a.at));
  }, [serverQ.data, queuedQ.data, filter]);

  const groups = useMemo(() => groupByDay(entries), [entries]);

  /**
   * Os tres numeros do topo sao SEMPRE do dia de hoje, e ignoram o filtro: eles
   * respondem "o que eu fiz hoje", nao "o que esta na tela". Contam tambem o que
   * ainda esta na fila, porque para o gerente o poste ja esta de pe.
   */
  const hoje = useMemo(() => {
    const agora = new Date();
    const doDia = [...(queuedQ.data ?? []), ...(serverQ.data ?? [])].filter((e) => {
      const d = new Date(e.at);
      return (
        d.getFullYear() === agora.getFullYear() &&
        d.getMonth() === agora.getMonth() &&
        d.getDate() === agora.getDate()
      );
    });
    const postes = doDia.filter((e) => e.kind === 'poste').length;
    const equipamentos = doDia.filter((e) => e.kind === 'equipamento').length;
    return { postes, equipamentos, total: doDia.length };
  }, [serverQ.data, queuedQ.data]);

  return (
    <View style={styles.root}>
      <ObraHeader
        title="O dia"
        subtitle="o que você registrou, sem escrever nada"
        footer={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(f.key)}
                  style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                >
                  <Text variant="captionBold" color={active ? 'textInverse' : 'textSecondary'}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        }
      />

      {hoje.total > 0 ? (
        <View style={styles.resumoHoje}>
          <ResumoNumero valor={hoje.postes} rotulo={hoje.postes === 1 ? 'poste' : 'postes'} />
          <ResumoNumero
            valor={hoje.equipamentos}
            rotulo={hoje.equipamentos === 1 ? 'montagem' : 'montagens'}
          />
        </View>
      ) : null}

      {serverQ.isLoading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Rows3}
          title="Nada registrado ainda"
          description="Use o botão + para marcar um poste, publicar o diário ou abrir um alerta."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          {groups.map((group) => (
            <View key={group.label} style={styles.group}>
              <Text variant="label" color="textMuted">{group.label}</Text>

              {group.items.map((entry, i) => {
                const v = VISUAL[entry.kind];
                const Icon = v.icon;
                const last = i === group.items.length - 1;
                return (
                  <Pressable
                    key={entry.id}
                    accessibilityRole={entry.href ? 'button' : 'text'}
                    onPress={entry.href ? () => router.push(entry.href as never) : undefined}
                    style={({ pressed }) => [styles.entry, { opacity: pressed && entry.href ? 0.65 : 1 }]}
                  >
                    <View style={styles.rail}>
                      <View style={[styles.bullet, { backgroundColor: v.bg, borderColor: v.border }]}>
                        <Icon size={17} color={v.tint} strokeWidth={2} />
                      </View>
                      {last ? null : <View style={styles.railLine} />}
                    </View>

                    <View style={styles.entryBody}>
                      <View style={styles.entryTop}>
                        <Text variant="bodyLargeBold" style={styles.entryTitle} numberOfLines={2}>
                          {entry.title}
                        </Text>
                        <Text variant="caption" color="textMuted">{formatTime(entry.at)}</Text>
                      </View>
                      <Text variant="caption" color="textSecondary">{entry.detail}</Text>

                      {entry.queued ? (
                        <View style={styles.queued}>
                          <RefreshCw size={13} color={colors.warningText} strokeWidth={2.2} />
                          <Text variant="captionBold" style={{ color: colors.warningText }}>na fila</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function groupByDay(entries: Entry[]): { label: string; items: Entry[] }[] {
  const out: { label: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const label = dayLabel(e.at);
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(e);
    else out.push({ label, items: [e] });
  }
  return out;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return `HOJE · ${formatDate(iso)}`;
  if (same(d, yesterday)) return 'ONTEM';
  return formatDate(iso).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}


function alertHint(status: string): string {
  const m: Record<string, string> = {
    open: 'aberto',
    in_progress: 'em tratativa',
    resolved_in_field: 'resolvido em campo',
    closed: 'encerrado',
  };
  return m[status] ?? status;
}

function severityLabel(severity: string): string {
  const m: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
  return m[severity] ?? severity;
}

function milestoneEventLabel(type: string): string {
  const m: Record<string, string> = {
    reported: 'reportado',
    approved: 'aprovado',
    rejected: 'devolvido',
    reset: 'reaberto',
  };
  return m[type] ?? type;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: 120, gap: spacing.lg },

  resumoHoje: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  resumoCartao: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  resumoValor: { fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.xl },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    minHeight: 38,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary },
  chipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },

  group: { gap: spacing.sm },

  entry: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 34, alignItems: 'center' },
  bullet: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLine: { flex: 1, width: 1.5, backgroundColor: colors.border, marginVertical: 5 },

  entryBody: { flex: 1, paddingBottom: spacing.lg, gap: 6 },
  entryTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  entryTitle: { flex: 1 },

  queued: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.warningBg,
  },
});
