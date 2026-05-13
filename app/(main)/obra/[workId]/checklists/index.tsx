'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { EmptyState } from '@/design-system/composed/EmptyState';
import { ListItemCard } from '@/design-system/composed/ListItemCard';
import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { ProgressBar } from '@/design-system/primitives/ProgressBar';
import { Text } from '@/design-system/primitives/Text';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import {
  applyChecklistStatusOverrides,
  getChecklistStatusColor,
  getLocalPendingChecklistOverrides,
} from '@/lib/checklists/local-pending';
import { supabase } from '@/lib/supabase/client';
import { useConnectivityStore } from '@/stores/connectivity.store';
import type { ChecklistStatus, WorkChecklist, WorkChecklistItem } from '@/types';

const CHECKLISTS_KEY = 'checklists';

type ChecklistWithItems = WorkChecklist & {
  work_checklist_items: Pick<WorkChecklistItem, 'id' | 'is_completed'>[];
};

async function fetchChecklists(workId: string): Promise<ChecklistWithItems[]> {
  const { data, error } = await supabase
    .from('work_checklists')
    .select('*, work_checklist_items(id, is_completed)')
    .eq('work_id', workId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChecklistWithItems[];
}

export default function ChecklistListScreen() {
  const params = useLocalSearchParams<{ workId: string }>();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [statusOverrides, setStatusOverrides] = useState<Map<string, ChecklistStatus>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: [CHECKLISTS_KEY, workId],
    queryFn: () => fetchChecklists(workId),
    enabled: workId.length > 0,
  });

  const refreshLocal = useCallback(async () => {
    try {
      const { statusOverrides: so } = await getLocalPendingChecklistOverrides(workId);
      setStatusOverrides(so);
    } catch { /* swallow */ }
  }, [workId]);

  useEffect(() => {
    void refreshLocal();
    const interval = setInterval(() => void refreshLocal(), 3000);
    return () => clearInterval(interval);
  }, [refreshLocal]);

  useRealtimeChannel({
    channelName: `work:${workId}:events`,
    table: 'work_checklists',
    event: 'UPDATE',
    filter: `work_id=eq.${workId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [CHECKLISTS_KEY, workId] });
    },
  });

  const checklists = useMemo(
    () => applyChecklistStatusOverrides(query.data ?? [], statusOverrides) as ChecklistWithItems[],
    [query.data, statusOverrides],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: [CHECKLISTS_KEY, workId] });
      await refreshLocal();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, workId, refreshLocal]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, title: 'Checklists' }} />
      <ScreenHeader
        title="Checklists"
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
      ) : checklists.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum checklist atribuido"
          description="Checklists serao exibidos aqui quando o engenheiro atribui-los."
        />
      ) : (
        <FlatList
          data={checklists}
          keyExtractor={(c) => c.id}
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
            <ChecklistListRow
              checklist={item}
              onPress={() => router.push(`/(main)/obra/${workId}/checklists/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function ChecklistListRow({
  checklist,
  onPress,
}: {
  checklist: ChecklistWithItems;
  onPress: () => void;
}) {
  const accent = getChecklistStatusColor(checklist.status);
  const items = checklist.work_checklist_items ?? [];
  const done = items.filter((i) => i.is_completed).length;
  const total = items.length;
  const progress = total > 0 ? done / total : 0;

  return (
    <ListItemCard
      title={checklist.name}
      leftAccent={{ color: accent.bg, width: 4 }}
      rightIcon={ChevronRight}
      badges={<StatusBadge kind="checklist" status={checklist.status} />}
      description={
        checklist.status === 'returned' && checklist.return_reason
          ? `Motivo: ${checklist.return_reason}`
          : checklist.due_date
            ? `Prazo: ${formatDate(checklist.due_date)}`
            : undefined
      }
      metadata={
        <View style={styles.metaBlock}>
          <ProgressBar value={progress} variant="primary" height={8} />
          <Text variant="caption" color="textMuted" style={styles.progressLabel}>
            {done}/{total} itens
          </Text>
        </View>
      }
      onPress={onPress}
    />
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  offlineBanner: {
    backgroundColor: colors.warningBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  offlineText: { textAlign: 'center' },
  listContent: { padding: spacing.lg, paddingBottom: 48 },
  metaBlock: { gap: spacing.xs, marginTop: spacing.sm },
  progressLabel: { marginTop: 2 },
});
