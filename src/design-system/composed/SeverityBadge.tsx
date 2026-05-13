import { StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import type { AlertSeverity } from '@/types';

type Props = {
  severity: AlertSeverity;
};

const LABEL: Record<AlertSeverity, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const BG: Record<AlertSeverity, keyof typeof colors> = {
  low: 'severityLow',
  medium: 'severityMedium',
  high: 'severityHigh',
  critical: 'severityCritical',
};

export function SeverityBadge({ severity }: Props) {
  const bg = colors[BG[severity]];
  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <Text variant="caption" color="textInverse">
        {LABEL[severity]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
});
