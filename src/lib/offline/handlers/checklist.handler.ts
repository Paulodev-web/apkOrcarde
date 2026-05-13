import type { OutboxItem } from '@/types';
import type { MarkChecklistItemInput, MarkChecklistItemOutput } from '@/types/rpc';
import { callRpc, RpcError } from '@/lib/supabase/rpc';
import { uploadMedia } from '@/lib/supabase/storage';
import { updateStatus } from '@/lib/offline/outbox';

const MAX_PARALLEL_UPLOADS = 3;

export async function handleMarkChecklistItem(item: OutboxItem): Promise<void> {
  const payload = JSON.parse(item.payload) as MarkChecklistItemInput;
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
          feature: 'checklists',
          recordId: payload.checklist_id,
          fileUri: localUri,
          fileName: attachment.file_name,
          mimeType: attachment.mime_type,
          storagePath: attachment.storage_path,
        });
        attachment.file_size_bytes = result.fileSize || attachment.file_size_bytes;
      });
    }

    await runWithConcurrency(uploadTasks, MAX_PARALLEL_UPLOADS);
    payload.media = media;
  }

  await updateStatus(item.id, 'calling_rpc');

  const result = await callRpc<MarkChecklistItemOutput>(
    'rpc_mark_checklist_item',
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
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}
