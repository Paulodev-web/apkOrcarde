import { Directory, File, Paths } from 'expo-file-system';

import { captureException } from '@/lib/sentry';

const ROOT_DIR = 'plan-marks';
const FILE_NAME = 'marks.json';

/**
 * As marcações da planta, guardadas no aparelho.
 *
 * A prancha já abria sem sinal, porque o PDF tem cache local. Os postes não:
 * eles vinham do servidor a cada abertura. O resultado era a pior assimetria
 * possível num app cuja premissa é funcionar sem rede — a planta abria, e vinha
 * vazia, o que para quem está no canteiro se lê como "meus registros sumiram".
 *
 * Guarda a última leitura boa e serve ela quando a rede falha. Não substitui o
 * servidor: assim que a leitura funciona, o cache é atualizado.
 */

function workDir(workId: string): Directory {
  return new Directory(Paths.document, ROOT_DIR, workId);
}

function marksFile(workId: string): File {
  return new File(workDir(workId), FILE_NAME);
}

export function readCachedMarks<T>(workId: string): T | null {
  try {
    const f = marksFile(workId);
    if (!f.exists) return null;
    const bruto = f.textSync();
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch (e) {
    // Cache ilegível é o mesmo que cache ausente: a tela segue para a rede.
    captureException(e);
    return null;
  }
}

export function writeCachedMarks(workId: string, marks: unknown): void {
  try {
    const dir = workDir(workId);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const f = marksFile(workId);
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify(marks));
  } catch (e) {
    // Falhar em guardar não pode derrubar a leitura que acabou de dar certo.
    captureException(e);
  }
}

export function clearCachedMarks(workId: string): void {
  try {
    const dir = workDir(workId);
    if (dir.exists) dir.delete();
  } catch {
    // Sem consequência: o próximo write sobrescreve.
  }
}
