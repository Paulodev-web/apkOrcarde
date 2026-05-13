import { StyleSheet, View } from 'react-native';

import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';

type Variant = 'primary' | 'success' | 'danger';

type Props = {
  value: number;
  variant?: Variant;
  height?: number;
};

const FILL: Record<Variant, keyof typeof colors> = {
  primary: 'primary',
  success: 'success',
  danger: 'danger',
};

export function ProgressBar({
  value,
  variant = 'primary',
  height = 8,
}: Props) {
  const clamped = Math.min(1, Math.max(0, value));
  const fillKey = FILL[variant];

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: colors[fillKey],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.neutralBg,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.full,
  },
});
