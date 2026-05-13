export const colors = {
  // Brand
  primary: '#1D3140',
  primaryAccent: '#64ABDE',
  primaryMid: '#223f52',
  primaryDark: '#16242F',
  accentDark: '#4A8FC2',

  // Surfaces
  surface: '#FFFFFF',
  surfaceMuted: '#F5F7FA',
  surfaceElevated: '#FFFFFF',

  // Shadows (iOS shadowColor)
  shadow: '#000000',

  // Borders
  border: '#E5E9EE',
  borderStrong: '#CBD5E1',

  // Text
  textPrimary: '#1D3140',
  textSecondary: '#5B6B7A',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Semantic
  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  info: '#0284C7',
  infoBg: '#E0F2FE',
  neutral: '#64748B',
  neutralBg: '#F1F5F9',

  // Severidade
  severityLow: '#94A3B8',
  severityMedium: '#D97706',
  severityHigh: '#DC2626',
  severityCritical: '#7F1D1D',
} as const;

export const gradients = {
  brand: ['#1D3140', '#64ABDE'],
  hero: ['#1D3140', '#223f52', '#64ABDE'],
  fab: ['#1D3140', '#64ABDE'],
} as const;

export type ColorKey = keyof typeof colors;
