import NetInfo from '@react-native-community/netinfo';

import { enqueue, markFailed, processNext } from '@/lib/offline/outbox';
import { registerHandler } from '@/lib/offline/sync-handlers';
import { startSyncWorker } from '@/lib/offline/sync-worker';
import { useSyncStore } from '@/stores/sync.store';

import { __resetOutboxDb } from '../__mocks__/expo-sqlite';

const mockNetInfoFetch = NetInfo.fetch as jest.Mock;

beforeEach(() => {
  __resetOutboxDb();
  mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  useSyncStore.getState().setPendingCount(0);
  useSyncStore.getState().setSyncing(false);
});

describe('sync-worker', () => {
  it('processes items FIFO when online', async () => {
    const processed: string[] = [];
    registerHandler('send_message', async (item) => {
      const payload = JSON.parse(item.payload) as { content: string };
      processed.push(payload.content);
    });

    await enqueue({ client_event_id: 'a', action_type: 'send_message', payload: { content: 'first' } });
    await enqueue({ client_event_id: 'b', action_type: 'send_message', payload: { content: 'second' } });

    const stop = startSyncWorker();
    await delay(1000);
    stop();

    expect(processed).toEqual(['first', 'second']);
  });

  it('stops processing when offline', async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });

    const processed: string[] = [];
    registerHandler('send_message', async (item) => {
      const payload = JSON.parse(item.payload) as { content: string };
      processed.push(payload.content);
    });

    await enqueue({ client_event_id: 'c', action_type: 'send_message', payload: { content: 'offline' } });

    const stop = startSyncWorker();
    await delay(800);
    stop();

    expect(processed).toHaveLength(0);
  });

  it('skips items with next_retry_at in the future', async () => {
    const id = await enqueue({ client_event_id: 'd', action_type: 'send_message', payload: '{}' });
    await markFailed(id, 'temporary error');

    const item = await processNext();
    expect(item).toBeNull();
  });

  it('marks items with validation errors as failed without retry', async () => {
    registerHandler('send_message', async () => {
      const err = new Error('Acesso negado');
      (err as unknown as { code: string }).code = 'P0403';
      throw err;
    });

    await enqueue({ client_event_id: 'e', action_type: 'send_message', payload: '{}' });

    const stop = startSyncWorker();
    await delay(800);
    stop();

    const item = await processNext();
    expect(item).toBeNull();
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
