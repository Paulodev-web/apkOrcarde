import type { OutboxItem } from '@/types';
import { updateStatus } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';

type RemovePoleInstallationInput = {
  installation_id: string;
  work_id?: string;
  removed_at?: string;
  removed_by?: string | null;
};

export async function handleRemovePoleInstallation(item: OutboxItem): Promise<void> {
  const payload = JSON.parse(item.payload) as RemovePoleInstallationInput;

  if (!payload.installation_id) {
    throw new Error('installation_id is required to remove a pole installation.');
  }

  await updateStatus(item.id, 'calling_rpc');

  const removedBy = payload.removed_by ?? await getCurrentUserId();
  const removedAt = payload.removed_at ?? new Date().toISOString();

  let query = supabase
    .from('work_pole_installations')
    .update({
      status: 'removed',
      removed_at: removedAt,
      removed_by: removedBy,
    })
    .eq('id', payload.installation_id);

  if (payload.work_id) {
    query = query.eq('work_id', payload.work_id);
  }

  const { error } = await query.select('id').single();

  if (error) {
    throw new Error(error.message);
  }
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new Error('Unable to resolve current user for pole removal.');
  }

  return userId;
}
