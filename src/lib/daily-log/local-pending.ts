import type { OutboxItem, WorkDailyLog, DailyLogStatus } from '@/types';
import type { PublishDailyLogInput } from '@/types/rpc';
import { getPendingItemsByAction } from '@/lib/offline/outbox';

export type LocalDailyLogItem = {
  kind: 'local';
  item: OutboxItem;
  payload: PublishDailyLogInput;
};

export type RemoteDailyLogItem = {
  kind: 'remote';
  log: WorkDailyLog;
};

export type DailyLogListItem = LocalDailyLogItem | RemoteDailyLogItem;

export async function getLocalPendingDailyLogs(workId: string): Promise<LocalDailyLogItem[]> {
  const items = await getPendingItemsByAction('publish_daily_log', workId);
  return items.map((item) => ({
    kind: 'local' as const,
    item,
    payload: JSON.parse(item.payload) as PublishDailyLogInput,
  }));
}

/**
 * Merge remote daily logs with local pending items.
 * Local items for the same date override the remote entry to show the pending state.
 */
export function mergeDailyLogLists(
  remoteLogs: WorkDailyLog[],
  localItems: LocalDailyLogItem[],
): DailyLogListItem[] {
  const localByDate = new Map<string, LocalDailyLogItem>();
  const localByLogId = new Set<string>();

  for (const local of localItems) {
    localByDate.set(local.payload.log_date, local);
    localByLogId.add(local.payload.daily_log_id);
  }

  const result: DailyLogListItem[] = [];

  for (const log of remoteLogs) {
    if (localByLogId.has(log.id)) {
      const local = localItems.find((l) => l.payload.daily_log_id === log.id);
      if (local && local.item.status !== 'synced') {
        result.push(local);
        localByDate.delete(local.payload.log_date);
        continue;
      }
    }

    if (localByDate.has(log.log_date)) {
      const local = localByDate.get(log.log_date)!;
      if (local.item.status !== 'synced') {
        result.push(local);
        localByDate.delete(log.log_date);
        continue;
      }
    }

    result.push({ kind: 'remote', log });
  }

  for (const local of localByDate.values()) {
    if (local.item.status !== 'synced') {
      result.push(local);
    }
  }

  result.sort((a, b) => {
    const aDate = a.kind === 'remote' ? a.log.log_date : a.payload.log_date;
    const bDate = b.kind === 'remote' ? b.log.log_date : b.payload.log_date;
    return bDate.localeCompare(aDate);
  });

  return result;
}

export function getStatusLabel(status: DailyLogStatus): string {
  switch (status) {
    case 'pending_approval': return 'Aguardando aprovacao';
    case 'approved': return 'Aprovado';
    case 'rejected': return 'Rejeitado';
  }
}

export function getStatusColor(status: DailyLogStatus): { bg: string; fg: string } {
  switch (status) {
    case 'pending_approval': return { bg: '#fdf3d6', fg: '#7a5b00' };
    case 'approved': return { bg: '#dff6e1', fg: '#1a6b2c' };
    case 'rejected': return { bg: '#fdecea', fg: '#7a1f17' };
  }
}
