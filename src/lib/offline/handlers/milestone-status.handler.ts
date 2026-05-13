import type { OutboxItem } from '@/types';
import { updateStatus } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';

type SetMilestoneInProgressInput = {
  milestone_id: string;
  work_id: string;
};

const ADVANCED_STATUSES = new Set(['in_progress', 'awaiting_approval', 'approved']);

export async function handleSetMilestoneInProgress(item: OutboxItem): Promise<void> {
  const payload = JSON.parse(item.payload) as SetMilestoneInProgressInput;

  await updateStatus(item.id, 'calling_rpc');

  const { error } = await supabase
    .from('work_milestones')
    .update({ status: 'in_progress' })
    .eq('id', payload.milestone_id)
    .eq('work_id', payload.work_id)
    .select('id')
    .single();

  if (error) {
    const { data: current } = await supabase
      .from('work_milestones')
      .select('status')
      .eq('id', payload.milestone_id)
      .single();

    if (current && ADVANCED_STATUSES.has(current.status as string)) {
      return;
    }

    throw new Error(error.message);
  }
}
