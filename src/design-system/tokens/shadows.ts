import type { ViewStyle } from 'react-native';

import { colors } from './colors';

/**
 * Sombra tingida de quente (colors.shadow ~ oklch(0.24 0.01 100)), nunca preto
 * puro: sombra neutra-fria sobre fundo creme suja a cor.
 *
 * Opacidades baixas de proposito. No repouso o cartao e quase plano; so o que
 * flutua de verdade (FAB, folha) usa `lg`.
 */
export const shadows = {
  none: {} as ViewStyle,
  /** Cartao em repouso: quase plano, a borda e que separa. */
  sm: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  } as ViewStyle,
  /** Cartao em destaque (o "Agora" da tela da obra). */
  md: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  } as ViewStyle,
  /** FAB e folha de baixo — o que realmente flutua sobre o conteudo. */
  lg: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } as ViewStyle,
} as const;

export type ShadowKey = keyof typeof shadows;
