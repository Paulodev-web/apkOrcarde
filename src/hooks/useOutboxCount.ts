import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { getPendingCount, outboxEmitter } from '@/lib/offline/outbox';
import { useSyncStore } from '@/stores/sync.store';

export function useOutboxCount(): { pendingCount: number; refresh: () => Promise<void> } {
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const setPendingCount = useSyncStore((state) => state.setPendingCount);

  const refresh = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, [setPendingCount]);

  useEffect(() => {
    void refresh();
    const unsub = outboxEmitter.subscribe(() => void refresh());
    return unsub;
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { pendingCount, refresh };
}
