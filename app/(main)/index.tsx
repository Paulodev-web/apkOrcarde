'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock, HardHat, RefreshCw, WifiOff } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/design-system/composed/EmptyState';
import { ErrorState } from '@/design-system/composed/ErrorState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { shadows } from '@/design-system/tokens/shadows';
import { spacing } from '@/design-system/tokens/spacing';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOutboxCount } from '@/hooks/useOutboxCount';
import { supabase } from '@/lib/supabase/client';
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

const STATUS_LABEL: Record<WorkStatus, { label: string; fg: string; bg: string }> = {
  planned: { label: 'Planejada', fg: colors.textSecondary, bg: colors.neutralBg },
  in_progress: { label: 'Em obra', fg: colors.progressText, bg: colors.progressBg },
  paused: { label: 'Pausada', fg: colors.warningText, bg: colors.warningBg },
  completed: { label: 'Concluída', fg: colors.successText, bg: colors.successBg },
  cancelled: { label: 'Cancelada', fg: colors.dangerText, bg: colors.dangerBg },
};

const MILESTONE_TINT: Record<string, string> = {
  approved: colors.success,
  awaiting_approval: colors.warning,
  in_progress: colors.primaryAccent,
  rejected: colors.danger,
  pending: colors.border,
};

/**
 * Tela inicial: a lista de obras.
 *
 * Cada cartao responde tres perguntas na ordem em que o gerente pergunta:
 * que obra e esta, em que marco ela esta, e o que ela tem pendente. O resto
 * (endereco, datas) fica na tela da obra — em cartao, cada linha a mais
 * atrasa a leitura no sol.
 */
export default function WorksListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = useOutboxCount();
  const userName = useSessionStore((s) => s.user?.fullName ?? '');

  const query = useQuery({ queryKey: WORKS_QUERY_KEY, queryFn: fetchWorks });

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.headerRow}>
        <View style={styles.titles}>
          <Text variant="display">Obras</Text>
          {userName ? (
            <Text variant="body" color="textSecondary">
              {userName}
            </Text>
          ) : null}
        </View>
        <View style={styles.avatar}>
          <Text variant="bodyLargeBold" style={{ color: colors.accentDark }}>
            {initials(userName)}
          </Text>
        </View>
      </View>

      {/* Conectividade e fila sao estado permanente do app no canteiro, nao erro. */}
      {!isOnline ? (
        <View style={[styles.strip, styles.stripWarn]}>
          <WifiOff size={20} color={colors.warning} strokeWidth={1.9} />
          <Text variant="body" style={styles.stripText}>
            <Text variant="bodyBold" style={{ color: colors.warningText }}>Sem conexão</Text>
            <Text variant="body" style={{ color: colors.warningText }}> · nada se perde</Text>
          </Text>
        </View>
      ) : pendingCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver fila de envio"
          onPress={() => router.push('/(main)/fila' as never)}
          style={({ pressed }) => [styles.strip, styles.stripWarn, { opacity: pressed ? 0.75 : 1 }]}
        >
          <RefreshCw size={20} color={colors.warning} strokeWidth={1.9} />
          <Text variant="body" style={styles.stripText}>
            <Text variant="bodyBold" style={{ color: colors.warningText }}>
              {pendingCount === 1 ? '1 registro na fila' : `${pendingCount} registros na fila`}
            </Text>
            <Text variant="body" style={{ color: colors.warningText }}> · enviando</Text>
          </Text>
          <ChevronRight size={18} color={colors.warning} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );

  if (query.isLoading) {
    return (
      <View style={styles.root}>
        {header}
        <LoadingState label="Carregando obras..." />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.root}>
        {header}
        <ErrorState
          title="Erro ao carregar obras"
          description="Verifique sua conexão e tente novamente."
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  }

  const works = query.data ?? [];

  return (
    <View style={styles.root}>
      {header}
      {works.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="Nenhuma obra alocada"
          description="Você ainda não está alocado em nenhuma obra. Fale com seu engenheiro."
          cta={{ label: 'Verificar de novo', onPress: () => void query.refetch() }}
        />
      ) : (
        <FlatList
          data={works}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isLoading}
              onRefresh={() => void query.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => <WorkCard item={item} onPress={() => router.push({ pathname: '/(main)/obra/[workId]', params: { workId: item.id } })} />}
        />
      )}
    </View>
  );
}

function WorkCard({ item, onPress }: { item: WorkListItem; onPress: () => void }) {
  const status = STATUS_LABEL[item.status];
  const milestones = [...(item.work_milestones ?? [])].sort((a, b) => a.order_index - b.order_index);
  const current = milestones.find((m) => m.status !== 'approved');
  const currentIndex = current ? milestones.indexOf(current) + 1 : milestones.length;

  const planned = countEmbed(item.planned_posts);
  const poles = countEmbed(item.pole_installations);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadows.sm, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardTitleRow}>
          <Text variant="heading3" style={styles.cardTitle} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={[styles.pill, { backgroundColor: status.bg }]}>
            <Text variant="captionBold" style={{ color: status.fg }}>{status.label}</Text>
          </View>
        </View>
        {item.client_name ? (
          <Text variant="body" color="textSecondary" numberOfLines={1}>
            {item.client_name}
          </Text>
        ) : null}
      </View>

      {milestones.length > 0 ? (
        <View style={styles.rail}>
          <View style={styles.railBars}>
            {milestones.map((m) => (
              <View
                key={m.id}
                style={[styles.railBar, { backgroundColor: MILESTONE_TINT[m.status] ?? colors.border }]}
              />
            ))}
          </View>
          <Text variant="caption" color="textSecondary">
            {current ? `Marco ${currentIndex} de ${milestones.length} · ` : 'Todos os marcos aprovados'}
            {current ? <Text variant="captionBold" color="textPrimary">{current.name}</Text> : null}
          </Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Text variant="captionBold" color="textSecondary">
            {planned > 0 ? `${poles} de ${planned} postes` : `${poles} postes`}
          </Text>
        </View>
        <View style={styles.meta}>
          <Clock size={17} color={colors.textMuted} strokeWidth={1.8} />
          <Text variant="caption" color="textSecondary">{relativeTimePtBr(item.last_activity_at)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },

  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, gap: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.infoBg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  stripWarn: { backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder },
  stripText: { flex: 1 },

  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.huge, gap: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardHead: { gap: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: { flex: 1 },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },

  rail: { gap: spacing.sm },
  railBars: { flexDirection: 'row', gap: 6 },
  railBar: { flex: 1, height: 6, borderRadius: 999 },

  divider: { height: 1, backgroundColor: colors.border },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
