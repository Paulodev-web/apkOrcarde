import type { OutboxItem } from '@/types';
import type { SendWorkMessageInput } from '@/types/rpc';
import { callRpc } from '@/lib/supabase/rpc';
import { uploadMedia } from '@/lib/supabase/storage';
import { updateStatus } from '@/lib/offline/outbox';

const MAX_PARALLEL_UPLOADS = 3;

export async function handleSendMessage(item: OutboxItem): Promise<void> {
  const payload = JSON.parse(item.payload) as SendWorkMessageInput;
  const localMediaPaths: string[] = item.media_paths
    ? (JSON.parse(item.media_paths) as string[])
    : [];

  if (localMediaPaths.length > 0) {
    await updateStatus(item.id, 'uploading_media');

    const attachments = [...payload.attachments];
    const uploadTasks: Array<() => Promise<void>> = [];

    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const localUri = localMediaPaths[i];
      if (!localUri) continue;

      uploadTasks.push(async () => {
        const result = await uploadMedia({
          workId: payload.work_id,
          feature: 'chat',
          recordId: att.storage_path.split('/').slice(-2, -1)[0],
          fileUri: localUri,
          fileName: att.storage_path.split('/').pop()!,
          mimeType: att.mime_type,
        });
        att.file_size_bytes = result.fileSize || att.file_size_bytes;
      });
    }

    await runWithConcurrency(uploadTasks, MAX_PARALLEL_UPLOADS);
    payload.attachments = attachments;
  }

  await updateStatus(item.id, 'calling_rpc');

  const result = await callRpc<{ messageId: string; isNew: boolean }>(
    'rpc_send_work_message',
    payload as unknown as Record<string, unknown>,
  );

  if (!result.success) {
    throw new Error(result.error);
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
