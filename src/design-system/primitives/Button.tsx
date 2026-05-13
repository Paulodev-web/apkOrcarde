import type { LucideIcon } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  onPress: () => void;
  children: string;
  style?: StyleProp<ViewStyle>;
  /** When variant is ghost, render label in danger color */
  ghostDanger?: boolean;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 56 };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  onPress,
  children,
  style,
  ghostDanger = false,
}: Props) {
  const h = Math.max(HEIGHT[size], 48);
  const isDisabled = disabled || loading;

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.primary} />
      ) : Icon ? (
        <Icon
          size={20}
          color={
            variant === 'primary' || variant === 'danger'
              ? colors.textInverse
              : colors.primary
          }
          strokeWidth={2}
        />
      ) : null}
      <Text
        variant={size === 'sm' ? 'bodyBold' : 'bodyBold'}
        color={variant === 'primary' || variant === 'danger' ? 'textInverse' : 'primary'}
      >
        {children}
      </Text>
    </View>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          { minHeight: h, opacity: isDisabled ? 0.4 : pressed ? 0.85 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={[...gradients.brand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientFill, { minHeight: h }]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const ghostLabelColor = ghostDanger && variant === 'ghost' ? 'danger' : 'primary';
  const nonPrimaryIconColor =
    variant === 'ghost' && ghostDanger ? colors.danger : colors.primary;
  const bg =
    variant === 'danger'
      ? colors.danger
      : variant === 'secondary'
        ? colors.surface
        : 'transparent';
  const borderWidth = variant === 'secondary' ? 1 : 0;
  const borderColor = variant === 'secondary' ? colors.primary : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        {
          minHeight: h,
          backgroundColor: bg,
          borderWidth,
          borderColor,
          borderRadius: radius.md,
          opacity: isDisabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={[styles.rowCenter, { minHeight: h, paddingHorizontal: spacing.lg }]}>
        {loading ? (
          <ActivityIndicator
            color={variant === 'danger' ? colors.textInverse : nonPrimaryIconColor}
          />
        ) : Icon ? (
          <Icon size={20} color={variant === 'danger' ? colors.textInverse : nonPrimaryIconColor} strokeWidth={2} />
        ) : null}
        <Text
          variant="bodyBold"
          color={
            variant === 'danger'
              ? 'textInverse'
              : ghostLabelColor === 'danger'
                ? 'danger'
                : 'primary'
          }
          style={Icon || loading ? { marginLeft: spacing.sm } : undefined}
        >
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.md,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  gradientFill: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
