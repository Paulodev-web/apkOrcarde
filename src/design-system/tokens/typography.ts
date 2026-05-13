export const typography = {
  heading1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  heading2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  heading3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
} as const;

export type TypographyVariant = keyof typeof typography;
