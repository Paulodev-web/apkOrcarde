/**
 * Paleta do APK de campo.
 *
 * Mesmas rampas do portal web (`src/app/globals.css` + `MD/DESIGN_SYSTEM.md`):
 * neutro quente hue 100 e accent slate blue hue 258, gerados em OKLCH. Alterou
 * um lado, altere o outro.
 *
 * O que muda no campo: nada de cor. Muda a escala (typography.ts) e o tamanho
 * do alvo — o gerente le sob sol forte, de luva, num aparelho barato.
 *
 * Regra que vale aqui igual ao web:
 *   accent[500] e a cor da MARCA  — bordas, aneis de foco, realces
 *   accent[600] e a cor da ACAO   — unico preenchimento com texto branco (4.88:1)
 * Preenchimento com branco por cima e SEMPRE o degrau 600, nunca o 500.
 */

/** Neutro quente. Substitui gray/slate/zinc/stone. */
export const neutral = {
  50: '#fafaf8',
  100: '#f5f4f1',
  200: '#e9e8e3',
  300: '#d6d5ce',
  400: '#aaa9a2',
  // Fechado alem da curva OKLCH de proposito: no tom "puro" (#84837b) dava
  // 3.45:1 sobre branco e reprovava em AA como texto secundario.
  500: '#767469',
  600: '#67665f',
  700: '#504f48',
  800: '#353530',
  900: '#262623',
  950: '#181816',
} as const;

/** Accent slate blue. Substitui blue/sky/indigo. */
export const accent = {
  50: '#f2f6fd',
  100: '#e3edfb',
  200: '#c9dcf8',
  300: '#a7c4f0',
  400: '#7ea6e2',
  500: '#5f8dd1',
  600: '#4472b4',
  700: '#355a92',
  800: '#2b4874',
  900: '#253b5c',
  950: '#152338',
} as const;

/** Semanticas: mesmo croma contido do accent. Sinalizam sem gritar. */
export const green = { 50: '#eff7f0', 100: '#e0efe3', 200: '#c5e1ca', 600: '#357d49', 700: '#286438', 800: '#22512e' } as const;
export const teal = { 50: '#eff6f6', 100: '#dfeeee', 200: '#c2e0df', 600: '#257a7b', 700: '#1a6162', 800: '#184f4f' } as const;
export const amber = { 50: '#f9f3ed', 100: '#f5e8dd', 200: '#ecd4bf', 600: '#925f26', 700: '#764b1b', 800: '#5f3d18' } as const;
export const orange = { 50: '#fdf2ee', 100: '#fce5dd', 200: '#f9cebf', 600: '#a94c29', 700: '#893b1e', 800: '#6e311a' } as const;
export const red = { 50: '#fef1ef', 100: '#fee4e0', 200: '#fccbc5', 600: '#ae443d', 700: '#8d352e', 800: '#722c27' } as const;

export const colors = {
  // ── Marca e acao ───────────────────────────────────────────────────────
  /** Cor da ACAO: preenchimento de botao, aba ativa, foco, spinner. */
  primary: accent[600],
  /** Cor da MARCA: bordas de realce, icone sobre superficie clara. */
  primaryAccent: accent[500],
  primaryMid: accent[700],
  primaryDark: accent[900],
  accentDark: accent[800],
  /** Sobre fundo escuro (capa do login, folha do Registrar). */
  onDark: accent[300],

  // ── Superficies ────────────────────────────────────────────────────────
  /** Cartao, modal, barra. */
  surface: '#FFFFFF',
  /** Fundo da tela — creme, nunca branco puro. */
  surfaceMuted: neutral[50],
  /** Superficie rebaixada: trilho de navegacao, hover sutil. */
  surfaceSunken: neutral[100],
  surfaceElevated: '#FFFFFF',

  // ── Sombra: tingida de quente. Sombra fria sobre creme suja a cor. ─────
  shadow: '#38362c',

  // ── Bordas ─────────────────────────────────────────────────────────────
  border: neutral[200],
  borderStrong: neutral[300],
  borderAccent: accent[200],

  // ── Texto ──────────────────────────────────────────────────────────────
  textPrimary: neutral[900],
  textSecondary: neutral[600],
  textMuted: neutral[500],
  textDisabled: neutral[400],
  textInverse: '#FFFFFF',
  /** Texto sobre preenchimento accent escuro. */
  textOnDark: accent[200],

  // ── Semanticas: fundo -50/-100, texto -700, borda -200 ─────────────────
  success: green[600],
  successBg: green[50],
  successBorder: green[200],
  successText: green[700],

  progress: teal[600],
  progressBg: teal[100],
  progressText: teal[700],

  warning: amber[600],
  warningBg: amber[50],
  warningBorder: amber[200],
  warningText: amber[700],

  danger: red[600],
  dangerBg: red[50],
  dangerBorder: red[200],
  dangerText: red[700],

  info: accent[600],
  infoBg: accent[50],
  infoBorder: accent[200],
  infoText: accent[800],

  neutral: neutral[500],
  neutralBg: neutral[100],

  // ── Severidade de alerta ───────────────────────────────────────────────
  severityLow: neutral[500],
  severityMedium: amber[600],
  severityHigh: red[600],
  severityCritical: red[800],
} as const;

/**
 * Gradiente e atmosfera, nunca hierarquia — a regra do web vale aqui.
 * Profundidade na UI vem de borda + sombra baixa. Unico uso legitimo: a capa
 * do login. Botao, FAB e cartao sao chapados.
 */
export const gradients = {
  brand: [accent[900], accent[700]],
  hero: [accent[900], accent[800], accent[600]],
  fab: [accent[600], accent[600]],
} as const;

export type ColorKey = keyof typeof colors;
