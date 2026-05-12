import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOutboxCount } from '@/hooks/useOutboxCount';
import { supabase } from '@/lib/supabase/client';
import { useSessionStore } from '@/stores/session.store';
import type { WorkListItem, WorkStatus } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

const WORKS_QUERY_KEY = ['works', 'list'] as const;

async function fetchWorks(): Promise<WorkListItem[]> {
  const { data, error } = await supabase
    .from('works')
    .select('id, name, client_name, status, last_activity_at, address, started_at, expected_end_at')
    .order('last_activity_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkListItem[];
}

export default function WorksListScreen() {
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = useOutboxCount();
  const userName = useSessionStore((s) => s.user?.fullName ?? '');

  const query = useQuery({
    queryKey: WORKS_QUERY_KEY,
    queryFn: fetchWorks,
  });

  return (
    <View style={styles.root}>
      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Sem conexao. Acoes serao enviadas quando voltar a internet.
          </Text>
        </View>
      ) : null}

      {pendingCount > 0 ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            {pendingCount === 1
              ? '1 acao pendente de envio'
              : `${pendingCount} acoes pendentes de envio`}
          </Text>
        </View>
      ) : null}

      {userName ? (
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>Ola, {userName.split(' ')[0]}</Text>
        </View>
      ) : null}

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0a3a82" />
          <Text style={styles.centerText}>Carregando obras...</Text>
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <WorkCard
              item={item}
              onPress={() =>
                router.push({ pathname: '/(main)/obra/[workId]', params: { workId: item.id } })
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isLoading}
              onRefresh={() => void query.refetch()}
              tintColor="#0a3a82"
              colors={['#0a3a82']}
            />
          }
        />
      )}
    </View>
  );
}

function WorkCard({ item, onPress }: { item: WorkListItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      accessibilityRole="button"
      accessibilityLabel={`Abrir obra ${item.name}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.cardClient} numberOfLines={1}>
        {item.client_name}
      </Text>
      {item.address ? (
        <Text style={styles.cardAddress} numberOfLines={2}>
          {item.address}
        </Text>
      ) : null}
      <Text style={styles.cardActivity}>
        Ultima atividade: {relativeTimePtBr(item.last_activity_at)}
      </Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: WorkStatus }) {
  const palette = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const STATUS_LABELS: Record<WorkStatus, string> = {
  planned: 'Planejada',
  in_progress: 'Em andamento',
  paused: 'Pausada',
  completed: 'Concluida',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<WorkStatus, { bg: string; fg: string }> = {
  planned: { bg: '#e3effc', fg: '#0a3a82' },
  in_progress: { bg: '#dff6e1', fg: '#1a6b2c' },
  paused: { bg: '#fdf3d6', fg: '#7a5b00' },
  completed: { bg: '#dcdfe6', fg: '#3b4452' },
  cancelled: { bg: '#fdecea', fg: '#7a1f17' },
};

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>Nenhuma obra alocada</Text>
      <Text style={styles.emptyText}>
        Voce ainda nao esta alocado em nenhuma obra. Fale com seu engenheiro.
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryBtn, pressed ? styles.retryBtnPressed : null]}
      >
        <Text style={styles.retryText}>Verificar de novo</Text>
      </Pressable>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>Erro ao carregar obras</Text>
      <Text style={styles.emptyText}>Verifique sua conexao e tente novamente.</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryBtn, pressed ? styles.retryBtnPressed : null]}
      >
        <Text style={styles.retryText}>Tentar de novo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  offlineBanner: {
    backgroundColor: '#fdf3d6',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  offlineText: {
    color: '#7a5b00',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingBanner: {
    backgroundColor: '#e3effc',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pendingText: {
    color: '#0a3a82',
    fontSize: 13,
    fontWeight: '600',
  },
  greeting: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greetingText: {
    color: '#3b4452',
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e3e8ef',
  },
  cardPressed: {
    backgroundColor: '#f0f4fa',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1c1f24',
  },
  cardClient: {
    marginTop: 4,
    color: '#3b4452',
    fontSize: 14,
  },
  cardAddress: {
    marginTop: 6,
    color: '#5a6473',
    fontSize: 13,
  },
  cardActivity: {
    marginTop: 12,
    color: '#5a6473',
    fontSize: 12,
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  centerText: {
    marginTop: 12,
    color: '#5a6473',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1f24',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: '#5a6473',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#0a3a82',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnPressed: {
    backgroundColor: '#072a60',
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
