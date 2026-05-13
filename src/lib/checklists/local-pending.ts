import type { OutboxItem, WorkChecklist, WorkChecklistItem, ChecklistStatus } from '@/types';
import type { MarkChecklistItemInput } from '@/types/rpc';
import { getPendingItemsByAction } from '@/lib/offline/outbox';

export type LocalChecklistItemOverride = {
  itemId: string;
  is_completed: boolean;
};

export async function getLocalPendingChecklistOverrides(
  workId: string,
): Promise<{
  statusOverrides: Map<string, ChecklistStatus>;
  itemOverrides: Map<string, boolean>;
}> {
  const statusItems = await getPendingItemsByAction('set_checklist_in_progress', workId);
  const markItems = await getPendingItemsByAction('mark_checklist_item', workId);

  const statusOverrides = new Map<string, ChecklistStatus>();
  const itemOverrides = new Map<string, boolean>();

  for (const item of statusItems) {
    try {
      const payload = JSON.parse(item.payload) as { checklist_id: string };
      if (item.status !== 'synced') {
        statusOverrides.set(payload.checklist_id, 'in_progress');
      }
    } catch { /* swallow */ }
  }

  for (const item of markItems) {
    try {
      const payload = JSON.parse(item.payload) as MarkChecklistItemInput;
      if (item.status !== 'synced') {
        itemOverrides.set(payload.item_id, payload.is_completed);
      }
    } catch { /* swallow */ }
  }

  return { statusOverrides, itemOverrides };
}

export function applyChecklistStatusOverrides(
  checklists: WorkChecklist[],
  overrides: Map<string, ChecklistStatus>,
): WorkChecklist[] {
  if (overrides.size === 0) return checklists;

  return checklists.map((c) => {
    const localStatus = overrides.get(c.id);
    if (!localStatus) return c;
    return { ...c, status: localStatus };
  });
}

export function applyItemOverrides(
  items: WorkChecklistItem[],
  overrides: Map<string, boolean>,
): WorkChecklistItem[] {
  if (overrides.size === 0) return items;

  return items.map((item) => {
    const localCompleted = overrides.get(item.id);
    if (localCompleted === undefined) return item;
    return {
      ...item,
      is_completed: localCompleted,
      completed_at: localCompleted ? new Date().toISOString() : null,
    };
  });
}

export function deriveChecklistProgress(
  items: WorkChecklistItem[],
): { done: number; total: number } {
  const total = items.length;
  const done = items.filter((i) => i.is_completed).length;
  return { done, total };
}

export function getChecklistStatusLabel(status: ChecklistStatus): string {
  switch (status) {
    case 'pending': return 'Pendente';
    case 'in_progress': return 'Em andamento';
    case 'awaiting_validation': return 'Aguardando validacao';
    case 'validated': return 'Validado';
    case 'returned': return 'Devolvido';
  }
}

export function getChecklistStatusColor(status: ChecklistStatus): { bg: string; fg: string } {
  switch (status) {
    case 'pending': return { bg: '#e3e8ef', fg: '#5a6473' };
    case 'in_progress': return { bg: '#e3effc', fg: '#0a3a82' };
    case 'awaiting_validation': return { bg: '#fdf3d6', fg: '#7a5b00' };
    case 'validated': return { bg: '#dff6e1', fg: '#1a6b2c' };
    case 'returned': return { bg: '#fdecea', fg: '#7a1f17' };
  }
}
