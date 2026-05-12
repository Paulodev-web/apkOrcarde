import {
  clearAll,
  computeNextRetryIso,
  enqueue,
  getFailedItems,
  getPendingCount,
  markFailed,
  markSynced,
  processNext,
} from '@/lib/offline/outbox';

import { __getMockOutboxDb, __resetOutboxDb } from '../__mocks__/expo-sqlite';

beforeEach(() => {
  __resetOutboxDb();
});

describe('outbox queue', () => {
  it('enqueues an item with status=pending', async () => {
    const id = await enqueue({
      client_event_id: 'evt-1',
      action_type: 'send_message',
      payload: { foo: 'bar' },
    });
    expect(id).toBeGreaterThan(0);
    const next = await processNext();
    expect(next).not.toBeNull();
    expect(next?.status).toBe('pending');
    expect(next?.attempts).toBe(0);
    expect(JSON.parse(next?.payload ?? '{}')).toEqual({ foo: 'bar' });
  });

  it('processNext returns oldest pending item (FIFO)', async () => {
    const baseNow = new Date('2026-05-09T10:00:00.000Z').getTime();
    const realDateNow = Date.now;
    Date.now = jest.fn(() => baseNow);

    try {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(baseNow));
      await enqueue({ client_event_id: 'evt-a', action_type: 'send_message', payload: '{}' });
      jest.setSystemTime(new Date(baseNow + 1000));
      await enqueue({ client_event_id: 'evt-b', action_type: 'send_message', payload: '{}' });
      jest.setSystemTime(new Date(baseNow + 2000));
      await enqueue({ client_event_id: 'evt-c', action_type: 'send_message', payload: '{}' });
      jest.useRealTimers();

      const first = await processNext();
      expect(first?.client_event_id).toBe('evt-a');
    } finally {
      Date.now = realDateNow;
    }
  });

  it('processNext returns null when the queue is empty', async () => {
    const next = await processNext();
    expect(next).toBeNull();
  });

  it('markSynced sets status=synced and synced_at', async () => {
    const id = await enqueue({
      client_event_id: 'evt-sync',
      action_type: 'send_message',
      payload: '{}',
    });
    await markSynced(id);
    const next = await processNext();
    expect(next).toBeNull();
    expect(await getPendingCount()).toBe(0);
  });

  it('markFailed increments attempts and computes next_retry_at', async () => {
    const id = await enqueue({
      client_event_id: 'evt-fail-1',
      action_type: 'send_message',
      payload: '{}',
    });
    await markFailed(id, 'network down');

    const db = __getMockOutboxDb();
    const row = db.rows.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row?.attempts).toBe(1);
    expect(row?.last_error).toBe('network down');
    expect(row?.next_retry_at).not.toBeNull();
    expect(row?.status).toBe('pending');

    expect(await processNext()).toBeNull();
  });

  it('markFailed transitions to failed after max_attempts', async () => {
    const id = await enqueue({
      client_event_id: 'evt-fail-loop',
      action_type: 'send_message',
      payload: '{}',
      max_attempts: 2,
    });
    await markFailed(id, 'err 1');
    await markFailed(id, 'err 2');
    const next = await processNext();
    expect(next).toBeNull();
    const failed = await getFailedItems();
    expect(failed).toHaveLength(1);
    expect(failed[0]?.status).toBe('failed');
    expect(failed[0]?.attempts).toBe(2);
  });

  it('getPendingCount counts only active statuses', async () => {
    const idA = await enqueue({
      client_event_id: 'evt-count-a',
      action_type: 'send_message',
      payload: '{}',
    });
    await enqueue({
      client_event_id: 'evt-count-b',
      action_type: 'send_message',
      payload: '{}',
    });
    expect(await getPendingCount()).toBe(2);
    await markSynced(idA);
    expect(await getPendingCount()).toBe(1);
  });

  it('clearAll wipes the queue', async () => {
    await enqueue({ client_event_id: 'evt-clear-1', action_type: 'send_message', payload: '{}' });
    await enqueue({ client_event_id: 'evt-clear-2', action_type: 'send_message', payload: '{}' });
    await clearAll();
    expect(await getPendingCount()).toBe(0);
    expect(await processNext()).toBeNull();
  });

  it('enqueue with duplicate client_event_id is idempotent', async () => {
    const idA = await enqueue({
      client_event_id: 'evt-dup',
      action_type: 'send_message',
      payload: { v: 1 },
    });
    const idB = await enqueue({
      client_event_id: 'evt-dup',
      action_type: 'send_message',
      payload: { v: 2 },
    });
    expect(idA).toBe(idB);
    expect(await getPendingCount()).toBe(1);
  });
});

describe('computeNextRetryIso', () => {
  it('uses the configured backoff steps', () => {
    const now = new Date('2026-05-09T12:00:00.000Z').getTime();
    expect(new Date(computeNextRetryIso(1, now)).getTime() - now).toBe(1_000);
    expect(new Date(computeNextRetryIso(2, now)).getTime() - now).toBe(5_000);
    expect(new Date(computeNextRetryIso(3, now)).getTime() - now).toBe(15_000);
    expect(new Date(computeNextRetryIso(4, now)).getTime() - now).toBe(60_000);
  });

  it('caps the delay at the last backoff step', () => {
    const now = new Date('2026-05-09T12:00:00.000Z').getTime();
    expect(new Date(computeNextRetryIso(99, now)).getTime() - now).toBe(60_000);
  });
});
