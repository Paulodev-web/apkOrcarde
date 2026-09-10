import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
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
  /** Distancia do rodape. `bottom-center` sobe para pousar sobre a barra. */
  bottom?: number;
};

/**
 * Acao de registro. Chapado em accent-600 — sem degrade, igual ao botao.
 *
 * O anel na cor do fundo da tela e o que separa o FAB da barra de navegacao
 * quando ele pousa em cima dela (`bottom-center`), sem precisar de degrade
 * nem de sombra pesada.
 */
export function FAB({
  icon: Icon,
  onPress,
  accessibilityLabel,
  position = 'bottom-right',
  extended,
  bottom,
}: Props) {
  const b = bottom ?? spacing.xxl;

  const posStyle =
    position === 'bottom-center'
      ? { bottom: b, alignSelf: 'center' as const }
      : { bottom: b, right: spacing.xxl };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.abs, posStyle, { opacity: pressed ? 0.9 : 1 }]}
    >
      {extended ? (
        <View style={[styles.extended, shadows.lg]}>
          <Icon size={24} color={colors.textInverse} strokeWidth={2.2} />
          <Text variant="bodyLargeBold" color="textInverse">
            {extended.label}
          </Text>
        </View>
      ) : (
        <View style={[styles.round, shadows.lg]}>
          <Icon size={30} color={colors.textInverse} strokeWidth={2.4} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
    zIndex: 20,
  },
  round: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extended: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.surfaceMuted,
    gap: spacing.sm,
  },
});
