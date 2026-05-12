import NetInfo from '@react-native-community/netinfo';

import { captureBreadcrumb, captureException } from '@/lib/sentry';
import { isNonRetryableError } from '@/lib/supabase/rpc';
import { useSyncStore } from '@/stores/sync.store';

import {
  getPendingCount,
  markFailed,
  markFailedNoRetry,
  markSynced,
  outboxEmitter,
  processNext,
} from './outbox';
import { getHandler } from './sync-handlers';
import { registerHandler } from './sync-handlers';
import { handleSendMessage } from './handlers/chat.handler';
import { handleRecordPoleInstallation } from './handlers/pole.handler';
import { handleRemovePoleInstallation } from './handlers/pole-remove.handler';

registerHandler('send_message', handleSendMessage);
registerHandler('record_pole_installation', handleRecordPoleInstallation);
registerHandler('remove_pole_installation', handleRemovePoleInstallation);

let running = false;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

async function processQueue(): Promise<void> {
  if (running) return;
  running = true;
  useSyncStore.getState().setSyncing(true);

  try {
    while (true) {
      const state = await NetInfo.fetch();
      if (!state.isConnected) break;

      const item = await processNext();
      if (!item) break;

      const handler = getHandler(item.action_type);
      if (!handler) {
        await markFailedNoRetry(item.id, `No handler for action_type: ${item.action_type}`);
        continue;
      }

      captureBreadcrumb('sync', `Processing ${item.action_type} id=${item.id}`);

      try {
        await handler(item);
        await markSynced(item.id);
        captureBreadcrumb('sync', `Synced ${item.action_type} id=${item.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        captureBreadcrumb('sync', `Failed ${item.action_type} id=${item.id}: ${message}`);

        const code = extractErrorCode(err);
        if (isNonRetryableError(code)) {
          await markFailedNoRetry(item.id, message);
        } else {
          await markFailed(item.id, message);
        }
      }
    }
  } catch (err) {
    captureException(err);
  } finally {
    running = false;
    useSyncStore.getState().setSyncing(false);
    await refreshPendingCount();
  }
}

async function refreshPendingCount(): Promise<void> {
  try {
    const count = await getPendingCount();
    useSyncStore.getState().setPendingCount(count);
  } catch { /* swallow */ }
}

function scheduleWake(): void {
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = setTimeout(() => {
    void processQueue();
  }, 300);
}

function extractErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code: unknown }).code);
  }
  return undefined;
}

export function startSyncWorker(): () => void {
  const unsubOutbox = outboxEmitter.subscribe(() => {
    void refreshPendingCount();
    scheduleWake();
  });

  const unsubNet = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      scheduleWake();
    }
  });

  scheduleWake();

  return () => {
    unsubOutbox();
    unsubNet();
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = null;
    }
  };
}
