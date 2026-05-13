import type { OutboxItem } from '@/types';
import { updateStatus } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';

type SetChecklistInProgressInput = {
  checklist_id: string;
  work_id: string;
};

const ADVANCED_STATUSES = new Set(['in_progress', 'awaiting_validation', 'validated']);

export async function handleSetChecklistInProgress(item: OutboxItem): Promise<void> {
  const payload = JSON.parse(item.payload) as SetChecklistInProgressInput;

  await updateStatus(item.id, 'calling_rpc');

  const { error } = await supabase
    .from('work_checklists')
    .update({ status: 'in_progress' })
    .eq('id', payload.checklist_id)
    .eq('work_id', payload.work_id)
    .select('id')
    .single();

  if (error) {
    const { data: current } = await supabase
      .from('work_checklists')
      .select('status')
      .eq('id', payload.checklist_id)
      .single();

    if (current && ADVANCED_STATUSES.has(current.status as string)) {
      return;
    }

    throw new Error(error.message);
  }
}
