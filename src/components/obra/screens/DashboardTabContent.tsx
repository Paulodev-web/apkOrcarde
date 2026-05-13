'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  FileText,
  Flag,
  Info,
  MapPin,
  Ruler,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { FAB } from '@/design-system/composed/FAB';
import { ListItemCard } from '@/design-system/composed/ListItemCard';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { MetricCard } from '@/design-system/composed/MetricCard';
import { SectionHeader } from '@/design-system/composed/SectionHeader';
import { SeverityBadge } from '@/design-system/composed/SeverityBadge';
import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { ScreenContainer } from '@/design-system/layouts/ScreenContainer';
import { useObraTabs } from '@/components/obra/ObraTabContext';
import { QuickActionsSheet } from '@/components/obra/QuickActionsSheet';
import { supabase } from '@/lib/supabase/client';
import type { WorkAlert, WorkMilestone } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

const MILESTONES_KEY = 'milestones';
const ALERTS_KEY = 'alerts';
const CHECKLISTS_KEY = 'checklists';

async function fetchMilestones(workId: string): Promise<WorkMilestone[]> {
  const { data, error } = await supabase
    .from('work_milestones')
    .select('*')
    .eq('work_id', workId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as WorkMilestone[];
}

async function fetchAlerts(workId: string): Promise<WorkAlert[]> {
  const { data, error } = await supabase.from('work_alerts').select('*').eq('work_id', workId);
  if (error) throw error;
  return (data ?? []) as WorkAlert[];
}

async function fetchChecklistPending(workId: string): Promise<number> {
  const { count, error } = await supabase
    .from('work_checklists')
    .select('id', { count: 'exact', head: true })
    .eq('work_id', workId)
    .in('status', ['pending', 'in_progress', 'returned']);
  if (error) return 0;
  return count ?? 0;
}

async function fetchPoleStats(workId: string): Promise<{ planned: number; installed: number }> {
  const [plannedRes, installedRes] = await Promise.all([
    supabase.from('work_project_posts').select('id', { count: 'exact', head: true }).eq('work_id', workId),
    supabase
      .from('work_pole_installations')
      .select('id', { count: 'exact', head: true })
      .eq('work_id', workId)
      .eq('status', 'installed'),
  ]);
  return {
    planned: plannedRes.count ?? 0,
    installed: installedRes.count ?? 0,
  };
}

async function fetchMeters(workId: string): Promise<{ BT: number; MT: number; rede: number } | null> {
  const { data, error } = await supabase
    .from('work_project_snapshot')
    .select('meters_planned')
    .eq('work_id', workId)
    .maybeSingle();
  if (error || !data?.meters_planned) return null;
  const m = data.meters_planned as { BT: number; MT: number; rede: number };
  return m;
}

type Props = { workId: string };

export function DashboardTabContent({ workId }: Props) {
  const router = useRouter();
  const { jumpToTab } = useObraTabs();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const milestonesQuery = useQuery({
    queryKey: [MILESTONES_KEY, workId],
    queryFn: () => fetchMilestones(workId),
    enabled: workId.length > 0,
  });

  const alertsQuery = useQuery({
    queryKey: [ALERTS_KEY, workId],
    queryFn: () => fetchAlerts(workId),
    enabled: workId.length > 0,
  });

  const checklistsQuery = useQuery({
    queryKey: [CHECKLISTS_KEY, 'pendingCount', workId],
    queryFn: () => fetchChecklistPending(workId),
    enabled: workId.length > 0,
  });

  const polesQuery = useQuery({
    queryKey: ['poles', 'stats', workId],
    queryFn: () => fetchPoleStats(workId),
    enabled: workId.length > 0,
  });

  const metersQuery = useQuery({
    queryKey: ['projectSnapshot', 'metersOnly', workId],
    queryFn: () => fetchMeters(workId),
    enabled: workId.length > 0,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        milestonesQuery.refetch(),
        alertsQuery.refetch(),
        checklistsQuery.refetch(),
        polesQuery.refetch(),
        metersQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [milestonesQuery, alertsQuery, checklistsQuery, polesQuery, metersQuery]);

  const milestones = milestonesQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  const nextMilestone = useMemo(() => {
    const order = [...milestones].sort((a, b) => a.order_index - b.order_index);
    return order.find((m) => m.status !== 'approved') ?? null;
  }, [milestones]);

  const allApproved = milestones.length > 0 && milestones.every((m) => m.status === 'approved');

  const openAlerts = useMemo(() => alerts.filter((a) => a.status !== 'closed'), [alerts]);
  const criticalOpen = useMemo(
    () => openAlerts.filter((a) => a.severity === 'critical' || a.severity === 'high'),
    [openAlerts],
  );

  const poles = polesQuery.data ?? { planned: 0, installed: 0 };
  const poleProgress = poles.planned > 0 ? poles.installed / poles.planned : 0;

  const meters = metersQuery.data;
  const metersLabel = meters
    ? `${Math.round(meters.BT + meters.MT + meters.rede)} m (planejado)`
    : '—';

  if (milestonesQuery.isLoading) {
    return (
      <View style={styles.center}>
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenContainer scrollable refreshing={refreshing} onRefresh={() => void onRefresh()}>
        <SectionHeader title="Próximo marco" />
        <Card padding="lg">
          <Text variant="label" color="textSecondary">
            PRÓXIMO MARCO
          </Text>
          {allApproved ? (
            <View style={styles.nextMarcoBody}>
              <CheckCircle2 size={40} color={colors.success} strokeWidth={2} />
              <Text variant="heading3" color="textPrimary" style={styles.mt}>
                Todos os marcos aprovados
              </Text>
              <Text variant="body" color="textSecondary">
                Obra concluída tecnicamente nesta etapa.
              </Text>
            </View>
          ) : nextMilestone ? (
            <View style={styles.nextMarcoBody}>
              <Text variant="heading2" color="textPrimary" numberOfLines={2}>
                {nextMilestone.name}
              </Text>
              <View style={styles.row}>
                <StatusBadge kind="milestone" status={nextMilestone.status} />
              </View>
              <View style={styles.marcoActions}>
                {nextMilestone.status === 'pending' ? (
                  <Button variant="secondary" onPress={() => jumpToTab('marcos')}>
                    Iniciar marco
                  </Button>
                ) : null}
                {nextMilestone.status === 'in_progress' ? (
                  <Button variant="primary" onPress={() => jumpToTab('marcos')}>
                    Reportar concluído
                  </Button>
                ) : null}
                {nextMilestone.status === 'rejected' ? (
                  <Button variant="primary" onPress={() => jumpToTab('marcos')}>
                    Reportar novamente
                  </Button>
                ) : null}
                {nextMilestone.status === 'awaiting_approval' ? (
                  <Text variant="caption" color="textMuted">
                    Aguardando aprovação do engenheiro.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text variant="body" color="textSecondary">
              Nenhum marco cadastrado.
            </Text>
          )}
        </Card>

        <SectionHeader title="Resumo" />
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <MetricCard
              label="POSTES"
              value={`${poles.installed} / ${poles.planned}`}
              caption={poles.planned > 0 ? `${Math.round(poleProgress * 100)}%` : '—'}
              progress={poles.planned > 0 ? poleProgress : undefined}
              icon={MapPin}
              onPress={() => jumpToTab('postes')}
            />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="METRAGEM" value={metersLabel} caption="BT + MT + Rede" icon={Ruler} />
          </View>
          <View style={styles.gridItem}>
            <MetricCard
              label="ALERTAS ABERTOS"
              value={String(openAlerts.length)}
              caption={
                criticalOpen.length > 0 ? `${criticalOpen.length} crítico/alto` : 'Nenhum crítico'
              }
              variant={criticalOpen.length > 0 ? 'danger' : 'default'}
              icon={AlertTriangle}
              onPress={() => jumpToTab('alertas')}
            />
          </View>
          <View style={styles.gridItem}>
            <MetricCard
              label="CHECKLISTS"
              value={String(checklistsQuery.data ?? 0)}
              caption="pendentes / em revisão"
              variant={(checklistsQuery.data ?? 0) > 0 ? 'warning' : 'default'}
              icon={CheckSquare}
              onPress={() => jumpToTab('checklists')}
            />
          </View>
        </View>

        {criticalOpen.length > 0 ? (
          <>
            <SectionHeader title="Alertas críticos / altos" />
            {criticalOpen.slice(0, 5).map((a) => (
              <ListItemCard
                key={a.id}
                title={a.title}
                description={a.description ?? undefined}
                leftAccent={{ color: a.severity === 'critical' ? colors.severityCritical : colors.severityHigh, width: 6 }}
                badges={<SeverityBadge severity={a.severity} />}
                metadata={
                  <Text variant="caption" color="textMuted">
                    {relativeTimePtBr(a.created_at)}
                  </Text>
                }
                onPress={() => router.push(`/(main)/obra/${workId}/alertas/${a.id}`)}
              />
            ))}
          </>
        ) : null}

        <SectionHeader title="Atividade recente" />
        <ScrollView style={styles.activityBox} nestedScrollEnabled>
          <RecentActivityPlaceholder />
        </ScrollView>

        <SectionHeader title="Ações rápidas" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <View style={styles.chip}>
            <Button variant="secondary" icon={MapPin} onPress={() => jumpToTab('postes')}>
              Marcar poste
            </Button>
          </View>
          <View style={styles.chip}>
            <Button variant="secondary" icon={FileText} onPress={() => jumpToTab('diario')}>
              Publicar diário
            </Button>
          </View>
          <View style={styles.chip}>
            <Button variant="secondary" icon={AlertTriangle} onPress={() => router.push(`/(main)/obra/${workId}/alertas/novo`)}>
              Abrir alerta
            </Button>
          </View>
          <View style={styles.chip}>
            <Button variant="secondary" icon={Flag} onPress={() => jumpToTab('marcos')}>
              Reportar marco
            </Button>
          </View>
        </ScrollView>
      </ScreenContainer>

      <FAB icon={FileText} accessibilityLabel="Ações rápidas" onPress={() => setSheetOpen(true)} />
      <QuickActionsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} workId={workId} />
    </View>
  );
}

function RecentActivityPlaceholder() {
  return (
    <EmptyState
      icon={Info}
      title="Em breve"
      description="Histórico consolidado de notificações desta obra será exibido aqui."
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, minHeight: 200 },
  nextMarcoBody: { marginTop: spacing.sm },
  mt: { marginTop: spacing.md },
  row: { marginTop: spacing.md },
  marcoActions: { marginTop: spacing.lg, gap: spacing.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  gridItem: {
    width: '47%',
    minWidth: 140,
  },
  activityBox: { maxHeight: 220, marginBottom: spacing.lg },
  chips: { flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.huge },
  chip: { marginRight: spacing.sm },
});
