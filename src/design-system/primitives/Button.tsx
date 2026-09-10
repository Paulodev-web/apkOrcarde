import type { LucideIcon } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/design-system/tokens/colors';
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
  /** Ocupa a largura toda. Padrao das acoes de campo. */
  block?: boolean;
  /** When variant is ghost, render label in danger color */
  ghostDanger?: boolean;
};

// Piso de 48 px vale para todo tamanho: e o alvo minimo com luva.
const HEIGHT: Record<ButtonSize, number> = { sm: 48, md: 52, lg: 56 };

/**
 * Uma acao primaria por tela. Duas lado a lado significa que uma delas devia
 * ser `secondary`.
 *
 * Sem degrade: o preenchimento primario e accent-600 chapado (branco por cima
 * da 4.88:1). Degrade em botao e o que mais envelhece uma interface, e o
 * sistema do web ja proibe — a profundidade aqui vem de borda e sombra.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  onPress,
  children,
  style,
  block = false,
  ghostDanger = false,
}: Props) {
  const h = HEIGHT[size];
  const isDisabled = disabled || loading;
  const onFill = variant === 'primary' || variant === 'danger';

  const labelColor = onFill
    ? 'textInverse'
    : variant === 'ghost' && ghostDanger
      ? 'danger'
      : 'primary';
  const inkColor = onFill
    ? colors.textInverse
    : variant === 'ghost' && ghostDanger
      ? colors.danger
      : colors.primary;

  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surface
          : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        block ? styles.block : styles.hug,
        {
          minHeight: h,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: variant === 'secondary' ? colors.borderStrong : 'transparent',
          opacity: isDisabled ? 0.4 : pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      <View style={[styles.row, { minHeight: h }]}>
        {loading ? (
          <ActivityIndicator color={inkColor} />
        ) : Icon ? (
          <Icon size={20} color={inkColor} strokeWidth={2.1} />
        ) : null}
        <Text variant="bodyLargeBold" color={labelColor}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  hug: { alignSelf: 'flex-start' },
  block: { alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
