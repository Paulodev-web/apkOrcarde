import type { OutboxItem } from '@/types';
import type { RecordPoleInstallationInput, RecordPoleInstallationOutput } from '@/types/rpc';
import { updateStatus } from '@/lib/offline/outbox';
import { callRpc, RpcError } from '@/lib/supabase/rpc';
import { uploadMedia } from '@/lib/supabase/storage';

const MAX_PARALLEL_UPLOADS = 3;

export async function handleRecordPoleInstallation(item: OutboxItem): Promise<void> {
  const payload = JSON.parse(item.payload) as RecordPoleInstallationInput;
  const localMediaPaths: string[] = item.media_paths
    ? (JSON.parse(item.media_paths) as string[])
    : [];

  if (localMediaPaths.length > 0) {
    await updateStatus(item.id, 'uploading_media');

    const media = [...payload.media];
    const uploadTasks: Array<() => Promise<void>> = [];

    for (let i = 0; i < media.length; i++) {
      const attachment = media[i];
      const localUri = localMediaPaths[i];
      if (!localUri) continue;

      uploadTasks.push(async () => {
        const result = await uploadMedia({
          workId: payload.work_id,
          feature: 'pole-installations',
          recordId: payload.installation_id,
          fileUri: localUri,
          fileName: attachment.file_name,
          mimeType: attachment.mime_type,
        });

        attachment.storage_path = result.storagePath;
        attachment.file_size_bytes = result.fileSize || attachment.file_size_bytes;
      });
    }

    await runWithConcurrency(uploadTasks, MAX_PARALLEL_UPLOADS);
    payload.media = media;
  }

  await updateStatus(item.id, 'calling_rpc');

  const result = await callRpc<RecordPoleInstallationOutput>(
    'rpc_record_pole_installation',
    payload as unknown as Record<string, unknown>,
  );

  if (!result.success) {
    throw new RpcError(result.error, result.code ?? 'UNKNOWN');
  }
}

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
): Promise<void> {
  const executing = new Set<Promise<void>>();

  for (const task of tasks) {
    const p = task().then(() => {
      executing.delete(p);
    });
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}
