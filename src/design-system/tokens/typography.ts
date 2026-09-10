/**
 * Escala de texto do campo.
 *
 * O piso e 15 px, nao 14: o gerente le sob sol forte, em aparelho barato,
 * as vezes com o celular no bolso do peito. Cada degrau da escala do web
 * subiu um ponto ou dois aqui; a familia e a mesma (system font, Roboto no
 * Android), sem webfont — sem requisicao externa e sem FOUT no canteiro.
 *
 * letterSpacing negativo nos titulos acompanha o web: texto grande com
 * tracking padrao parece frouxo.
 */
export const typography = {
  /** Titulo de tela: "Obras". */
  display: { fontSize: 27, fontWeight: '700' as const, lineHeight: 32, letterSpacing: -0.5 },

  heading1: { fontSize: 27, fontWeight: '700' as const, lineHeight: 32, letterSpacing: -0.5 },
  /** Titulo de obra no cabecalho. */
  heading2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 25, letterSpacing: -0.3 },
  /** Titulo de cartao. */
  heading3: { fontSize: 19, fontWeight: '600' as const, lineHeight: 24, letterSpacing: -0.2 },

  /** Item de lista, rotulo de campo. */
  bodyLarge: { fontSize: 17, fontWeight: '400' as const, lineHeight: 24 },
  bodyLargeBold: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },

  /** Corpo padrao. Piso do sistema. */
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },

  /** Apoio: metadado, horario, contagem. */
  caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 19 },
  captionBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 19 },

  /** Cabecalho de secao, em caixa alta. */
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 16,
    letterSpacing: 0.9,
  },

  /** Numero grande de metrica. Usar com fontVariant tabular-nums. */
  metric: { fontSize: 24, fontWeight: '700' as const, lineHeight: 28, letterSpacing: -0.5 },
} as const;

export type TypographyVariant = keyof typeof typography;
