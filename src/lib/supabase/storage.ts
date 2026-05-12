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
};

type UploadResult = {
  storagePath: string;
  fileSize: number;
};

export async function uploadMedia(params: UploadMediaParams): Promise<UploadResult> {
  const { workId, feature, recordId, fileUri, fileName, mimeType } = params;
  const storagePath = `${workId}/${feature}/${recordId}/${fileName}`;

  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signedError || !signedData) {
    throw new Error(`Signed URL failed for ${storagePath}: ${signedError?.message ?? 'unknown'}`);
  }

  const response = await fetch(fileUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(signedData.path, signedData.token, blob, {
      contentType: mimeType,
    });

  if (uploadError) {
    throw new Error(`Upload failed for ${storagePath}: ${uploadError.message}`);
  }

  return { storagePath, fileSize: blob.size };
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
