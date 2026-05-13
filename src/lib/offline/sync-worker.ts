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
  recoverStuckItems,
} from './outbox';
import { getHandler, registerHandler } from './sync-handlers';
import { handleSendMessage } from './handlers/chat.handler';
import { handlePublishDailyLog } from './handlers/daily-log.handler';
import { handleRecordPoleInstallation } from './handlers/pole.handler';
import { handleRemovePoleInstallation } from './handlers/pole-remove.handler';
import { handleReportMilestone } from './handlers/milestone.handler';
import { handleSetMilestoneInProgress } from './handlers/milestone-status.handler';
import { handleMarkChecklistItem } from './handlers/checklist.handler';
import { handleSetChecklistInProgress } from './handlers/checklist-status.handler';
import { handleOpenAlert } from './handlers/alert-open.handler';
import { handleResolveAlert } from './handlers/alert-resolve.handler';
import { handleAddAlertComment } from './handlers/alert-comment.handler';

registerHandler('send_message', handleSendMessage);
registerHandler('publish_daily_log', handlePublishDailyLog);
registerHandler('record_pole_installation', handleRecordPoleInstallation);
registerHandler('remove_pole_installation', handleRemovePoleInstallation);
registerHandler('report_milestone', handleReportMilestone);
registerHandler('set_milestone_in_progress', handleSetMilestoneInProgress);
registerHandler('mark_checklist_item', handleMarkChecklistItem);
registerHandler('set_checklist_in_progress', handleSetChecklistInProgress);
registerHandler('open_alert', handleOpenAlert);
registerHandler('resolve_alert_in_field', handleResolveAlert);
registerHandler('add_alert_comment', handleAddAlertComment);

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

      captureBreadcrumb('sync', `Processing ${item.action_type}`, {
        client_event_id: item.client_event_id,
        attempt: item.attempts + 1,
        id: item.id,
      });

      try {
        await handler(item);
        await markSynced(item.id);
        captureBreadcrumb('sync', `Synced ${item.action_type}`, {
          client_event_id: item.client_event_id,
          id: item.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        captureBreadcrumb(
          'sync',
          `Failed ${item.action_type}: ${message}`,
          { client_event_id: item.client_event_id, id: item.id, code: extractErrorCode(err) },
          'error',
        );

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
  // Recover items that were stuck mid-processing when app crashed
  void recoverStuckItems().then((recovered) => {
    if (recovered > 0) {
      captureBreadcrumb('sync', `Recovered ${recovered} stuck items on boot`, {
        recovered,
      }, 'warning');
    }
  });

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
