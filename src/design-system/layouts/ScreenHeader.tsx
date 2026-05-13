import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, Text as RNText } from 'react-native';

import { IconButton } from '@/design-system/primitives/IconButton';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type LeftAction = {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel?: string;
};

type RightAction = {
  icon: LucideIcon;
  onPress: () => void;
  badge?: number;
  accessibilityLabel?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  leftAction?: LeftAction;
  rightActions?: RightAction[];
  /** Custom right node (e.g. text button "Marcar todas") */
  rightSlot?: ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  leftAction,
  rightActions,
  rightSlot,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {leftAction ? (
          <IconButton
            icon={leftAction.icon}
            onPress={leftAction.onPress}
            accessibilityLabel={leftAction.accessibilityLabel ?? 'Menu'}
            variant="ghost"
          />
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
      <View style={styles.center}>
        <Text variant="heading3" color="textPrimary" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {rightSlot}
        {rightActions?.map((a, idx) => (
          <View key={String(idx)} style={styles.actionWrap}>
            <IconButton
              icon={a.icon}
              onPress={a.onPress}
              accessibilityLabel={a.accessibilityLabel ?? 'Ação'}
              variant="ghost"
            />
            {typeof a.badge === 'number' && a.badge > 0 ? (
              <View style={styles.badge}>
                <RNText style={styles.badgeText}>{a.badge > 99 ? '99+' : String(a.badge)}</RNText>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  left: {
    width: 56,
    alignItems: 'flex-start',
  },
  spacer: {
    width: 48,
    height: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  right: {
    minWidth: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  actionWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },
});
