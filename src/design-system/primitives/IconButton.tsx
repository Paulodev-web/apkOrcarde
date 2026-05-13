import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'default' | 'ghost' | 'primary';

type Props = {
  icon: LucideIcon;
  size?: Size;
  variant?: Variant;
  onPress: () => void;
  accessibilityLabel: string;
};

const BOX: Record<Size, number> = { sm: 36, md: 44, lg: 48 };

export function IconButton({
  icon: Icon,
  size = 'md',
  variant = 'default',
  onPress,
  accessibilityLabel,
}: Props) {
  const box = Math.max(BOX[size], 48);
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'ghost'
        ? 'transparent'
        : colors.surfaceMuted;
  const iconColor =
    variant === 'primary' ? colors.textInverse : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        {
          width: box,
          height: box,
          backgroundColor: bg,
          borderRadius: radius.md,
          opacity: pressed ? 0.75 : 1,
          borderWidth: variant === 'default' ? 1 : 0,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.center}>
        <Icon size={22} color={iconColor} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
