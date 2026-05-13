import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bell, HardHat, Menu } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ListItemCard } from '@/design-system/composed/ListItemCard';
import { MarcosTimeline } from '@/design-system/composed/MarcosTimeline';
import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { ErrorState } from '@/design-system/composed/ErrorState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { Text } from '@/design-system/primitives/Text';
import { Card } from '@/design-system/primitives/Card';
import { ScreenContainer } from '@/design-system/layouts/ScreenContainer';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOutboxCount } from '@/hooks/useOutboxCount';
import { supabase } from '@/lib/supabase/client';
import { useNotificationStore } from '@/stores/notification.store';
import { useSessionStore } from '@/stores/session.store';
import type { WorkListItem, WorkStatus } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

const WORKS_QUERY_KEY = ['works', 'list'] as const;

function countEmbed(rows: { count: number }[] | undefined | null): number {
  const n = rows?.[0]?.count;
  return typeof n === 'number' ? n : 0;
}

async function fetchWorks(): Promise<WorkListItem[]> {
  const { data, error } = await supabase
    .from('works')
    .select(
      `
      id, name, client_name, status, last_activity_at, address, started_at, expected_end_at,
      work_milestones ( id, code, name, order_index, status ),
      planned_posts:work_project_posts ( count ),
      pole_installations:work_pole_installations ( count )
    `,
    )
    .order('last_activity_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkListItem[];
}

function accentForStatus(status: WorkStatus): string {
  const map: Record<WorkStatus, string> = {
    planned: colors.neutral,
    in_progress: colors.info,
    paused: colors.warning,
    completed: colors.success,
    cancelled: colors.danger,
  };
  return map[status];
}

export default function WorksListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = useOutboxCount();
  const userName = useSessionStore((s) => s.user?.fullName ?? '');
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const query = useQuery({
    queryKey: WORKS_QUERY_KEY,
    queryFn: fetchWorks,
  });

  const inProgressCount = (query.data ?? []).filter((w) => w.status === 'in_progress').length;

  const listHeader = (
    <>
      <ScreenHeader
        title="Obras"
        leftAction={{
          icon: Menu,
          onPress: () => navigation.dispatch(DrawerActions.openDrawer()),
          accessibilityLabel: 'Abrir menu',
        }}
        rightActions={[
          {
            icon: Bell,
            onPress: () => router.push('/(main)/notificacoes' as never),
            badge: unreadCount,
            accessibilityLabel:
              unreadCount > 0
                ? `${unreadCount} notificacoes nao lidas`
                : 'Notificacoes',
          },
        ]}
      />

      {!isOnline ? (
        <Card padding="md" style={styles.bannerWarn}>
          <Text variant="bodyBold" color="warning">
            Sem conexao. Acoes serao enviadas quando voltar a internet.
          </Text>
        </Card>
      ) : null}

      {pendingCount > 0 ? (
        <Pressable
          onPress={() => router.push('/(main)/fila' as never)}
          accessibilityRole="button"
          accessibilityLabel="Ver fila de envio"
          style={styles.bannerPress}
        >
          <Card padding="md" style={styles.bannerInfo}>
            <Text variant="bodyBold" color="info">
              {pendingCount === 1
                ? '1 acao pendente de envio'
                : `${pendingCount} acoes pendentes de envio`}
            </Text>
          </Card>
        </Pressable>
      ) : null}

      {userName ? (
        <View style={styles.greeting}>
          <Text variant="heading2" color="textPrimary">
            Olá, {userName.split(' ')[0]}
          </Text>
          <Text variant="body" color="textSecondary" style={styles.greetingSub}>
            {inProgressCount === 1
              ? '1 obra em andamento'
              : `${inProgressCount} obras em andamento`}
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <ScreenContainer scrollable={false} noPadding background="muted">
      {query.isLoading ? (
        <LoadingState label="Carregando obras..." />
      ) : query.isError ? (
        <View style={styles.padded}>
          {listHeader}
          <ErrorState
            title="Erro ao carregar obras"
            description="Verifique sua conexao e tente novamente."
            onRetry={() => void query.refetch()}
          />
        </View>
      ) : (query.data ?? []).length === 0 ? (
        <View style={styles.padded}>
          {listHeader}
          <EmptyState
            icon={HardHat}
            title="Nenhuma obra alocada"
            description="Voce ainda nao esta alocado em nenhuma obra. Fale com seu engenheiro."
            cta={{ label: 'Verificar de novo', onPress: () => void query.refetch() }}
          />
        </View>
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={<View style={styles.listHeader}>{listHeader}</View>}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const planned = countEmbed(item.planned_posts);
            const poles = countEmbed(item.pole_installations);
            const metaLine =
              planned > 0
                ? `Postes ${poles} / ${planned} · Atualizado ${relativeTimePtBr(item.last_activity_at)}`
                : `Postes ${poles} · Atualizado ${relativeTimePtBr(item.last_activity_at)}`;

            return (
              <ListItemCard
                title={item.name}
                subtitle={item.client_name}
                description={item.address ?? undefined}
                leftAccent={{ color: accentForStatus(item.status) }}
                badges={<StatusBadge kind="work" status={item.status} />}
                metadata={
                  <View>
                    <MarcosTimeline
                      variant="compact"
                      milestones={item.work_milestones ?? []}
                    />
                    <Text variant="caption" color="textMuted" style={styles.metaLine}>
                      {metaLine}
                    </Text>
                  </View>
                }
                onPress={() =>
                  router.push({ pathname: '/(main)/obra/[workId]', params: { workId: item.id } })
                }
              />
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isLoading}
              onRefresh={() => void query.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  padded: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  listHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.huge,
  },
  bannerWarn: {
    marginBottom: spacing.sm,
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
  },
  bannerInfo: {
    marginBottom: spacing.sm,
    backgroundColor: colors.infoBg,
    borderColor: colors.info,
  },
  bannerPress: {
    marginBottom: spacing.sm,
  },
  greeting: {
    marginBottom: spacing.md,
  },
  greetingSub: {
    marginTop: spacing.xs,
  },
  metaLine: {
    marginTop: spacing.xs,
  },
});
