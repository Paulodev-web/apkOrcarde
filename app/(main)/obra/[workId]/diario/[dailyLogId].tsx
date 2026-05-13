'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DAILY_LOG_NEW_SENTINEL } from '@/constants/limits';
import { DailyLogReadOnly } from '@/components/daily-log/DailyLogReadOnly';
import { DailyLogWizard } from '@/components/obra/DailyLogWizard';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { enqueue } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';
import { useConnectivityStore } from '@/stores/connectivity.store';
import { useSessionStore } from '@/stores/session.store';
import type {
  WorkDailyLog,
  WorkDailyLogRevision,
  PlannedMaterial,
  MetersPlanned,
} from '@/types';
import type { PublishDailyLogInput } from '@/types/rpc';
import { uuidV4 } from '@/utils/uuid';

type CrewOption = { id: string; name: string };

const DAILY_LOGS_KEY = 'dailyLogs';
const DAILY_LOG_DETAIL_KEY = 'dailyLogDetail';

async function fetchDailyLogDetail(
  dailyLogId: string,
): Promise<WorkDailyLog & { work_daily_log_revisions: WorkDailyLogRevision[] }> {
  const { data, error } = await supabase
    .from('work_daily_logs')
    .select('*, work_daily_log_revisions(*, work_daily_log_media(*))')
    .eq('id', dailyLogId)
    .single();

  if (error) throw error;
  return data as WorkDailyLog & { work_daily_log_revisions: WorkDailyLogRevision[] };
}

async function fetchCrewOptions(workId: string): Promise<CrewOption[]> {
  const { data, error } = await supabase
    .from('work_team')
    .select('id, name, is_active, crew_members(id, name, is_active)')
    .eq('work_id', workId)
    .eq('is_active', true);

  if (error || !data) return [];

  const options: CrewOption[] = [];
  for (const team of data as Array<{
    id: string;
    name: string;
    crew_members: Array<{ id: string; name: string; is_active: boolean }>;
  }>) {
    if (team.crew_members) {
      for (const member of team.crew_members) {
        if (member.is_active) {
          options.push({ id: member.id, name: member.name });
        }
      }
    }
  }
  return options;
}

async function fetchProjectSnapshot(
  workId: string,
): Promise<{ materials_planned: PlannedMaterial[]; meters_planned: MetersPlanned | null }> {
  const { data, error } = await supabase
    .from('work_project_snapshot')
    .select('materials_planned, meters_planned')
    .eq('work_id', workId)
    .single();

  if (error || !data) {
    return { materials_planned: [], meters_planned: null };
  }
  return {
    materials_planned: (data.materials_planned as PlannedMaterial[]) ?? [],
    meters_planned: (data.meters_planned as MetersPlanned) ?? null,
  };
}

export default function DailyLogDetailScreen() {
  const params = useLocalSearchParams<{ workId: string; dailyLogId: string; logDate?: string }>();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const dailyLogId = typeof params.dailyLogId === 'string' ? params.dailyLogId : '';
  const logDateParam = typeof params.logDate === 'string' ? params.logDate : '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const userId = useSessionStore((s) => s.user?.id ?? '');

  const isNewLog = dailyLogId === DAILY_LOG_NEW_SENTINEL;
  const [submitting, setSubmitting] = useState(false);

  const logQuery = useQuery({
    queryKey: [DAILY_LOG_DETAIL_KEY, dailyLogId],
    queryFn: () => fetchDailyLogDetail(dailyLogId),
    enabled: !isNewLog && dailyLogId.length > 0,
  });

  const crewQuery = useQuery({
    queryKey: ['crew', workId],
    queryFn: () => fetchCrewOptions(workId),
    enabled: workId.length > 0,
  });

  const snapshotQuery = useQuery({
    queryKey: ['projectSnapshot', workId],
    queryFn: () => fetchProjectSnapshot(workId),
    enabled: workId.length > 0,
  });

  useRealtimeChannel({
    channelName: `work:${workId}:events`,
    table: 'work_daily_logs',
    event: 'UPDATE',
    filter: `work_id=eq.${workId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [DAILY_LOG_DETAIL_KEY, dailyLogId] });
      void queryClient.invalidateQueries({ queryKey: [DAILY_LOGS_KEY, workId] });
    },
  });

  const log = logQuery.data ?? null;
  const revisions = log?.work_daily_log_revisions ?? [];
  const currentRevision = revisions.find((r) => r.id === log?.current_revision_id) ?? null;

  const isEditable = isNewLog || log?.status === 'rejected';
  const isRepublish = !isNewLog && log?.status === 'rejected';

  const actualDailyLogId = useMemo(() => {
    if (!isNewLog) return dailyLogId;
    return uuidV4();
  }, [isNewLog, dailyLogId]);

  const actualLogDate = useMemo(() => {
    if (log) return log.log_date;
    return logDateParam || new Date().toISOString().slice(0, 10);
  }, [log, logDateParam]);

  const lastRejectionReason = useMemo(() => {
    if (!isRepublish || !currentRevision) return null;
    return currentRevision.rejection_reason;
  }, [isRepublish, currentRevision]);

  const handleSubmit = useCallback(
    async (payload: PublishDailyLogInput, mediaPaths: string[]) => {
      setSubmitting(true);
      try {
        await enqueue({
          client_event_id: payload.client_event_id,
          action_type: 'publish_daily_log',
          payload,
          media_paths: mediaPaths.length > 0 ? mediaPaths : undefined,
        });

        void queryClient.invalidateQueries({ queryKey: [DAILY_LOGS_KEY, workId] });
        router.back();
      } catch {
        /* swallow — item stays in outbox for retry */
      } finally {
        setSubmitting(false);
      }
    },
    [workId, queryClient, router],
  );

  const screenTitle = useMemo(() => {
    if (isNewLog) return 'Novo diario';
    if (isRepublish) return 'Republicar diario';
    return 'Diario';
  }, [isNewLog, isRepublish]);

  if (!isNewLog && logQuery.isLoading) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: screenTitle }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0a3a82" />
        </View>
      </View>
    );
  }

  if (!isNewLog && logQuery.isError) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: screenTitle }} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Erro ao carregar diario</Text>
          <Text style={styles.errorText}>Verifique sua conexao e tente novamente.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: screenTitle }} />

      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Sem conexao — diario sera enviado quando voltar</Text>
        </View>
      ) : null}

      {isEditable ? (
        <DailyLogWizard
          workId={workId}
          dailyLogId={isRepublish ? dailyLogId : actualDailyLogId}
          logDate={actualLogDate}
          isRepublish={isRepublish}
          lastRevision={currentRevision}
          crewOptions={crewQuery.data ?? []}
          plannedMaterials={snapshotQuery.data?.materials_planned ?? []}
          metersPlanned={snapshotQuery.data?.meters_planned ?? null}
          lastRejectionReason={lastRejectionReason}
          onSubmit={(payload, mediaPaths) => void handleSubmit(payload, mediaPaths)}
          submitting={submitting}
        />
      ) : log ? (
        <DailyLogReadOnly log={log} revisions={revisions} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f6fb',
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
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1f24',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#5a6473',
    fontSize: 14,
    textAlign: 'center',
  },
});
