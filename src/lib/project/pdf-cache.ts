import { Directory, File, Paths } from 'expo-file-system';

import { captureBreadcrumb, captureException } from '@/lib/sentry';
import { getSignedUrl } from '@/lib/supabase/storage';

/**
 * A planta da obra no aparelho.
 *
 * O canteiro é onde o sinal falta, e é exatamente onde a planta precisa abrir.
 * Servir o PDF por URL assinada não resolve isso por três motivos que se
 * somam: a URL exige rede para ser criada, expira em 30 min, e muda a cada
 * chamada — então nem o cache por URL do `react-native-pdf` acerta duas vezes
 * seguidas. Na prática, sem esta camada o PDF nunca abre offline.
 *
 * Aqui o arquivo é baixado UMA vez para um caminho estável por obra e a tela
 * sempre lê o arquivo local. A rede só serve para conferir se a versão mudou.
 *
 * `Paths.document` (e não `Paths.cache`) de propósito: o sistema pode limpar
 * o cache quando o armazenamento aperta, e perder a planta no meio da obra é
 * o pior momento possível.
 */

const ROOT_DIR = 'obras';
const PDF_NAME = 'projeto.pdf';
const META_NAME = 'projeto.meta.json';

export type ProjectPdfMeta = {
  storagePath: string;
  /** `render_version` do snapshot. Muda quando o engenheiro reimporta o projeto. */
  renderVersion: number | null;
  downloadedAt: string;
  sizeBytes: number | null;
};

export type CachedPdf = {
  /** `file://…` — o que vai para o `<Pdf source>`. */
  uri: string;
  meta: ProjectPdfMeta | null;
  /** O servidor tem uma versão mais nova que ainda não foi baixada. */
  stale: boolean;
};

function workDir(workId: string): Directory {
  return new Directory(Paths.document, ROOT_DIR, workId);
}

function pdfFile(workId: string): File {
  return new File(workDir(workId), PDF_NAME);
}

function metaFile(workId: string): File {
  return new File(workDir(workId), META_NAME);
}

function readMeta(workId: string): ProjectPdfMeta | null {
  try {
    const f = metaFile(workId);
    if (!f.exists) return null;
    return JSON.parse(f.textSync()) as ProjectPdfMeta;
  } catch {
    // Metadado corrompido não invalida o PDF: sem ele o arquivo continua
    // servindo, só perdemos a noção de versão (e ele será rebaixado na
    // próxima vez que houver rede).
    return null;
  }
}

function writeMeta(workId: string, meta: ProjectPdfMeta): void {
  try {
    const f = metaFile(workId);
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify(meta));
  } catch (e) {
    captureException(e);
  }
}

/** O que já está no aparelho, sem tocar na rede. */
export function getLocalProjectPdf(
  workId: string,
  expected?: { storagePath: string; renderVersion: number | null },
): CachedPdf | null {
  try {
    const file = pdfFile(workId);
    if (!file.exists) return null;

    const meta = readMeta(workId);
    const stale =
      expected != null &&
      meta != null &&
      (meta.storagePath !== expected.storagePath ||
        (meta.renderVersion ?? null) !== (expected.renderVersion ?? null));

    return { uri: file.uri, meta, stale };
  } catch {
    return null;
  }
}

/**
 * Garante a planta no aparelho e devolve o caminho local.
 *
 * Baixa apenas quando falta ou quando a versão do servidor mudou. Se a rede
 * falhar e já houver uma cópia local — mesmo desatualizada — devolve a cópia:
 * uma planta velha vale mais que nenhuma planta no meio do canteiro.
 */
export async function ensureProjectPdf(
  workId: string,
  snapshot: { storagePath: string; renderVersion: number | null },
): Promise<CachedPdf | null> {
  const local = getLocalProjectPdf(workId, snapshot);
  if (local && !local.stale) return local;

  try {
    const dir = workDir(workId);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

    const url = await getSignedUrl(snapshot.storagePath);

    const target = pdfFile(workId);
    if (target.exists) target.delete();

    const downloaded = await File.downloadFileAsync(url, target);

    writeMeta(workId, {
      storagePath: snapshot.storagePath,
      renderVersion: snapshot.renderVersion,
      downloadedAt: new Date().toISOString(),
      sizeBytes: downloaded.size ?? null,
    });

    captureBreadcrumb('pdf', 'Planta baixada para o aparelho', {
      workId,
      sizeBytes: downloaded.size ?? null,
      renderVersion: snapshot.renderVersion,
    });

    return { uri: downloaded.uri, meta: readMeta(workId), stale: false };
  } catch (e) {
    captureException(e);
    // Sem rede e com cópia antiga: entrega a antiga.
    if (local) return { ...local, stale: true };
    return null;
  }
}

/** Libera espaço quando a obra sai da lista do gerente. */
export function removeProjectPdf(workId: string): void {
  try {
    const dir = workDir(workId);
    if (dir.exists) dir.delete();
  } catch (e) {
    captureException(e);
  }
}

/** Quanto a planta guardada ocupa, para a tela de armazenamento. */
export function projectPdfSize(workId: string): number | null {
  try {
    const f = pdfFile(workId);
    return f.exists ? f.size : null;
  } catch {
    return null;
  }
}
