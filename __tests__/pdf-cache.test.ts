/**
 * A planta tem que abrir sem sinal — é isso que este arquivo garante.
 *
 * Os quatro casos que importam no canteiro: já baixada (não toca na rede),
 * versão nova no servidor (rebaixa), primeira vez sem sinal (não inventa
 * planta), e sinal caindo com cópia antiga no aparelho (mostra a antiga).
 */

type FakeFile = { content: string | null; size: number };

const mockFiles = new Map<string, FakeFile>();
const mockDirs = new Set<string>();
let mockSignedUrlCalls = 0;
let mockDownloadCalls = 0;
let mockSignedUrlShouldFail = false;
let mockDownloadShouldFail = false;

jest.mock('expo-file-system', () => {
  const joinUris = (uris: unknown[]): string => {
    const parts = uris.map((u) =>
      typeof u === 'string' ? u : (u as { uri: string }).uri,
    );
    // Junta sem colapsar as tres barras de `file:///`.
    return parts
      .map((part, i) => (i === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, '')))
      .filter((part) => part.length > 0)
      .join('/');
  };

  class Directory {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = joinUris(uris);
    }
    get exists(): boolean {
      return mockDirs.has(this.uri);
    }
    create(): void {
      mockDirs.add(this.uri);
    }
    delete(): void {
      mockDirs.delete(this.uri);
      for (const key of [...mockFiles.keys()]) {
        if (key.startsWith(this.uri)) mockFiles.delete(key);
      }
    }
  }

  class File {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = joinUris(uris);
    }
    get exists(): boolean {
      return mockFiles.has(this.uri);
    }
    get size(): number {
      return mockFiles.get(this.uri)?.size ?? 0;
    }
    create(): void {
      mockFiles.set(this.uri, { content: '', size: 0 });
    }
    delete(): void {
      mockFiles.delete(this.uri);
    }
    write(content: string): void {
      mockFiles.set(this.uri, { content, size: content.length });
    }
    textSync(): string {
      return mockFiles.get(this.uri)?.content ?? '';
    }
    static async downloadFileAsync(_url: string, destination: File): Promise<File> {
      mockDownloadCalls += 1;
      if (mockDownloadShouldFail) throw new Error('sem rede');
      mockFiles.set(destination.uri, { content: '%PDF', size: 4242 });
      return destination;
    }
  }

  return {
    File,
    Directory,
    Paths: { document: { uri: 'file:///doc' } },
  };
});

jest.mock('@/lib/supabase/storage', () => ({
  getSignedUrl: jest.fn(async () => {
    mockSignedUrlCalls += 1;
    if (mockSignedUrlShouldFail) throw new Error('sem rede');
    return 'https://exemplo.test/assinada.pdf';
  }),
}));

jest.mock('@/lib/sentry', () => ({
  captureException: jest.fn(),
  captureBreadcrumb: jest.fn(),
}));

import { ensureProjectPdf, getLocalProjectPdf } from '@/lib/project/pdf-cache';

const WORK = 'obra-1';
const SNAP = { storagePath: 'obra-1/project/projeto.pdf', renderVersion: 1 };
const PDF_URI = 'file:///doc/obras/obra-1/projeto.pdf';
const META_URI = 'file:///doc/obras/obra-1/projeto.meta.json';

function seedCached(renderVersion: number, storagePath = SNAP.storagePath): void {
  mockDirs.add('file:///doc/obras/obra-1');
  mockFiles.set(PDF_URI, { content: '%PDF', size: 4242 });
  mockFiles.set(META_URI, {
    content: JSON.stringify({
      storagePath,
      renderVersion,
      downloadedAt: '2026-08-01T10:00:00.000Z',
      sizeBytes: 4242,
    }),
    size: 100,
  });
}

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  mockSignedUrlCalls = 0;
  mockDownloadCalls = 0;
  mockSignedUrlShouldFail = false;
  mockDownloadShouldFail = false;
});

describe('planta no aparelho', () => {
  it('sem nada baixado, nao inventa planta', () => {
    expect(getLocalProjectPdf(WORK, SNAP)).toBeNull();
  });

  it('ja baixada e na mesma versao: nao toca na rede', async () => {
    seedCached(1);

    const result = await ensureProjectPdf(WORK, SNAP);

    expect(result?.uri).toBe(PDF_URI);
    expect(result?.stale).toBe(false);
    // O ponto todo: nenhuma URL assinada, nenhum download.
    expect(mockSignedUrlCalls).toBe(0);
    expect(mockDownloadCalls).toBe(0);
  });

  it('engenheiro reimportou o projeto: rebaixa a versao nova', async () => {
    seedCached(1);

    const result = await ensureProjectPdf(WORK, { ...SNAP, renderVersion: 2 });

    expect(mockDownloadCalls).toBe(1);
    expect(result?.stale).toBe(false);
    expect(JSON.parse(mockFiles.get(META_URI)!.content!).renderVersion).toBe(2);
  });

  it('primeira vez sem sinal: devolve nada em vez de travar', async () => {
    mockSignedUrlShouldFail = true;

    const result = await ensureProjectPdf(WORK, SNAP);

    expect(result).toBeNull();
  });

  it('sem sinal com copia antiga: entrega a antiga marcada como desatualizada', async () => {
    seedCached(1);
    mockSignedUrlShouldFail = true;

    // Servidor tem a v2, mas o aparelho esta sem rede.
    const result = await ensureProjectPdf(WORK, { ...SNAP, renderVersion: 2 });

    expect(result?.uri).toBe(PDF_URI);
    expect(result?.stale).toBe(true);
  });

  it('planta trocada de caminho tambem conta como desatualizada', () => {
    seedCached(1, 'obra-1/project/antigo.pdf');

    const local = getLocalProjectPdf(WORK, SNAP);

    expect(local?.stale).toBe(true);
  });

  it('metadado corrompido nao derruba a planta', () => {
    seedCached(1);
    mockFiles.set(META_URI, { content: '{ isto nao e json', size: 20 });

    const local = getLocalProjectPdf(WORK, SNAP);

    expect(local?.uri).toBe(PDF_URI);
    expect(local?.meta).toBeNull();
  });

  it('download falhando no meio deixa o aparelho sem planta, nao com meia planta', async () => {
    mockDownloadShouldFail = true;

    const result = await ensureProjectPdf(WORK, SNAP);

    expect(result).toBeNull();
    expect(mockFiles.has(PDF_URI)).toBe(false);
  });
});
