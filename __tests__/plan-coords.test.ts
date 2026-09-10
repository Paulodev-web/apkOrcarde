import {
  PLAN_LOGICAL_SIZE,
  asCoord,
  frameFromStoredGeometry,
  logicalToView,
  planFrame,
  viewToLogical,
} from '@/lib/plan/coords';

/**
 * A conversão entre o quadro lógico da obra e a planta na tela.
 *
 * Um erro aqui não aparece: o poste só fica alguns metros fora do lugar, e
 * ninguém percebe até o engenheiro conferir a planta no portal.
 */
describe('coordenadas da planta', () => {
  const W = 1170; // planta rasterizada a 3× de uma tela de 390
  const H = 827;

  it('canto superior esquerdo é a origem dos dois lados', () => {
    expect(logicalToView(0, 0, W, H)).toEqual({ left: 0, top: 0 });
    expect(viewToLogical(0, 0, W, H)).toEqual({ x: 0, y: 0 });
  });

  it('canto oposto é o fim do quadro lógico', () => {
    expect(logicalToView(PLAN_LOGICAL_SIZE, PLAN_LOGICAL_SIZE, W, H)).toEqual({
      left: W,
      top: H,
    });
    expect(viewToLogical(W, H, W, H)).toEqual({
      x: PLAN_LOGICAL_SIZE,
      y: PLAN_LOGICAL_SIZE,
    });
  });

  it('ida e volta devolve o mesmo ponto', () => {
    const original = { x: 2565, y: 3230 };
    const naTela = logicalToView(original.x, original.y, W, H);
    const devolta = viewToLogical(naTela.left, naTela.top, W, H);

    expect(devolta.x).toBeCloseTo(original.x, 6);
    expect(devolta.y).toBeCloseTo(original.y, 6);
  });

  it('a conversão não depende da resolução em que a planta foi rasterizada', () => {
    // O mesmo dedo, na mesma fração da planta, em 1× e em 3×.
    const em1x = viewToLogical(390 * 0.25, 276 * 0.5, 390, 276);
    const em3x = viewToLogical(1170 * 0.25, 828 * 0.5, 1170, 828);

    expect(em3x.x).toBeCloseTo(em1x.x, 6);
    expect(em3x.y).toBeCloseTo(em1x.y, 6);
  });

  it('toque fora da planta é preso na borda, nunca vira coordenada inválida', () => {
    // A RPC recusa fora de 0..6000; melhor prender aqui que perder o registro.
    expect(viewToLogical(-500, -500, W, H)).toEqual({ x: 0, y: 0 });
    expect(viewToLogical(W * 2, H * 2, W, H)).toEqual({
      x: PLAN_LOGICAL_SIZE,
      y: PLAN_LOGICAL_SIZE,
    });
  });

  it('viewport ainda sem medida não explode', () => {
    expect(logicalToView(100, 100, 0, 0)).toEqual({ left: 0, top: 0 });
    expect(viewToLogical(100, 100, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('coordenada que vem do banco como texto vira número', () => {
    // numeric do Postgres chega como string no supabase-js.
    expect(asCoord('2565.5')).toBe(2565.5);
    expect(asCoord(null)).toBe(0);
    expect(asCoord('nao é número')).toBe(0);
  });
});

/**
 * Onde a planta cai dentro do quadro 6000×6000.
 *
 * Estes números não são escolha nossa: saem de `calculatePdfPageDimensions` e
 * do posicionamento do `WorkCanvas` no repositório web. Se divergirem, todo
 * poste marcado no APK aparece fora do lugar no portal do engenheiro, sem
 * nada quebrar para avisar.
 */
describe('encaixe da planta no quadro lógico', () => {
  const A4_PAISAGEM = { w: 842, h: 595 };
  const A4_RETRATO = { w: 595, h: 842 };

  describe('V2, alta resolução', () => {
    it('a largura vira 6000 e a altura acompanha o aspecto', () => {
      const f = planFrame(A4_PAISAGEM.w, A4_PAISAGEM.h, 2);

      expect(f.width).toBeCloseTo(PLAN_LOGICAL_SIZE, 6);
      expect(f.offsetX).toBeCloseTo(0, 6);
      expect(f.height).toBeCloseTo((595 / 842) * PLAN_LOGICAL_SIZE, 4);
      expect(f.offsetY).toBeCloseTo((PLAN_LOGICAL_SIZE - f.height) / 2, 6);
    });

    it('página retrato estoura o quadro na vertical, como no web', () => {
      const f = planFrame(A4_RETRATO.w, A4_RETRATO.h, 2);

      expect(f.width).toBeCloseTo(PLAN_LOGICAL_SIZE, 6);
      expect(f.height).toBeGreaterThan(PLAN_LOGICAL_SIZE);
      // Estourando, o topo fica acima de zero: parte da planta sai do quadro.
      expect(f.offsetY).toBeLessThan(0);
    });
  });

  describe('V1, legado', () => {
    it('A4 paisagem cai no piso do fator e ocupa menos de um terço do quadro', () => {
      const f = planFrame(A4_PAISAGEM.w, A4_PAISAGEM.h, 1);

      // 1200/842 = 1.42, abaixo do piso 2.
      expect(f.width).toBeCloseTo(842 * 2, 4);
      expect(f.height).toBeCloseTo(595 * 2, 4);
      expect(f.width).toBeLessThan(PLAN_LOGICAL_SIZE / 3);
    });

    it('página pequena sobe até o teto do fator', () => {
      // 1200/200 = 6, acima do teto 4.
      const f = planFrame(200, 150, 1);
      expect(f.width).toBeCloseTo(200 * 4, 4);
    });

    it('render_version ausente é tratado como legado', () => {
      const semVersao = planFrame(A4_PAISAGEM.w, A4_PAISAGEM.h, null);
      const v1 = planFrame(A4_PAISAGEM.w, A4_PAISAGEM.h, 1);
      expect(semVersao).toEqual(v1);
    });
  });

  it('a planta fica centrada no quadro em qualquer versão ou formato', () => {
    const casos: [number, number, number | null][] = [
      [842, 595, 2],
      [595, 842, 2],
      [842, 595, 1],
      [1000, 1000, null],
    ];
    for (const [pw, ph, versao] of casos) {
      const f = planFrame(pw, ph, versao);
      expect(f.offsetX + f.width / 2).toBeCloseTo(PLAN_LOGICAL_SIZE / 2, 4);
      expect(f.offsetY + f.height / 2).toBeCloseTo(PLAN_LOGICAL_SIZE / 2, 4);
    }
  });

  it('o centro da planta na tela é o centro do quadro', () => {
    const W = 1582;
    const H = 1118;
    for (const versao of [1, 2]) {
      const f = planFrame(A4_PAISAGEM.w, A4_PAISAGEM.h, versao);
      const meio = viewToLogical(W / 2, H / 2, W, H, f);
      expect(meio.x).toBeCloseTo(PLAN_LOGICAL_SIZE / 2, 4);
      expect(meio.y).toBeCloseTo(PLAN_LOGICAL_SIZE / 2, 4);
    }
  });

  it('ida e volta continua exata com a moldura', () => {
    const W = 1582;
    const H = 1118;
    const f = planFrame(A4_PAISAGEM.w, A4_PAISAGEM.h, 1);
    const naTela = { left: W * 0.31, top: H * 0.72 };

    const logico = viewToLogical(naTela.left, naTela.top, W, H, f);
    const devolta = logicalToView(logico.x, logico.y, W, H, f);

    expect(devolta.left).toBeCloseTo(naTela.left, 4);
    expect(devolta.top).toBeCloseTo(naTela.top, 4);
  });

  it('sem tamanho de página conhecido, cai no quadro inteiro', () => {
    expect(planFrame(0, 0, 2)).toEqual({
      width: PLAN_LOGICAL_SIZE,
      height: PLAN_LOGICAL_SIZE,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

/**
 * A geometria gravada pelo portal no import.
 *
 * Este é o conserto do defeito que colocava um poste marcado no campo até 77 m
 * fora do lugar no portal: o Android reporta o tamanho da VIEW em pixels, o
 * portal usa a página em pontos, e os dois montavam quadros lógicos diferentes
 * a partir da mesma fórmula. Com a geometria vinda do servidor, não há duas
 * contas para divergir.
 */
describe('geometria vinda do snapshot', () => {
  // Uma A2 paisagem em render_version 1: 1684x1191 pontos, fator preso em 2.
  const gravada = {
    frame: { width: 3368, height: 2382, offsetX: 1316, offsetY: 1809 },
  };

  it('a gravada ganha do tamanho que o aparelho reporta', () => {
    // 2802x1981 é o que o Android devolve para essa mesma página: 1,66x maior.
    const comChute = planFrame(2802, 1981, 1, null);
    const comGravada = planFrame(2802, 1981, 1, gravada);

    expect(comGravada).toEqual(gravada.frame);
    expect(comChute).not.toEqual(gravada.frame);
  });

  it('sem geometria gravada, segue deduzindo como antes', () => {
    expect(planFrame(1684, 1191, 1, null)).toEqual({
      width: 3368,
      height: 2382,
      offsetX: 1316,
      offsetY: 1809,
    });
  });

  it('geometria pela metade é descartada, não usada torta', () => {
    expect(frameFromStoredGeometry(null)).toBeNull();
    expect(frameFromStoredGeometry({ frame: null })).toBeNull();
    expect(frameFromStoredGeometry({ frame: { width: 3368 } })).toBeNull();
    expect(
      frameFromStoredGeometry({ frame: { width: 0, height: 2382, offsetX: 0, offsetY: 0 } }),
    ).toBeNull();
  });

  it('o poste cai no mesmo ponto que o portal calcula', () => {
    // P-01 da prancha real: (2393.76, 3333.2) no quadro lógico.
    const frame = planFrame(2802, 1981, 1, gravada);
    const { left, top } = logicalToView(2393.76, 3333.2, 1000, 707, frame);
    expect(left / 1000).toBeCloseTo(0.32, 3);
    expect(top / 707).toBeCloseTo(0.64, 3);
  });
});
