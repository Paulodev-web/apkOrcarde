/**
 * A foto que espera na fila não pode morar no cache.
 *
 * O compressor devolve o arquivo dentro do cache do app, e o Android apaga
 * cache quando o armazenamento aperta. Uma foto que espera dias por sinal no
 * canteiro some, e o registro fica preso para sempre: a fila tenta, não acha
 * o arquivo, e nenhuma tentativa futura resolve.
 */

type FakeFile = { size: number };

const mockFiles = new Map<string, FakeFile>();
const mockDirs = new Set<string>();

jest.mock('expo-file-system', () => {
  const join = (uris: unknown[]): string => {
    const parts = uris.map((u) =>
      typeof u === 'string' ? u : (u as { uri: string }).uri,
    );
    return parts
      .map((part, i) =>
        i === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, ''),
      )
      .filter((p) => p.length > 0)
      .join('/');
  };

  class Directory {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = join(uris);
    }
    get exists(): boolean {
      return mockDirs.has(this.uri);
    }
    create(): void {
      mockDirs.add(this.uri);
    }
    list(): unknown[] {
      return [...mockFiles.keys()]
        .filter((k) => k.startsWith(this.uri + '/'))
        .map((k) => new File(k));
    }
  }

  class File {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = join(uris);
    }
    get exists(): boolean {
      return mockFiles.has(this.uri);
    }
    get size(): number {
      return mockFiles.get(this.uri)?.size ?? 0;
    }
    delete(): void {
      mockFiles.delete(this.uri);
    }
    copy(destination: File): void {
      const src = mockFiles.get(this.uri);
      if (!src) throw new Error('origem nao existe');
      mockFiles.set(destination.uri, { ...src });
    }
  }

  return { File, Directory, Paths: { document: { uri: 'file:///doc' } } };
});

jest.mock('@/lib/sentry', () => ({ captureException: jest.fn() }));

import {
  discardPendingMedia,
  pendingMediaSize,
  persistPendingMedia,
} from '@/lib/media/pending-store';

const CACHE = 'file:///cache/ImageManipulator/abc.jpg';

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  jest.spyOn(Date, 'now').mockReturnValue(1000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('mídia da fila', () => {
  it('tira a foto do cache e leva para os documentos', () => {
    mockFiles.set(CACHE, { size: 900 });

    const destino = persistPendingMedia(CACHE, 'poste.jpg');

    expect(destino).toBe('file:///doc/outbox-media/1000-poste.jpg');
    expect(destino).not.toContain('/cache/');
    expect(mockFiles.has(destino)).toBe(true);
    // O original segue existindo; quem limpa o cache é o sistema.
    expect(mockFiles.has(CACHE)).toBe(true);
  });

  it('duas fotos de mesmo nome não se atropelam', () => {
    mockFiles.set(CACHE, { size: 900 });
    const primeira = persistPendingMedia(CACHE, 'foto.jpg');

    jest.spyOn(Date, 'now').mockReturnValue(2000);
    const segunda = persistPendingMedia(CACHE, 'foto.jpg');

    expect(primeira).not.toBe(segunda);
    expect(mockFiles.has(primeira)).toBe(true);
    expect(mockFiles.has(segunda)).toBe(true);
  });

  it('se a cópia falhar, devolve o caminho original em vez de perder o registro', () => {
    // Arquivo de origem não existe: melhor uma foto em risco que nenhuma.
    const destino = persistPendingMedia('file:///cache/sumiu.jpg', 'x.jpg');
    expect(destino).toBe('file:///cache/sumiu.jpg');
  });

  it('sincronizar apaga a cópia local', () => {
    mockFiles.set(CACHE, { size: 900 });
    const guardada = persistPendingMedia(CACHE, 'poste.jpg');

    discardPendingMedia([guardada]);

    expect(mockFiles.has(guardada)).toBe(false);
  });

  it('nunca apaga arquivo que não seja da pasta da fila', () => {
    const deOutroLugar = 'file:///doc/obras/x/projeto.pdf';
    mockFiles.set(deOutroLugar, { size: 4242 });

    discardPendingMedia([deOutroLugar, CACHE]);

    // A planta guardada não pode sair junto com a limpeza da fila.
    expect(mockFiles.has(deOutroLugar)).toBe(true);
  });

  it('soma o que a fila ocupa em disco', () => {
    mockFiles.set(CACHE, { size: 900 });
    persistPendingMedia(CACHE, 'a.jpg');
    jest.spyOn(Date, 'now').mockReturnValue(2000);
    persistPendingMedia(CACHE, 'b.jpg');

    expect(pendingMediaSize()).toBe(1800);
  });

  it('sem pasta criada, o tamanho é zero e não explode', () => {
    expect(pendingMediaSize()).toBe(0);
  });
});
