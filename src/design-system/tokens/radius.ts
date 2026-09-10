/**
 * Raios do web (0.375rem .. 1.125rem), um degrau mais generoso onde o dedo
 * encosta. Nada de pilula em cartao: pilula e para estado (badge, chip).
 */
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 20,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radius;
