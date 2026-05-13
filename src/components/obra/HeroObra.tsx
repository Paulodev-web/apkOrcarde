import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingState } from '@/design-system/composed/LoadingState';
import { MarcosTimeline } from '@/design-system/composed/MarcosTimeline';
import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { IconButton } from '@/design-system/primitives/IconButton';
import { Text } from '@/design-system/primitives/Text';
import { colors, gradients } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { supabase } from '@/lib/supabase/client';
import type { Work, WorkListMilestoneRow, WorkStatus } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

const WORK_DETAIL_KEY = 'works';
const MESSAGES_UNREAD_KEY = 'messagesUnread';

async function fetchWork(workId: string): Promise<Work> {
  const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
  if (error) throw error;
  if (!data) throw new Error('Obra nao encontrada');
  return data as Work;
}

async function fetchMilestonesCompact(workId: string): Promise<WorkListMilestoneRow[]> {
  const { data, error } = await supabase
    .from('work_milestones')
    .select('id, code, name, order_index, status')
    .eq('work_id', workId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as WorkListMilestoneRow[];
}

async function fetchUnreadChatCount(workId: string, userId: string): Promise<number> {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('work_messages')
    .select('id', { count: 'exact', head: true })
    .eq('work_id', workId)
    .neq('sender_id', userId)
    .is('read_by_manager_at', null);

  if (error) return 0;
  return count ?? 0;
}

type Props = {
  workId: string;
  userId: string;
};

export function HeroObra({ workId, userId }: Props) {
  const router = useRouter();

  const workQuery = useQuery({
    queryKey: [WORK_DETAIL_KEY, 'detail', workId],
    queryFn: () => fetchWork(workId),
    enabled: workId.length > 0,
  });

  const milestonesQuery = useQuery({
    queryKey: ['milestones', workId],
    queryFn: () => fetchMilestonesCompact(workId),
    enabled: workId.length > 0,
  });

  const unreadQuery = useQuery({
    queryKey: [MESSAGES_UNREAD_KEY, workId, userId],
    queryFn: () => fetchUnreadChatCount(workId, userId),
    enabled: workId.length > 0 && userId.length > 0,
    staleTime: 15_000,
  });

  if (workQuery.isLoading || !workQuery.data) {
    return (
      <View style={styles.heroLoading}>
        <LoadingState label="Carregando obra..." />
      </View>
    );
  }

  const work = workQuery.data;
  const milestones = milestonesQuery.data ?? [];

  return (
    <LinearGradient colors={[...gradients.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <IconButton
            icon={ChevronLeft}
            variant="primary"
            onPress={() => router.back()}
            accessibilityLabel="Voltar"
          />
          <View style={styles.headerSpacer} />
          <View style={styles.chatBtnWrap}>
            <IconButton
              icon={MessageCircle}
              variant="primary"
              onPress={() => router.push(`/(main)/obra/${workId}/chat`)}
              accessibilityLabel="Abrir chat da obra"
            />
            {(unreadQuery.data ?? 0) > 0 ? (
              <View style={styles.badge}>
                <Text variant="caption" color="textInverse" style={styles.badgeTxt}>
                  {(unreadQuery.data ?? 0) > 9 ? '9+' : String(unreadQuery.data)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>
          <Text variant="heading2" color="textInverse" numberOfLines={2}>
            {work.name}
          </Text>
          <Text variant="body" color="textInverse" style={styles.sub} numberOfLines={1}>
            {work.client_name}
          </Text>
          <View style={styles.badgeRow}>
            <WorkStatusBadge status={work.status} />
          </View>

          <View style={styles.timelineWrap}>
            <MarcosTimeline
              milestones={milestones.map((m) => ({
                id: m.id,
                name: m.name,
                order_index: m.order_index,
                status: m.status,
              }))}
              variant="compact"
            />
          </View>

          <Text variant="caption" color="textInverse" style={styles.updated}>
            Atualizado {relativeTimePtBr(work.last_activity_at)}
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function WorkStatusBadge({ status }: { status: WorkStatus }) {
  return (
    <View style={styles.statusWrap}>
      <StatusBadge kind="work" status={status} />
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { width: '100%' },
  safe: { width: '100%' },
  heroLoading: {
    minHeight: 120,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  headerSpacer: { flex: 1 },
  chatBtnWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  sub: { marginTop: spacing.xs, opacity: 0.9 },
  badgeRow: { marginTop: spacing.md },
  statusWrap: { alignSelf: 'flex-start' },
  timelineWrap: { marginTop: spacing.lg },
  updated: { marginTop: spacing.md, opacity: 0.75 },
});
