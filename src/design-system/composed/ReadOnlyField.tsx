import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  label: string;
  value: string | ReactNode;
  icon?: LucideIcon;
};

export function ReadOnlyField({ label, value, icon: Icon }: Props) {
  return (
    <View style={styles.row}>
      {Icon ? (
        <View style={styles.icon}>
          <Icon size={20} color={colors.textMuted} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        {typeof value === 'string' ? (
          <Text variant="bodyBold" color="textPrimary" style={styles.val}>
            {value}
          </Text>
        ) : (
          <View style={styles.val}>{value}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    minHeight: 48,
  },
  icon: {
    marginRight: spacing.sm,
    paddingTop: spacing.xs,
  },
  flex: {
    flex: 1,
  },
  val: {
    marginTop: spacing.xs,
  },
});
