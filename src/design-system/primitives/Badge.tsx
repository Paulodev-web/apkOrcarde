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

const FG: Record<BadgeVariant, ColorKey> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'neutral',
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
      {Icon ? <Icon size={14} color={colors[FG[variant]]} strokeWidth={2} /> : null}
      <Text variant="caption" color={FG[variant]}>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
});
