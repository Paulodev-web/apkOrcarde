import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import {
  Bell,
  HardHat,
  Info,
  LogOut,
  RefreshCw,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '@/design-system/primitives/Avatar';
import { Badge } from '@/design-system/primitives/Badge';
import { Button } from '@/design-system/primitives/Button';
import { Divider } from '@/design-system/primitives/Divider';
import { Text } from '@/design-system/primitives/Text';
import { colors, gradients } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { logoutWithGuard } from '@/lib/auth/logout';
import { useConnectivityStore } from '@/stores/connectivity.store';
import { useNotificationStore } from '@/stores/notification.store';
import { useSessionStore } from '@/stores/session.store';
import { useSyncStore } from '@/stores/sync.store';

function roleLabel(role: 'engineer' | 'manager' | null): string {
  if (role === 'engineer') return 'Engenheiro';
  if (role === 'manager') return 'Gerente de obra';
  return 'Perfil';
}

function DrawerItem({
  icon: Icon,
  label,
  badge,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.75 : 1 }]}
    >
      <Icon size={22} color={colors.primary} strokeWidth={2} />
      <Text variant="body" color="textPrimary" style={styles.itemLabel}>
        {label}
      </Text>
      {typeof badge === 'number' && badge > 0 ? (
        <View style={styles.badgePill}>
          <Text variant="caption" color="textInverse">
            {badge > 99 ? '99+' : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function DrawerContent({ navigation }: DrawerContentComponentProps) {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.role);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const version =
    Constants.expoConfig?.version ??
    (Constants as { nativeAppVersion?: string }).nativeAppVersion ??
    '1.0.0';

  return (
    <DrawerContentScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <LinearGradient colors={[...gradients.brand]} style={styles.headerGradient}>
          <Avatar name={user?.fullName ?? 'Usuário'} size="xl" gradient={false} />
          <Text variant="heading3" color="textInverse" style={styles.name}>
            {user?.fullName ?? '—'}
          </Text>
          <Text variant="caption" color="textInverse" style={styles.email}>
            {user?.email ?? ''}
          </Text>
          <View style={styles.roleBadge}>
            <Badge variant="info">{roleLabel(role)}</Badge>
          </View>
        </LinearGradient>
      </View>

      <Divider />

      <View style={styles.items}>
        <DrawerItem
          icon={HardHat}
          label="Obras"
          onPress={() => navigation.navigate('index')}
        />
        <DrawerItem
          icon={Bell}
          label="Notificações"
          badge={unreadCount}
          onPress={() => navigation.navigate('notificacoes')}
        />
        <DrawerItem
          icon={RefreshCw}
          label="Fila de sincronização"
          badge={pendingCount}
          onPress={() => navigation.navigate('fila')}
        />
        <DrawerItem
          icon={Settings}
          label="Configurações"
          onPress={() => navigation.navigate('configuracoes')}
        />
        <DrawerItem icon={Info} label="Sobre" onPress={() => navigation.navigate('sobre')} />
      </View>

      <View style={styles.flexSpacer} />

      <View style={styles.connectivity}>
        <View
          style={[
            styles.dot,
            { backgroundColor: isOnline ? colors.success : colors.textMuted },
          ]}
        />
        <Text variant="caption" color={isOnline ? 'success' : 'textMuted'}>
          {isOnline ? 'Online' : 'Sem conexão'}
        </Text>
      </View>

      <Divider />

      <View style={styles.footer}>
        <Text variant="caption" color="textMuted">
          Versão {version}
        </Text>
        <Button
          variant="ghost"
          icon={LogOut}
          onPress={() => logoutWithGuard(queryClient)}
          style={styles.logout}
        >
          Sair
        </Button>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 0,
  },
  headerGradient: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  name: {
    marginTop: spacing.md,
  },
  email: {
    marginTop: spacing.xs,
    opacity: 0.85,
  },
  roleBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  items: {
    paddingVertical: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  itemLabel: {
    flex: 1,
  },
  badgePill: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 22,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexSpacer: {
    flex: 1,
    minHeight: spacing.lg,
  },
  connectivity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  logout: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
});
