import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertTriangle,
  Bell,
  FileText,
  Flag,
  ListChecks,
  MapPin,
  Menu,
  MessageCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/design-system/primitives/Text';
import { Card } from '@/design-system/primitives/Card';
import { ScreenContainer } from '@/design-system/layouts/ScreenContainer';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors, gradients } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { resolveDeepLink } from '@/lib/notifications/links';
import { supabase } from '@/lib/supabase/client';
import { useNotificationStore } from '@/stores/notification.store';
import { useSessionStore } from '@/stores/session.store';
import type { AppNotification, NotificationKind } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

const NOTIFS_QUERY_KEY = ['notifications', 'feed'] as const;
const PAGE_SIZE = 50;

function startOfLocalDay(d: Date): number {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t.getTime();
}

function bucketFor(createdAt: string): 'Hoje' | 'Ontem' | 'Esta semana' | 'Mais antigas' {
  const d = new Date(createdAt);
  const now = new Date();
  const dayDiff = Math.floor((startOfLocalDay(now) - startOfLocalDay(d)) / 86400000);
  if (dayDiff === 0) return 'Hoje';
  if (dayDiff === 1) return 'Ontem';
  if (dayDiff < 7) return 'Esta semana';
  return 'Mais antigas';
}

function iconForKind(kind: NotificationKind): LucideIcon {
  switch (kind) {
    case 'message_received':
      return MessageCircle;
    case 'daily_log_approved':
    case 'daily_log_rejected':
      return FileText;
    case 'milestone_approved':
    case 'milestone_rejected':
      return Flag;
    case 'checklist_validated':
    case 'checklist_returned':
      return ListChecks;
    case 'alert_closed':
      return AlertTriangle;
    case 'pole_installed':
      return MapPin;
    default:
      return Bell;
  }
}

async function fetchNotifications(
  userId: string,
  cursor?: string,
): Promise<AppNotification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

const SECTION_ORDER = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'] as const;

export default function NotificacoesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id ?? '');
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: [...NOTIFS_QUERY_KEY, userId],
    queryFn: () => fetchNotifications(userId),
    enabled: userId.length > 0,
  });

  useEffect(() => {
    if (userId) {
      void fetchUnreadCount(userId).then(setUnreadCount);
    }
  }, [userId, setUnreadCount]);

  useRealtimeChannel({
    channelName: `user:${userId}:notifications`,
    table: 'notifications',
    event: 'INSERT',
    filter: `user_id=eq.${userId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [...NOTIFS_QUERY_KEY, userId] });
      void fetchUnreadCount(userId).then(setUnreadCount);
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: [...NOTIFS_QUERY_KEY, userId] });
      const count = await fetchUnreadCount(userId);
      setUnreadCount(count);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, userId, setUnreadCount]);

  const handleMarkAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    setUnreadCount(0);
    void queryClient.invalidateQueries({ queryKey: [...NOTIFS_QUERY_KEY, userId] });
  }, [userId, queryClient, setUnreadCount]);

  const handleTapNotification = useCallback(
    async (notif: AppNotification) => {
      if (!notif.is_read) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
        useNotificationStore.getState().decrementUnread();
        void queryClient.invalidateQueries({
          queryKey: [...NOTIFS_QUERY_KEY, userId],
        });
      }

      if (notif.link_path) {
        const resolved = resolveDeepLink(notif.link_path);
        if (resolved) {
          router.push(resolved as never);
          return;
        }
      }
    },
    [router, queryClient, userId],
  );

  const notifications = useMemo(() => query.data ?? [], [query.data]);

  const sections = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const n of notifications) {
      const b = bucketFor(n.created_at);
      const arr = map.get(b) ?? [];
      arr.push(n);
      map.set(b, arr);
    }
    return SECTION_ORDER.filter((title) => (map.get(title)?.length ?? 0) > 0).map((title) => ({
      title,
      data: map.get(title) ?? [],
    }));
  }, [notifications]);

  const markAllSlot = (
    <Pressable
      onPress={() => void handleMarkAllRead()}
      accessibilityRole="button"
      accessibilityLabel="Marcar todas como lidas"
      style={({ pressed }) => [styles.markAll, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text variant="bodyBold" color="primary">
        Marcar lidas
      </Text>
    </Pressable>
  );

  return (
    <ScreenContainer scrollable={false} noPadding background="muted">
      <ScreenHeader
        title="Notificações"
        leftAction={{
          icon: Menu,
          onPress: () => navigation.dispatch(DrawerActions.openDrawer()),
          accessibilityLabel: 'Abrir menu',
        }}
        rightSlot={markAllSlot}
      />
      <View style={styles.body}>
        {query.isLoading ? (
          <Text variant="body" color="textSecondary" style={styles.center}>
            Carregando...
          </Text>
        ) : notifications.length === 0 ? (
          <Text variant="body" color="textSecondary" style={styles.center}>
            Nenhuma notificacao
          </Text>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section: { title } }) => (
              <Text variant="label" color="textMuted" style={styles.sectionTitle}>
                {title.toUpperCase()}
              </Text>
            )}
            renderItem={({ item }) => {
              const Icon = iconForKind(item.kind);
              return (
                <Pressable
                  onPress={() => void handleTapNotification(item)}
                  accessibilityRole="button"
                  style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
                >
                  <Card padding="md" style={styles.card}>
                    <View style={styles.row}>
                      <LinearGradientAvatar
                        icon={Icon}
                        useGradient={!item.is_read}
                      />
                      <View style={styles.textCol}>
                        <Text
                          variant={item.is_read ? 'body' : 'bodyBold'}
                          color="textPrimary"
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>
                        <Text variant="caption" color="textSecondary" numberOfLines={2}>
                          {item.body}
                        </Text>
                        <Text variant="caption" color="textMuted" style={styles.time}>
                          {relativeTimePtBr(item.created_at)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void handleRefresh()}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}

function LinearGradientAvatar({
  icon: Icon,
  useGradient,
}: {
  icon: LucideIcon;
  useGradient: boolean;
}) {
  if (useGradient) {
    return (
      <LinearGradient
        colors={[...gradients.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatarCircle}
      >
        <Icon size={22} color={colors.textInverse} strokeWidth={2} />
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.avatarCircle, { backgroundColor: colors.neutralBg }]}>
      <Icon size={22} color={colors.primary} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  center: {
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  list: {
    paddingBottom: spacing.huge,
  },
  sectionTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  time: {
    marginTop: spacing.xs,
  },
  markAll: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});
