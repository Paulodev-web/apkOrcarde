import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/design-system/primitives/Card';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  title: string;
  subtitle?: string;
  description?: string;
  leftAccent?: { color: string; width?: number };
  rightIcon?: LucideIcon;
  badges?: ReactNode;
  metadata?: ReactNode;
  onPress: () => void;
};

export function ListItemCard({
  title,
  subtitle,
  description,
  leftAccent,
  rightIcon: RightIcon,
  badges,
  metadata,
  onPress,
}: Props) {
  const w = leftAccent?.width ?? 4;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <Card padding="lg" style={styles.card}>
        <View style={styles.row}>
          {leftAccent ? (
            <View style={[styles.accent, { width: w, backgroundColor: leftAccent.color }]} />
          ) : null}
          <View style={styles.main}>
            <View style={styles.titleRow}>
              <Text variant="bodyBold" color="textPrimary" numberOfLines={2} style={styles.flex}>
                {title}
              </Text>
              {RightIcon ? (
                <RightIcon size={22} color={colors.textMuted} strokeWidth={2} />
              ) : null}
            </View>
            {badges ? <View style={styles.badges}>{badges}</View> : null}
            {subtitle ? (
              <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.mt}>
                {subtitle}
              </Text>
            ) : null}
            {description ? (
              <Text variant="caption" color="textMuted" numberOfLines={2} style={styles.mt}>
                {description}
              </Text>
            ) : null}
            {metadata ? <View style={styles.meta}>{metadata}</View> : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  accent: {
    borderRadius: 2,
    marginRight: spacing.md,
    alignSelf: 'stretch',
    minHeight: 48,
  },
  main: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  badges: {
    marginTop: spacing.xs,
  },
  mt: {
    marginTop: spacing.xs,
  },
  meta: {
    marginTop: spacing.sm,
  },
});
