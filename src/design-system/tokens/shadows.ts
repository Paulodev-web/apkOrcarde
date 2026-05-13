import type { ViewStyle } from 'react-native';

import { colors } from './colors';

export const shadows = {
  none: {} as ViewStyle,
  sm: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } as ViewStyle,
  md: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } as ViewStyle,
} as const;

export type ShadowKey = keyof typeof shadows;
