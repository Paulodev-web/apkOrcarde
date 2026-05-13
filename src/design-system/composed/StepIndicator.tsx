import { StyleSheet, View } from 'react-native';

import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  totalSteps: number;
  currentStep: number;
};

const DOT = 10;

export function StepIndicator({ totalSteps, currentStep }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const bg = done ? colors.success : active ? colors.primary : colors.border;
        return <View key={String(i)} style={[styles.dot, { backgroundColor: bg }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radius.full,
  },
});
