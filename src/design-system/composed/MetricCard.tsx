import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/design-system/primitives/Card';
import { ProgressBar } from '@/design-system/primitives/ProgressBar';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Variant = 'default' | 'highlight' | 'warning' | 'danger';

type Props = {
  label: string;
  value: string;
  caption?: string;
  icon?: LucideIcon;
  variant?: Variant;
  progress?: number;
  onPress?: () => void;
};

const BORDER: Record<Variant, keyof typeof colors | undefined> = {
  default: undefined,
  highlight: 'primary',
  warning: 'warning',
  danger: 'danger',
};

export function MetricCard({
  label,
  value,
  caption,
  icon: Icon,
  variant = 'default',
  progress,
  onPress,
}: Props) {
  const borderColor = BORDER[variant] ? colors[BORDER[variant]!] : colors.border;

  return (
    <Card padding="lg" onPress={onPress} style={[styles.card, { borderColor, borderWidth: 1 }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="label" color="textSecondary" style={styles.labelUpper}>
            {label.toUpperCase()}
          </Text>
          <Text variant="heading2" color="textPrimary">
            {value}
          </Text>
          {caption ? (
            <Text variant="caption" color="textMuted" style={styles.caption}>
              {caption}
            </Text>
          ) : null}
        </View>
        {Icon ? <Icon size={28} color={colors.primary} strokeWidth={2} /> : null}
      </View>
      {typeof progress === 'number' ? (
        <View style={styles.bar}>
          <ProgressBar value={progress} variant={variant === 'danger' ? 'danger' : 'primary'} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
  },
  labelUpper: {
    marginBottom: spacing.xs,
  },
  caption: {
    marginTop: spacing.xs,
  },
  bar: {
    marginTop: spacing.md,
  },
});
