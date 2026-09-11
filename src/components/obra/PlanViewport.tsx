import { Maximize, Minus, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { IconButton } from '@/design-system/primitives/IconButton';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';

/** Quanto dá para aproximar além do encaixe inicial. */
const MAX_ZOOM = 10;
const ZOOM_STEP = 1.7;

/**
 * Janela entre o primeiro e o segundo toque do duplo.
 *
 * Todo toque simples só vale depois de o duplo desistir, então esta janela é
 * latência paga em TODO toque. O padrão do RNGH (500 ms) faz a planta parecer
 * travada no dedo. 220 ms ainda dá para dar um duplo confortável e corta a
 * espera pela metade.
 */
const DOUBLE_TAP_WINDOW = 220;

type Rect = { x: number; y: number; width: number; height: number };

type Props = {
  viewportW: number;
  viewportH: number;
  /** Tamanho real do conteúdo — pode ser bem maior que o viewport. */
  contentW: number;
  contentH: number;
  /** Toque simples, já convertido para coordenada DO CONTEÚDO. */
  onTap?: (contentX: number, contentY: number, scale: number) => void;
  /**
   * Zoom atual, criado por quem chama. Sai daqui porque os pinos precisam
   * dele para não engordar junto com a planta.
   */
  scale: SharedValue<number>;
  /**
   * Retângulo, em coordenadas de conteúdo, que a abertura deve enquadrar.
   * Sem ele a planta abre inteira, que numa prancha de projeto significa
   * abrir na legenda e no carimbo.
   */
  initialFocus?: Rect | null;
  /**
   * A geometria já é a definitiva.
   *
   * Enquanto o PDF não informa o tamanho da página, quem chama não sabe a
   * proporção e chuta 1:1. Enquadrar de abertura em cima desse chute gravaria
   * um enquadramento errado que nunca mais seria refeito, porque a abertura
   * acontece uma vez só.
   */
  ready?: boolean;
  children: ReactNode;
};

/**
 * Planta que o gerente pode aproximar.
 *
 * O conteúdo aqui é maior que a tela de propósito: a planta é rasterizada em
 * alta resolução e este viewport a encaixa. `fitScale` é o zoom que faz ela
 * caber, e vira o piso — dar zoom-out além disso só deixaria a planta menor
 * do que ela precisa ser para se ler no canteiro.
 *
 * O toque simples sobe para quem chama já em coordenada de conteúdo. Quem
 * decide se aquilo é "selecionar um poste" ou "criar um poste" é a tela — os
 * pinos são só desenho, não capturam gesto, o que evita a briga clássica
 * entre o toque do filho e a pinça do pai.
 *
 * ## Quem manda na transformada
 *
 * `scale`, `tx` e `ty` só mudam por gesto, por botão, ou pelo enquadramento de
 * ABERTURA, que acontece no máximo duas vezes: uma quando a planta ganha
 * geometria, outra se os postes chegarem depois dela e o gerente ainda não
 * tiver encostado na tela.
 *
 * Antes daqui o enquadramento era um `useEffect` reativo, e qualquer mudança
 * de identidade em `initialFocus` jogava o zoom de volta ao início. Como a
 * lista de postes é refeita a cada `refetch`, marcar um poste com zoom no
 * trecho devolvia a planta para a visão geral na cara do gerente.
 *
 * Mudança de geometria (rotação, faixa de aviso aparecendo) NÃO reenquadra:
 * só reancora a posição atual dentro dos novos limites.
 */
export function PlanViewport({
  viewportW,
  viewportH,
  contentW,
  contentH,
  onTap,
  scale,
  initialFocus,
  ready = true,
  children,
}: Props) {
  const geometriaOk = contentW > 0 && contentH > 0 && viewportW > 0 && viewportH > 0;

  const fit = geometriaOk ? Math.min(viewportW / contentW, viewportH / contentH) : 1;

  const fitScale = useSharedValue(fit);
  const maxScale = useSharedValue(fit * MAX_ZOOM);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(fit);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);

  const enquadrou = useRef(false);
  const focou = useRef(false);
  const tocou = useRef(false);

  const marcarToque = useCallback(() => {
    tocou.current = true;
  }, []);

  /** Onde a transformada precisa ficar para enquadrar `alvo` (ou a prancha toda). */
  const enquadramento = useCallback(
    (alvo: Rect | null) => {
      const teto = fit * MAX_ZOOM;
      if (!alvo || alvo.width <= 0 || alvo.height <= 0) {
        const p = clampPan(0, 0, fit, contentW, contentH, viewportW, viewportH);
        return { s: fit, x: p.x, y: p.y };
      }
      const s = clamp(
        Math.min(viewportW / alvo.width, viewportH / alvo.height),
        fit,
        teto,
      );
      const centroX = alvo.x + alvo.width / 2;
      const centroY = alvo.y + alvo.height / 2;
      const p = clampPan(
        viewportW / 2 - centroX * s,
        viewportH / 2 - centroY * s,
        s,
        contentW,
        contentH,
        viewportW,
        viewportH,
      );
      return { s, x: p.x, y: p.y };
    },
    [fit, contentW, contentH, viewportW, viewportH],
  );

  const aplicar = useCallback(
    (alvo: { s: number; x: number; y: number }, animar: boolean) => {
      if (animar) {
        scale.value = withTiming(alvo.s);
        tx.value = withTiming(alvo.x);
        ty.value = withTiming(alvo.y);
      } else {
        scale.value = alvo.s;
        tx.value = alvo.x;
        ty.value = alvo.y;
      }
    },
    [scale, tx, ty],
  );

  // Os limites acompanham a geometria. A posição do gerente não é jogada fora:
  // é reancorada dentro dos limites novos.
  useEffect(() => {
    if (!geometriaOk) return;
    fitScale.value = fit;
    maxScale.value = fit * MAX_ZOOM;
    if (!enquadrou.current) return;
    const s = clamp(scale.value, fit, fit * MAX_ZOOM);
    scale.value = s;
    const p = clampPan(tx.value, ty.value, s, contentW, contentH, viewportW, viewportH);
    tx.value = p.x;
    ty.value = p.y;
  }, [
    geometriaOk,
    fit,
    contentW,
    contentH,
    viewportW,
    viewportH,
    fitScale,
    maxScale,
    scale,
    tx,
    ty,
  ]);

  // Enquadramento de abertura. Acontece uma vez, e no máximo mais uma se os
  // postes chegarem depois da planta e o gerente ainda não tiver mexido.
  useEffect(() => {
    if (!geometriaOk) return;
    const temFoco =
      initialFocus != null && initialFocus.width > 0 && initialFocus.height > 0;

    // Geometria ainda provisória: encaixa a prancha para não piscar no canto
    // superior esquerdo, mas não gasta o enquadramento de abertura nela.
    if (!ready) {
      if (!enquadrou.current) aplicar(enquadramento(null), false);
      return;
    }

    if (!enquadrou.current) {
      aplicar(enquadramento(temFoco ? initialFocus : null), false);
      enquadrou.current = true;
      focou.current = temFoco;
      return;
    }

    if (!focou.current && temFoco && !tocou.current) {
      aplicar(enquadramento(initialFocus), true);
      focou.current = true;
    }
  }, [geometriaOk, ready, initialFocus, enquadramento, aplicar]);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      runOnJS(marcarToque)();
      startScale.value = scale.value;
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const next = clamp(startScale.value * e.scale, fitScale.value, maxScale.value);
      const ratio = next / startScale.value;
      scale.value = next;
      const nx = e.focalX - (e.focalX - startTx.value) * ratio;
      const ny = e.focalY - (e.focalY - startTy.value) * ratio;
      const fitted = clampPan(nx, ny, next, contentW, contentH, viewportW, viewportH);
      tx.value = fitted.x;
      ty.value = fitted.y;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .minDistance(8)
    .onBegin(() => {
      runOnJS(marcarToque)();
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const fitted = clampPan(
        startTx.value + e.translationX,
        startTy.value + e.translationY,
        scale.value,
        contentW,
        contentH,
        viewportW,
        viewportH,
      );
      tx.value = fitted.x;
      ty.value = fitted.y;
    });

  /**
   * Aplica um zoom mirando um ponto.
   *
   * Roda na thread JS, não como worklet: os botões +/− chamam daqui e o
   * duplo-toque chama por `runOnJS`. Uma função marcada `'worklet'` chamada
   * dos dois lados perde as closures em Reanimated 4 e quebra em
   * "Cannot read property 'value' of undefined".
   */
  const zoomTo = (target: number, focalX: number, focalY: number) => {
    tocou.current = true;
    const t = clamp(target, fitScale.value, maxScale.value);
    const ratio = t / scale.value;
    const nx = focalX - (focalX - tx.value) * ratio;
    const ny = focalY - (focalY - ty.value) * ratio;
    const fitted = clampPan(nx, ny, t, contentW, contentH, viewportW, viewportH);
    scale.value = withTiming(t);
    tx.value = withTiming(fitted.x);
    ty.value = withTiming(fitted.y);
  };

  const reenquadrar = () => {
    aplicar(enquadramento(initialFocus ?? null), true);
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(DOUBLE_TAP_WINDOW)
    .onEnd((e) => {
      const perto = scale.value > fitScale.value * 1.2;
      const alvo = perto ? fitScale.value : fitScale.value * 3.5;
      runOnJS(zoomTo)(alvo, e.x, e.y);
    });

  /**
   * Toque simples, generoso de propósito.
   *
   * `maxDuration` de 500 ms e 12 px de folga porque o dedo com luva encosta
   * devagar e treme. Com os 280 ms de antes, um toque deliberado não virava
   * nem toque nem arraste: simplesmente não acontecia nada.
   */
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(500)
    .maxDistance(12)
    .onEnd((e, success) => {
      if (!success || !onTap) return;
      const cx = (e.x - tx.value) / scale.value;
      const cy = (e.y - ty.value) / scale.value;
      runOnJS(onTap)(cx, cy, scale.value);
    });

  /*
    Corrida, não exclusividade.

    Com `Exclusive(duplo, simples, mover)` o arraste ficava em terceiro lugar e
    só podia começar depois de os dois toques desistirem. Na corrida, quem
    reconhecer primeiro leva: parou o dedo, é toque; moveu 8 px, é arraste;
    dois dedos, é pinça. Os dois toques seguem exclusivos ENTRE SI, senão todo
    duplo dispararia um simples no caminho.
  */
  const composed = Gesture.Race(
    Gesture.Simultaneous(pinch, pan),
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.clip}>
      {/*
        O gesto mede na moldura, não na planta.

        O GestureDetector precisa envolver uma view SEM transformada: se ele
        envolvesse a planta, `e.x` já viria no espaço dela e a conversão de
        volta aplicaria o zoom duas vezes — foi isso que fazia todo toque cair
        no canto 6000,6000. Com a moldura no meio, `e.x` é sempre pixel de
        tela, que é o que a matemática de zoom e de toque assume.
      */}
      <GestureDetector gesture={composed}>
        <View style={styles.frame} collapsable={false}>
          <Animated.View
            collapsable={false}
            style={[
              { width: contentW, height: contentH, transformOrigin: 'top left' },
              animatedStyle,
            ]}
          >
            {children}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.zoomStack} pointerEvents="box-none">
        <IconButton
          icon={Plus}
          size="md"
          onPress={() => zoomTo(scale.value * ZOOM_STEP, viewportW / 2, viewportH / 2)}
          accessibilityLabel="Aproximar"
        />
        <IconButton
          icon={Minus}
          size="md"
          onPress={() => zoomTo(scale.value / ZOOM_STEP, viewportW / 2, viewportH / 2)}
          accessibilityLabel="Afastar"
        />
        <IconButton
          icon={Maximize}
          size="md"
          onPress={reenquadrar}
          accessibilityLabel="Reenquadrar a planta"
        />
      </View>
    </View>
  );
}

function clampPan(
  x: number,
  y: number,
  s: number,
  contentW: number,
  contentH: number,
  viewportW: number,
  viewportH: number,
): { x: number; y: number } {
  'worklet';
  const sw = contentW * s;
  const sh = contentH * s;
  const ox = sw <= viewportW ? (viewportW - sw) / 2 : clamp(x, viewportW - sw, 0);
  const oy = sh <= viewportH ? (viewportH - sh) / 2 : clamp(y, viewportH - sh, 0);
  return { x: ox, y: oy };
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
  frame: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  zoomStack: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
