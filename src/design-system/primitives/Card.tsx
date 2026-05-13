import type { ReactNode } from 'react';
import {
  StyleSheet,
  type StyleProp,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { shadows } from '@/design-system/tokens/shadows';
import { spacing, type SpacingKey } from '@/design-system/tokens/spacing';

type Props = {
  children: ReactNode;
  padding?: SpacingKey;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padding = 'lg', onPress, style }: Props) {
  const pad = spacing[padding];
  const base = [styles.card, { padding: pad }, shadows.sm, style];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={base}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
