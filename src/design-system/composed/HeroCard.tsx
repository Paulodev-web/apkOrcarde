import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { gradients } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing, type SpacingKey } from '@/design-system/tokens/spacing';

type GradientKey = keyof typeof gradients;

type Props = {
  gradient?: GradientKey;
  children: ReactNode;
  padding?: SpacingKey;
};

export function HeroCard({
  gradient = 'brand',
  children,
  padding = 'lg',
}: Props) {
  const pad = spacing[padding];
  return (
    <LinearGradient
      colors={[...gradients[gradient]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, { padding: pad, borderRadius: radius.xl }]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
});
