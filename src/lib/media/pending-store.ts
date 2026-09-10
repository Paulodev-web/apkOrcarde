import { Directory, File, Paths } from 'expo-file-system';

import { captureException } from '@/lib/sentry';

/**
 * Onde a mídia espera a vez de subir.
 *
 * O `expo-image-manipulator` devolve o arquivo comprimido dentro do CACHE do
 * app, e o Android apaga cache quando o armazenamento aperta. Uma foto que
 * espera dias por sinal no canteiro tem chance real de sumir antes de subir,
 * e aí o registro fica preso para sempre: a fila tenta, não encontra o
 * arquivo, e nenhuma tentativa futura resolve.
 *
 * Por isso a mídia da fila é copiada para o diretório de documentos, que o
 * sistema não limpa sozinho, e só é apagada quando o item sincroniza ou é
 * descartado.
 */

const DIR = 'outbox-media';

function pastaDaFila(): Directory {
  return new Directory(Paths.document, DIR);
}

/**
 * Copia o arquivo para a área persistente e devolve o novo caminho.
 * Se a cópia falhar, devolve o caminho original: melhor uma foto em risco de
 * cache do que registro nenhum.
 */
export function persistPendingMedia(localUri: string, fileName: string): string {
  try {
    const origem = new File(localUri);
    if (!origem.exists) return localUri;

    const pasta = pastaDaFila();
    if (!pasta.exists) pasta.create({ intermediates: true, idempotent: true });

    // Prefixo de tempo evita colisão entre duas fotos de mesmo nome.
    const destino = new File(pasta, `${Date.now()}-${fileName}`);
    if (destino.exists) destino.delete();

    origem.copy(destino);
    return destino.uri;
  } catch (e) {
    captureException(e);
    return localUri;
  }
}

/** Some com a mídia depois que o item da fila cumpriu seu papel. */
export function discardPendingMedia(uris: string[]): void {
  for (const uri of uris) {
    try {
      if (!uri.includes(`/${DIR}/`)) continue;
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch (e) {
      captureException(e);
    }
  }
}

/** Quanto a fila está ocupando em disco, para a tela de armazenamento. */
export function pendingMediaSize(): number {
  try {
    const pasta = pastaDaFila();
    if (!pasta.exists) return 0;
    let total = 0;
    for (const item of pasta.list()) {
      if (item instanceof File && item.exists) total += item.size;
    }
    return total;
  } catch {
    return 0;
  }
}
