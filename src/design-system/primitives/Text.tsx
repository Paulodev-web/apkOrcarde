import type { ReactNode } from 'react';
import { Text as RNText, type TextStyle } from 'react-native';

import { colors, type ColorKey } from '@/design-system/tokens/colors';
import { typography, type TypographyVariant } from '@/design-system/tokens/typography';

type TextVariant = TypographyVariant;

type Props = {
  variant?: TextVariant;
  color?: ColorKey;
  children: ReactNode;
  numberOfLines?: number;
  style?: TextStyle;
};

export function Text({
  variant = 'body',
  color = 'textPrimary',
  children,
  numberOfLines,
  style,
}: Props) {
  const t = typography[variant];
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: t.fontSize,
          fontWeight: t.fontWeight,
          lineHeight: t.lineHeight,
          ...(variant === 'label' && 'letterSpacing' in t ? { letterSpacing: t.letterSpacing } : {}),
          color: colors[color],
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
