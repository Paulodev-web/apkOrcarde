import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { shadows } from '@/design-system/tokens/shadows';

const INSTALLED = 24;
const PLANNED = 16;
const RING = 46;

type Props = {
  kind: 'installed' | 'planned';
  left: number;
  top: number;
  numbering?: string | null;
  selected?: boolean;
  /** Zoom da planta. O pino contra-escala para manter o tamanho na tela. */
  scale: SharedValue<number>;
};

/**
 * Marcação na planta. Instalado é um disco verde cheio; planejado é um anel
 * cinza vazado. A diferença é de FORMA, não só de cor: no sol do canteiro,
 * verde e cinza do mesmo tamanho são a mesma coisa.
 *
 * Não captura toque: quem decide o que fazer com o dedo é a tela, a partir do
 * toque que o viewport entrega. Um pino que capturasse gesto brigaria com a
 * pinça e com o arraste, e no campo isso vira poste marcado sem querer.
 *
 * ## Sobre a contra-escala
 *
 * O pino vive DENTRO da view de conteúdo, que já está multiplicada por
 * `scale`. Então o tamanho que chega na tela é `size × counter × scale`, e para
 * ele valer `size` a contra-escala tem que ser exatamente `1 / scale`.
 *
 * Antes daqui estava `fitScale / scale`, e o `scale` se cancelava: sobrava
 * `size × fitScale` como tamanho final. Como `fitScale` é por construção
 * `1 / PLAN_RENDER_SCALE`, o pino de 22 px era desenhado com 5,5 px, enquanto o
 * raio de acerto do dedo continuava valendo 26 px. Daí a sensação de que o
 * toque pegava no lugar errado: a área sensível era quase cinco vezes maior que
 * o desenho.
 */
export function PolePin({
  kind,
  left,
  top,
  numbering,
  selected = false,
  scale,
}: Props) {
  const installed = kind === 'installed';
  const size = installed ? INSTALLED : PLANNED;

  const counter = useAnimatedStyle(() => ({
    // O piso evita divisão por zero no primeiro quadro, antes de a planta ter
    // geometria. Sem ele o pino some com `Infinity` na transformada.
    transform: [{ scale: 1 / Math.max(scale.value, 0.0001) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.anchor, { left, top }, counter]}>
      {selected ? <Animated.View style={styles.ring} /> : null}

      <Animated.View
        style={[
          styles.dot,
          installed ? shadows.sm : null,
          {
            width: size,
            height: size,
            left: -size / 2,
            top: -size / 2,
            backgroundColor: installed ? colors.success : 'transparent',
            borderColor: installed ? '#FFFFFF' : colors.textDisabled,
            borderWidth: 3,
          },
        ]}
      />

      {/*
        Numeração só no pino selecionado.

        A primeira versão mostrava em todos acima de um limiar de zoom, e o
        resultado em obra real foi uma cascata de etiquetas cobrindo justamente
        o traçado que o gerente precisa ler: nesta obra os 9 postes de projeto
        estão numa diagonal curta, então elas colidem em qualquer zoom. O
        limiar era a variável errada — o que atrapalha é a densidade de postes
        na tela, não a aproximação.
      */}
      {numbering && selected ? (
        <Animated.View style={styles.labelBox}>
          <Text variant="caption" color="textInverse" numberOfLines={1} style={styles.labelText}>
            {numbering}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    left: -RING / 2,
    top: -RING / 2,
    borderRadius: 999,
    backgroundColor: 'rgba(68, 114, 180, 0.18)',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dot: { borderRadius: 999, position: 'absolute' },
  // Caixa de largura fixa centrada no pino: a âncora tem 0 de largura, então
  // centralizar depende de deslocar metade da caixa para a esquerda.
  labelBox: {
    position: 'absolute',
    width: 120,
    left: -60,
    top: -38,
    alignItems: 'center',
  },
  labelText: {
    backgroundColor: 'rgba(24, 24, 22, 0.78)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
