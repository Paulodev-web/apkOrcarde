'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  MapPin,
  Play,
  Ruler,
  Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Text } from '@/design-system/primitives/Text';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { shadows } from '@/design-system/tokens/shadows';
import { spacing } from '@/design-system/tokens/spacing';
import { supabase } from '@/lib/supabase/client';
import type { Work, WorkAlert, WorkMilestone } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

async function fetchWork(workId: string): Promise<Work | null> {
  const { data, error } = await supabase.from('works').select('*').eq('id', workId).maybeSingle();
  if (error) throw error;
  return (data as Work) ?? null;
}

async function fetchMilestones(workId: string): Promise<WorkMilestone[]> {
  const { data, error } = await supabase
    .from('work_milestones')
    .select('*')
    .eq('work_id', workId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as WorkMilestone[];
}

async function fetchOpenAlerts(workId: string): Promise<WorkAlert[]> {
  const { data, error } = await supabase
    .from('work_alerts')
    .select('*')
    .eq('work_id', workId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkAlert[];
}

/** O diario de hoje ja foi publicado? */
async function fetchTodayLog(workId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('work_daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('work_id', workId)
    .eq('log_date', today);
  if (error) return false;
  return (count ?? 0) > 0;
}

async function fetchStats(workId: string) {
  const [planned, installed, snapshot, team] = await Promise.all([
    supabase.from('work_project_posts').select('id', { count: 'exact', head: true }).eq('work_id', workId),
    supabase
      .from('work_pole_installations')
      .select('id', { count: 'exact', head: true })
      .eq('work_id', workId)
      .eq('status', 'installed'),
    supabase.from('work_project_snapshot').select('meters_planned').eq('work_id', workId).maybeSingle(),
    supabase.from('work_team').select('id', { count: 'exact', head: true }).eq('work_id', workId),
  ]);

  const m = snapshot.data?.meters_planned as { BT: number; MT: number; rede: number } | null;
  return {
    polesPlanned: planned.count ?? 0,
    polesInstalled: installed.count ?? 0,
    meters: m ? Math.round(m.BT + m.MT + m.rede) : null,
    teamSize: team.count ?? 0,
  };
}

/**
 * Tela da obra.
 *
 * Ordem deliberada: primeiro a unica coisa a fazer agora, depois o que esta
 * travado, e so entao os numeros. Numero nao e acao — no canteiro ele responde
 * "como vamos", nunca "o que faco".
 */
export default function ObraScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const enabled = id.length > 0;
  const workQ = useQuery({ queryKey: ['work', id], queryFn: () => fetchWork(id), enabled });
  const milestonesQ = useQuery({ queryKey: ['milestones', id], queryFn: () => fetchMilestones(id), enabled });
  const alertsQ = useQuery({ queryKey: ['alerts', 'open', id], queryFn: () => fetchOpenAlerts(id), enabled });
  const todayLogQ = useQuery({ queryKey: ['dailyLog', 'today', id], queryFn: () => fetchTodayLog(id), enabled });
  const statsQ = useQuery({ queryKey: ['obra', 'stats', id], queryFn: () => fetchStats(id), enabled });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([workQ.refetch(), milestonesQ.refetch(), alertsQ.refetch(), todayLogQ.refetch(), statsQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [workQ, milestonesQ, alertsQ, todayLogQ, statsQ]);

  const milestones = milestonesQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const stats = statsQ.data;

  const current = useMemo(
    () => [...milestones].sort((a, b) => a.order_index - b.order_index).find((m) => m.status !== 'approved') ?? null,
    [milestones],
  );
  const allApproved = milestones.length > 0 && milestones.every((m) => m.status === 'approved');
  const currentIndex = current ? milestones.findIndex((m) => m.id === current.id) + 1 : milestones.length;

  if (workQ.isLoading || milestonesQ.isLoading) {
    return (
      <View style={styles.root}>
        <ObraHeader title="Obra" />
        <LoadingState />
      </View>
    );
  }

  const work = workQ.data;

  return (
    <View style={styles.root}>
      <ObraHeader title={work?.name ?? 'Obra'} subtitle={work?.client_name ?? undefined} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* ── Agora: a unica acao da tela ─────────────────────────────── */}
        <View style={[styles.nowCard, shadows.md]}>
          {allApproved ? (
            <>
              <View style={styles.eyebrow}>
                <CheckCircle2 size={17} color={colors.success} strokeWidth={2.2} />
                <Text variant="label" style={{ color: colors.success }}>CONCLUÍDO</Text>
              </View>
              <Text variant="heading1">Todos os marcos aprovados</Text>
              <Text variant="body" color="textSecondary">Nada pendente nesta etapa da obra.</Text>
            </>
          ) : current ? (
            <>
              <View style={styles.eyebrow}>
                <Play size={17} color={colors.primary} strokeWidth={2.2} />
                <Text variant="label" color="primary">AGORA</Text>
              </View>
              <View style={styles.gap5}>
                <Text variant="heading1" numberOfLines={2}>{current.name}</Text>
                <Text variant="body" color="textSecondary">
                  {`Marco ${currentIndex} de ${milestones.length} · ${milestoneHint(current.status)}`}
                </Text>
              </View>
              {current.status === 'awaiting_approval' ? null : (
                <Button
                  block
                  size="lg"
                  icon={current.status === 'pending' ? Play : CheckCircle2}
                  onPress={() => router.push(`/(main)/obra/${id}/marcos` as never)}
                >
                  {current.status === 'pending' ? 'Iniciar marco' : 'Concluir marco'}
                </Button>
              )}
            </>
          ) : (
            <Text variant="body" color="textSecondary">Nenhum marco cadastrado nesta obra.</Text>
          )}
        </View>

        {/* ── Pendente: o que trava ───────────────────────────────────── */}
        {alerts.length > 0 || !todayLogQ.data ? (
          <View style={styles.section}>
            <Text variant="label" color="textMuted">PENDENTE</Text>

            {alerts.slice(0, 3).map((a) => (
              <PendingRow
                key={a.id}
                icon={AlertTriangle}
                tint={a.severity === 'critical' ? colors.severityCritical : colors.danger}
                title={a.title}
                hint={`alerta aberto ${relativeTimePtBr(a.created_at)}`}
                onPress={() => router.push(`/(main)/obra/${id}/alertas/${a.id}` as never)}
              />
            ))}

            {!todayLogQ.data ? (
              <PendingRow
                icon={FileText}
                tint={colors.warning}
                title="Diário de hoje"
                hint="não publicado"
                onPress={() => router.push(`/(main)/obra/${id}/diario` as never)}
              />
            ) : null}
          </View>
        ) : null}

        {/* ── Execucao: numeros, quietos ──────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="label" color="textMuted">EXECUÇÃO</Text>
          <View style={styles.statRow}>
            <Stat
              icon={MapPin}
              value={String(stats?.polesInstalled ?? 0)}
              caption={stats?.polesPlanned ? `postes\nde ${stats.polesPlanned}` : 'postes\ninstalados'}
            />
            <Stat
              icon={Ruler}
              value={stats?.meters != null ? formatMeters(stats.meters) : '—'}
              caption={'rede\nplanejada'}
            />
            <Stat icon={Users} value={String(stats?.teamSize ?? 0)} caption={'equipe\nalocada'} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function milestoneHint(status: WorkMilestone['status']): string {
  switch (status) {
    case 'pending':
      return 'ainda não iniciado';
    case 'in_progress':
      return 'em execução';
    case 'awaiting_approval':
      return 'aguardando o engenheiro';
    case 'rejected':
      return 'devolvido, precisa de novo reporte';
    default:
      return '';
  }
}

function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`;
}

function PendingRow({
  icon: Icon,
  tint,
  title,
  hint,
  onPress,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pending, { borderLeftColor: tint, opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon size={22} color={tint} strokeWidth={1.9} />
      <View style={styles.pendingLabels}>
        <Text variant="bodyLargeBold" numberOfLines={1}>{title}</Text>
        <Text variant="caption" color="textSecondary">{hint}</Text>
      </View>
      <ChevronRight size={19} color={colors.textDisabled} strokeWidth={2} />
    </Pressable>
  );
}

function Stat({ icon: Icon, value, caption }: { icon: LucideIcon; value: string; caption: string }) {
  return (
    <Card padding="md" style={styles.stat}>
      <Icon size={18} color={colors.textMuted} strokeWidth={1.9} />
      <Text variant="metric" style={styles.tabular}>{value}</Text>
      <Text variant="caption" color="textSecondary">{caption}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: 120, gap: spacing.xl },

  nowCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gap5: { gap: 5 },

  section: { gap: spacing.md },

  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radius.lg,
  },
  pendingLabels: { flex: 1, gap: 2 },

  statRow: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: 3 },
  tabular: { fontVariant: ['tabular-nums'] },
});
