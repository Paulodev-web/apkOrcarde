import { File } from 'expo-file-system';

import { SIGNED_URL_TTL_SECONDS, STORAGE_BUCKET } from '@/constants/limits';
import { captureException } from '@/lib/sentry';

import { supabase } from './client';

type UploadMediaParams = {
  workId: string;
  feature: 'chat' | 'daily-logs' | 'milestones' | 'pole-installations' | 'checklists' | 'alerts';
  recordId: string;
  fileUri: string;
  fileName: string;
  mimeType: string;
  storagePath?: string;
};

type UploadResult = {
  storagePath: string;
  fileSize: number;
};

export async function uploadMedia(params: UploadMediaParams): Promise<UploadResult> {
  const { workId, feature, recordId, fileUri, fileName, mimeType } = params;
  const storagePath = params.storagePath ?? `${workId}/${feature}/${recordId}/${fileName}`;

  // `upsert: true` porque este caminho é chamado de novo em cada retentativa do
  // outbox, e o `uploadToSignedUrl` NÃO tem opção de upsert própria — a
  // biblioteca documenta que ela só vale aqui, na hora de pedir a URL.
  //
  // Sem isso: a primeira tentativa reserva o caminho no Storage. Se a rede cair
  // um passo depois — upload ok, mas o RPC que grava o registro não confirma —
  // o item fica pendente no outbox e tenta de novo. A retentativa pede uma URL
  // assinada para o MESMO caminho, e sem upsert o Storage recusa com "The
  // resource already exists". Toda tentativa seguinte bate na mesma parede, o
  // item nunca sincroniza, e esgota as 5 tentativas até virar "falhou" — cuja
  // única saída na tela é "Descartar", que apaga o poste inteiro. Foi assim que
  // dois postes de teste ficaram presos por 5 dias.
  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: true });

  if (signedError || !signedData) {
    throw new Error(`Signed URL failed for ${storagePath}: ${signedError?.message ?? 'unknown'}`);
  }

  // Le o arquivo pelo expo-file-system, nao por `fetch('file://...')`.
  //
  // O fetch do React Native nao busca `file://` nesta versao: ele falha com
  // "Network request failed", que parece problema de rede e nao e. Era isso
  // que impedia qualquer foto de subir, inclusive com sinal cheio, e o erro
  // enganava porque o texto aponta para a rede.
  const arquivo = new File(fileUri);
  if (!arquivo.exists) {
    throw new Error(`Arquivo local sumiu antes do envio: ${fileUri}`);
  }
  const bytes = await arquivo.bytes();

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(signedData.path, signedData.token, bytes, {
      contentType: mimeType,
    });

  if (uploadError) {
    throw new Error(`Upload failed for ${storagePath}: ${uploadError.message}`);
  }

  return { storagePath, fileSize: bytes.byteLength };
}

export async function getSignedUrl(
  storagePath: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) {
    captureException(error ?? new Error(`No signed URL for ${storagePath}`));
    throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`);
  }

  return data.signedUrl;
}

export async function getSignedUrls(
  storagePaths: string[],
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(storagePaths, ttlSeconds);

  if (error || !data) {
    captureException(error ?? new Error('Batch signed URLs failed'));
    throw new Error(`Batch signed URLs failed: ${error?.message ?? 'unknown'}`);
  }

  const result: Record<string, string> = {};
  for (const item of data) {
    if (item.signedUrl && item.path) {
      result[item.path] = item.signedUrl;
    }
  }
  return result;
}
