import type { OutboxItem, WorkMilestone, MilestoneStatus } from '@/types';
import type { ReportMilestoneInput } from '@/types/rpc';
import { getPendingItemsByAction } from '@/lib/offline/outbox';

export async function getLocalPendingMilestoneActions(
  workId: string,
): Promise<Map<string, MilestoneStatus>> {
  const reportItems = await getPendingItemsByAction('report_milestone', workId);
  const statusItems = await getPendingItemsByAction('set_milestone_in_progress', workId);

  const overrides = new Map<string, MilestoneStatus>();

  for (const item of statusItems) {
    try {
      const payload = JSON.parse(item.payload) as { milestone_id: string };
      if (item.status !== 'synced') {
        overrides.set(payload.milestone_id, 'in_progress');
      }
    } catch { /* swallow */ }
  }

  for (const item of reportItems) {
    try {
      const payload = JSON.parse(item.payload) as ReportMilestoneInput;
      if (item.status !== 'synced') {
        overrides.set(payload.milestone_id, 'awaiting_approval');
      }
    } catch { /* swallow */ }
  }

  return overrides;
}

export function applyLocalOverrides(
  milestones: WorkMilestone[],
  overrides: Map<string, MilestoneStatus>,
): WorkMilestone[] {
  if (overrides.size === 0) return milestones;

  return milestones.map((m) => {
    const localStatus = overrides.get(m.id);
    if (!localStatus) return m;
    return { ...m, status: localStatus };
  });
}

export function getMilestoneStatusLabel(status: MilestoneStatus): string {
  switch (status) {
    case 'pending': return 'Pendente';
    case 'in_progress': return 'Em andamento';
    case 'awaiting_approval': return 'Aguardando aprovacao';
    case 'approved': return 'Aprovado';
    case 'rejected': return 'Rejeitado';
  }
}

export function getMilestoneStatusColor(status: MilestoneStatus): { bg: string; fg: string } {
  switch (status) {
    case 'pending': return { bg: '#e3e8ef', fg: '#5a6473' };
    case 'in_progress': return { bg: '#e3effc', fg: '#0a3a82' };
    case 'awaiting_approval': return { bg: '#fdf3d6', fg: '#7a5b00' };
    case 'approved': return { bg: '#dff6e1', fg: '#1a6b2c' };
    case 'rejected': return { bg: '#fdecea', fg: '#7a1f17' };
  }
}
