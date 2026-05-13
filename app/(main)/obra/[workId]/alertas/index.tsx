'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { EmptyState } from '@/design-system/composed/EmptyState';
import { FAB } from '@/design-system/composed/FAB';
import { ListItemCard } from '@/design-system/composed/ListItemCard';
import { SeverityBadge } from '@/design-system/composed/SeverityBadge';
import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { Text } from '@/design-system/primitives/Text';
import { Badge } from '@/design-system/primitives/Badge';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import {
  getCategoryLabel,
  getLocalPendingAlerts,
  getSeverityColor,
  mergeAlertsWithLocal,
} from '@/lib/alerts/local-pending';
import { supabase } from '@/lib/supabase/client';
import { useConnectivityStore } from '@/stores/connectivity.store';
import type { WorkAlert } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

const ALERTS_KEY = 'alerts';

type AlertRow = WorkAlert & { _localStatus?: string };

async function fetchAlerts(workId: string): Promise<WorkAlert[]> {
  const { data, error } = await supabase
    .from('work_alerts')
    .select('*')
    .eq('work_id', workId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkAlert[];
}

export default function AlertListScreen() {
  const params = useLocalSearchParams<{ workId: string }>();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [localAlerts, setLocalAlerts] = useState<WorkAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: [ALERTS_KEY, workId],
    queryFn: () => fetchAlerts(workId),
    enabled: workId.length > 0,
  });

  const refreshLocal = useCallback(async () => {
    try {
      const pending = await getLocalPendingAlerts(workId);
      setLocalAlerts(pending);
    } catch { /* swallow */ }
  }, [workId]);

  useEffect(() => {
    void refreshLocal();
    const interval = setInterval(() => void refreshLocal(), 3000);
    return () => clearInterval(interval);
  }, [refreshLocal]);

  useRealtimeChannel({
    channelName: `work:${workId}:alerts`,
    table: 'work_alerts',
    event: '*',
    filter: `work_id=eq.${workId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [ALERTS_KEY, workId] });
    },
  });

  const alerts = useMemo(
    () => mergeAlertsWithLocal(query.data ?? [], localAlerts) as AlertRow[],
    [query.data, localAlerts],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: [ALERTS_KEY, workId] });
      await refreshLocal();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, workId, refreshLocal]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, title: 'Alertas' }} />
      <ScreenHeader
        title="Alertas"
        leftAction={{
          icon: ChevronLeft,
          onPress: () => router.back(),
          accessibilityLabel: 'Voltar',
        }}
      />

      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text variant="body" color="warning" style={styles.offlineText}>
            Sem conexao — acoes serao enviadas quando voltar
          </Text>
        </View>
      ) : null}

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhum alerta registrado"
          description="Toque no botao + para registrar um novo alerta."
          cta={{ label: 'Novo alerta', onPress: () => router.push(`/(main)/obra/${workId}/alertas/novo`) }}
        />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <AlertListRow
              alert={item}
              onPress={() => {
                const isLocal = '_localStatus' in item;
                if (!isLocal) {
                  router.push(`/(main)/obra/${workId}/alertas/${item.id}`);
                }
              }}
            />
          )}
        />
      )}

      {alerts.length > 0 ? (
        <FAB
          icon={Plus}
          onPress={() => router.push(`/(main)/obra/${workId}/alertas/novo`)}
          accessibilityLabel="Abrir novo alerta"
        />
      ) : null}
    </View>
  );
}

function AlertListRow({ alert, onPress }: { alert: AlertRow; onPress: () => void }) {
  const sevColor = getSeverityColor(alert.severity);
  const isLocal = '_localStatus' in alert;
  const isCritical = alert.severity === 'critical';

  return (
    <ListItemCard
      title={alert.title}
      subtitle={relativeTimePtBr(alert.created_at)}
      leftAccent={{ color: sevColor.border, width: isCritical ? 6 : 4 }}
      rightIcon={isLocal ? undefined : ChevronRight}
      description={
        isCritical
          ? 'Prioridade critica — atencao imediata.'
          : isLocal
            ? 'Enviando para o servidor...'
            : undefined
      }
      badges={
        <View style={styles.badgeRow}>
          <SeverityBadge severity={alert.severity} />
          <Badge variant="info">{getCategoryLabel(alert.category)}</Badge>
          {!isLocal ? <StatusBadge kind="alert" status={alert.status} /> : null}
        </View>
      }
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  offlineBanner: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  offlineText: { textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  listContent: { padding: spacing.lg, paddingBottom: 120 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
});
