import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/design-system/primitives/Text';
import { colors, gradients } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { shadows } from '@/design-system/tokens/shadows';
import { spacing } from '@/design-system/tokens/spacing';

type Position = 'bottom-right' | 'bottom-center';

type Props = {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  position?: Position;
  extended?: { label: string };
};

export function FAB({
  icon: Icon,
  onPress,
  accessibilityLabel,
  position = 'bottom-right',
  extended,
}: Props) {
  const bottom = spacing.xxl;
  const horizontal = spacing.xxl;

  const posStyle =
    position === 'bottom-center'
      ? { bottom, alignSelf: 'center' as const }
      : { bottom, right: horizontal };

  if (extended) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={[styles.abs, posStyle]}
      >
        <LinearGradient
          colors={gradients.fab}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.extended, shadows.md]}
        >
          <Icon size={24} color={colors.textInverse} strokeWidth={2} />
          <Text variant="bodyBold" color="textInverse" style={styles.extLabel}>
            {extended.label}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.abs, posStyle]}
    >
      <LinearGradient
        colors={gradients.fab}
        style={[styles.round, shadows.md]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Icon size={26} color={colors.textInverse} strokeWidth={2} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
    zIndex: 20,
  },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extended: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    gap: spacing.sm,
  },
  extLabel: {
    marginLeft: spacing.xs,
  },
});
