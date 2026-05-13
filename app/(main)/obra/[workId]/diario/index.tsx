'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DAILY_LOG_NEW_SENTINEL } from '@/constants/limits';
import { FAB } from '@/design-system/composed/FAB';
import { colors } from '@/design-system/tokens/colors';
import { FileText } from 'lucide-react-native';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { supabase } from '@/lib/supabase/client';
import { useConnectivityStore } from '@/stores/connectivity.store';
import type { WorkDailyLog } from '@/types';
import {
  type DailyLogListItem,
  type LocalDailyLogItem,
  getLocalPendingDailyLogs,
  getStatusColor,
  getStatusLabel,
  mergeDailyLogLists,
} from '@/lib/daily-log/local-pending';

const DAILY_LOGS_KEY = 'dailyLogs';

async function fetchDailyLogs(workId: string): Promise<WorkDailyLog[]> {
  const { data, error } = await supabase
    .from('work_daily_logs')
    .select(
      'id, work_id, log_date, published_by, current_revision_id, status, approved_by, approved_at, rejected_at, created_at, updated_at, work_daily_log_revisions(id, revision_number, created_at)',
    )
    .eq('work_id', workId)
    .order('log_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkDailyLog[];
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDatePtBr(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DailyLogListScreen() {
  const params = useLocalSearchParams<{ workId: string }>();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [localItems, setLocalItems] = useState<LocalDailyLogItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: [DAILY_LOGS_KEY, workId],
    queryFn: () => fetchDailyLogs(workId),
    enabled: workId.length > 0,
  });

  const refreshLocalItems = useCallback(async () => {
    try {
      const items = await getLocalPendingDailyLogs(workId);
      setLocalItems(items);
    } catch { /* swallow */ }
  }, [workId]);

  useEffect(() => {
    void refreshLocalItems();
    const interval = setInterval(() => void refreshLocalItems(), 3000);
    return () => clearInterval(interval);
  }, [refreshLocalItems]);

  useRealtimeChannel({
    channelName: `work:${workId}:events`,
    table: 'work_daily_logs',
    event: 'UPDATE',
    filter: `work_id=eq.${workId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [DAILY_LOGS_KEY, workId] });
    },
  });

  const listItems = useMemo(
    () => mergeDailyLogLists(query.data ?? [], localItems),
    [query.data, localItems],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: [DAILY_LOGS_KEY, workId] });
      await refreshLocalItems();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, workId, refreshLocalItems]);

  const handleFabPress = useCallback(() => {
    const today = todayIso();
    const existing = query.data?.find((log) => log.log_date === today);
    if (existing) {
      router.push(`/(main)/obra/${workId}/diario/${existing.id}`);
    } else {
      router.push(`/(main)/obra/${workId}/diario/${DAILY_LOG_NEW_SENTINEL}?logDate=${today}`);
    }
  }, [query.data, workId, router]);

  const renderItem = useCallback(
    ({ item }: { item: DailyLogListItem }) => {
      if (item.kind === 'local') {
        return (
          <LocalDailyLogCard
            item={item}
            onPress={() =>
              router.push(`/(main)/obra/${workId}/diario/${item.payload.daily_log_id}`)
            }
          />
        );
      }
      return (
        <RemoteDailyLogCard
          log={item.log}
          onPress={() => router.push(`/(main)/obra/${workId}/diario/${item.log.id}`)}
        />
      );
    },
    [workId, router],
  );

  const keyExtractor = useCallback((item: DailyLogListItem) => {
    if (item.kind === 'local') return `local-${item.item.client_event_id}`;
    return item.log.id;
  }, []);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Diario de Obra', headerShown: false }} />

      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Sem conexao — diarios serao enviados quando voltar
          </Text>
        </View>
      ) : null}

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : listItems.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Nenhum diario publicado</Text>
          <Text style={styles.emptySubtitle}>
            Toque em + para registrar o dia de hoje.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
          }
        />
      )}

      <FAB
        icon={FileText}
        accessibilityLabel="Publicar diario de hoje"
        onPress={handleFabPress}
      />
    </View>
  );
}

function RemoteDailyLogCard({
  log,
  onPress,
}: {
  log: WorkDailyLog;
  onPress: () => void;
}) {
  const statusColor = getStatusColor(log.status);
  const currentRevision = log.work_daily_log_revisions?.find(
    (r) => r.id === log.current_revision_id,
  );
  const revisionNumber = currentRevision?.revision_number ?? 1;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      accessibilityRole="button"
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDatePtBr(log.log_date)}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.badgeText, { color: statusColor.fg }]}>
            {getStatusLabel(log.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.cardRevision}>Revisao {revisionNumber}</Text>
      {log.status === 'rejected' ? (
        <Text style={styles.rejectedHint}>Rejeitado — toque para republicar</Text>
      ) : null}
    </Pressable>
  );
}

function LocalDailyLogCard({
  item,
  onPress,
}: {
  item: LocalDailyLogItem;
  onPress: () => void;
}) {
  const statusIcon =
    item.item.status === 'failed'
      ? '✕'
      : item.item.status === 'uploading_media' || item.item.status === 'calling_rpc'
        ? '↑'
        : '◷';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      accessibilityRole="button"
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDatePtBr(item.payload.log_date)}</Text>
        <View style={[styles.badge, { backgroundColor: '#e3effc' }]}>
          <Text style={[styles.badgeText, { color: '#0a3a82' }]}>Pendente de envio</Text>
        </View>
      </View>
      <View style={styles.syncRow}>
        <Text
          style={[
            styles.syncIcon,
            item.item.status === 'failed' ? styles.syncFailed : null,
          ]}
        >
          {statusIcon}
        </Text>
        <Text style={styles.syncLabel}>
          {item.item.status === 'failed' ? 'Falha no envio' : 'Enviando...'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  offlineBanner: {
    backgroundColor: '#fdf3d6',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#7a5b00',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1f24',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#5a6473',
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e3e8ef',
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1f24',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardRevision: {
    marginTop: 6,
    fontSize: 13,
    color: '#5a6473',
  },
  rejectedHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#7a1f17',
  },
  syncRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncIcon: {
    fontSize: 14,
    color: '#0a3a82',
  },
  syncFailed: {
    color: '#c0392b',
  },
  syncLabel: {
    fontSize: 13,
    color: '#5a6473',
  },
});
