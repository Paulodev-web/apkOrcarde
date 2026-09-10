import * as ImageManipulator from 'expo-image-manipulator';

const mockFileSizes = new Map<string, number>();

// O tamanho sai do sistema de arquivos, nao de `fetch('file://...')`: o fetch
// do React Native nao le arquivo local nesta versao e devolvia 0 sempre.
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists(): boolean {
      return mockFileSizes.has(this.uri);
    }
    get size(): number {
      return mockFileSizes.get(this.uri) ?? 0;
    }
  },
}));

import { compressImage } from '@/lib/media/compress';

const mockManipulate = ImageManipulator.manipulateAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFileSizes.clear();
  mockFileSizes.set('compressed-uri', 250_000);

  // Se alguem voltar a usar fetch para ler arquivo local, o teste denuncia.
  global.fetch = jest.fn(async () => {
    throw new Error('Network request failed');
  }) as unknown as typeof fetch;
});

describe('compressImage', () => {
  it('resizes large images to fit within 1920x1080', async () => {
    mockManipulate
      .mockResolvedValueOnce({ uri: 'probe-uri', width: 4000, height: 3000 })
      .mockResolvedValueOnce({ uri: 'compressed-uri', width: 1440, height: 1080 });

    const result = await compressImage('file:///big-photo.jpg');

    expect(result.uri).toBe('compressed-uri');
    expect(result.width).toBe(1440);
    expect(result.height).toBe(1080);

    const secondCall = mockManipulate.mock.calls[1];
    const actions = secondCall[1] as Array<{ resize?: { width: number; height: number } }>;
    expect(actions).toHaveLength(1);
    expect(actions[0].resize).toBeDefined();
    expect(actions[0].resize!.width).toBeLessThanOrEqual(1920);
    expect(actions[0].resize!.height).toBeLessThanOrEqual(1080);
  });

  it('does not resize images already within 1920x1080', async () => {
    mockManipulate
      .mockResolvedValueOnce({ uri: 'probe-uri', width: 800, height: 600 })
      .mockResolvedValueOnce({ uri: 'compressed-uri', width: 800, height: 600 });

    const result = await compressImage('file:///small-photo.jpg');

    expect(result.uri).toBe('compressed-uri');
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);

    const secondCall = mockManipulate.mock.calls[1];
    const actions = secondCall[1] as unknown[];
    expect(actions).toHaveLength(0);
  });

  it('preserves aspect ratio when resizing', async () => {
    mockManipulate
      .mockResolvedValueOnce({ uri: 'probe-uri', width: 3840, height: 2160 })
      .mockResolvedValueOnce({ uri: 'compressed-uri', width: 1920, height: 1080 });

    await compressImage('file:///16x9.jpg');

    const secondCall = mockManipulate.mock.calls[1];
    const actions = secondCall[1] as Array<{ resize: { width: number; height: number } }>;
    const { width, height } = actions[0].resize;
    const ratio = width / height;
    expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.01);
  });

  it('returns original image on compression failure', async () => {
    mockManipulate.mockRejectedValueOnce(new Error('HEIC not supported'));

    const result = await compressImage('file:///exotic.heic');

    expect(result.uri).toBe('file:///exotic.heic');
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('le o tamanho do arquivo pelo sistema de arquivos, nao por fetch', async () => {
    mockManipulate
      .mockResolvedValueOnce({ uri: 'probe-uri', width: 800, height: 600 })
      .mockResolvedValueOnce({ uri: 'compressed-uri', width: 800, height: 600 });

    const result = await compressImage('file:///photo.jpg');

    expect(result.fileSize).toBe(250_000);
    // `fetch` neste teste sempre estoura: se o codigo o usasse, o tamanho
    // voltaria zerado como acontecia no aparelho.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('arquivo inexistente devolve tamanho zero sem quebrar', async () => {
    mockManipulate
      .mockResolvedValueOnce({ uri: 'probe-uri', width: 800, height: 600 })
      .mockResolvedValueOnce({ uri: 'sumiu-uri', width: 800, height: 600 });

    const result = await compressImage('file:///photo.jpg');
    expect(result.fileSize).toBe(0);
  });
});
