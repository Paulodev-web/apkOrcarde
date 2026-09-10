import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, type ColorKey } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';

import { Text } from './Text';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type Props = {
  variant: BadgeVariant;
  children: string;
  icon?: LucideIcon;
  style?: ViewStyle;
};

const BG: Record<BadgeVariant, ColorKey> = {
  success: 'successBg',
  warning: 'warningBg',
  danger: 'dangerBg',
  info: 'infoBg',
  neutral: 'neutralBg',
};

// Texto do badge e o degrau -700, nao o -600: -600 e preenchimento com branco
// por cima. Lido sobre o fundo -50, o -700 e o que passa em AA.
const FG: Record<BadgeVariant, ColorKey> = {
  success: 'successText',
  warning: 'warningText',
  danger: 'dangerText',
  info: 'infoText',
  neutral: 'textSecondary',
};

export function Badge({ variant, children, icon: Icon, style }: Props) {
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors[BG[variant]] },
        style,
      ]}
    >
      {Icon ? <Icon size={15} color={colors[FG[variant]]} strokeWidth={2} /> : null}
      <Text variant="captionBold" color={FG[variant]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
});
