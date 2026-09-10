import { POLE_LIMITS } from '@/constants/limits';

/** O quadro lógico da obra, o mesmo 6000×6000 do canvas web. */
export const PLAN_LOGICAL_SIZE = POLE_LIMITS.LOGICAL_GRID_SIZE;
const PLAN_CENTER = PLAN_LOGICAL_SIZE / 2;

/**
 * Onde a planta fica dentro do quadro lógico.
 *
 * Isto replica `calculatePdfPageDimensions` + o posicionamento do
 * `WorkCanvas` no repositório web (top/left no centro com
 * translate(-50%,-50%)). Não é uma escolha nossa: se o APK divergir, cada
 * poste marcado em campo cai fora do lugar no portal do engenheiro, e o erro
 * cresce conforme se afasta do centro.
 *
 * As duas versões de importação tratam a página de formas bem diferentes:
 *
 * V2 (`render_version === 2`): a largura vira 6000 e a altura acompanha o
 * aspecto. Numa página retrato isso estoura o quadro na vertical, de
 * propósito. É o modo de alta resolução dos orçamentos novos.
 *
 * V1 (legado, o default): a página é multiplicada por um fator preso entre
 * 2 e 4. Numa A4 paisagem o fator cai no piso 2, então a planta ocupa
 * 1684×1190 no meio de um quadro de 6000, ou seja, menos de um terço da
 * largura. Parece pouco, mas é o que o web desenha, e é ele quem manda.
 */
export type PlanFrame = {
  /** Lado ocupado pela planta dentro do quadro, em unidades lógicas. */
  width: number;
  height: number;
  /** Canto superior esquerdo da planta dentro do quadro. */
  offsetX: number;
  offsetY: number;
};

const QUADRO_INTEIRO: PlanFrame = {
  width: PLAN_LOGICAL_SIZE,
  height: PLAN_LOGICAL_SIZE,
  offsetX: 0,
  offsetY: 0,
};

export function planFrame(
  pageW: number,
  pageH: number,
  renderVersion: number | null | undefined,
): PlanFrame {
  if (!(pageW > 0) || !(pageH > 0)) return QUADRO_INTEIRO;

  let width: number;
  let height: number;

  if (renderVersion === 2) {
    const escala = PLAN_LOGICAL_SIZE / pageW;
    width = PLAN_LOGICAL_SIZE;
    height = pageH * escala;
  } else {
    const escala = Math.max(2, Math.min(4, 1200 / Math.max(pageW, pageH)));
    width = pageW * escala;
    height = pageH * escala;
  }

  return {
    width,
    height,
    offsetX: PLAN_CENTER - width / 2,
    offsetY: PLAN_CENTER - height / 2,
  };
}

/** Coordenada do quadro lógico para posição na planta desenhada na tela. */
export function logicalToView(
  x: number,
  y: number,
  viewW: number,
  viewH: number,
  frame: PlanFrame = QUADRO_INTEIRO,
): { left: number; top: number } {
  if (viewW <= 0 || viewH <= 0 || frame.width <= 0 || frame.height <= 0) {
    return { left: 0, top: 0 };
  }
  return {
    left: ((x - frame.offsetX) / frame.width) * viewW,
    top: ((y - frame.offsetY) / frame.height) * viewH,
  };
}

/** Caminho de volta: onde o dedo encostou vira coordenada do quadro lógico. */
export function viewToLogical(
  left: number,
  top: number,
  viewW: number,
  viewH: number,
  frame: PlanFrame = QUADRO_INTEIRO,
): { x: number; y: number } {
  if (viewW <= 0 || viewH <= 0) return { x: 0, y: 0 };
  const preso = (v: number) => Math.min(Math.max(v, 0), PLAN_LOGICAL_SIZE);
  return {
    x: preso(frame.offsetX + (left / viewW) * frame.width),
    y: preso(frame.offsetY + (top / viewH) * frame.height),
  };
}

export function asCoord(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
