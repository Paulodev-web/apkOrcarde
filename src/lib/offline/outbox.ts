import { OUTBOX_DEFAULTS } from '@/constants/limits';
import type { EnqueueOutboxInput, OutboxItem, OutboxStatus } from '@/types';

import { getDb } from './db';

type OutboxListener = () => void;

class OutboxEmitter {
  private listeners = new Set<OutboxListener>();

  subscribe(fn: OutboxListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    for (const fn of this.listeners) {
      try { fn(); } catch { /* swallow */ }
    }
  }
}

export const outboxEmitter = new OutboxEmitter();

type OutboxRow = {
  id: number;
  client_event_id: string;
  action_type: string;
  payload: string;
  media_paths: string | null;
  status: OutboxStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
  next_retry_at: string | null;
};

const ACTIVE_STATUSES: readonly OutboxStatus[] = ['pending', 'uploading_media', 'calling_rpc'];

export async function enqueue(input: EnqueueOutboxInput): Promise<number> {
  const db = await getDb();

  const payload =
    typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload);
  const mediaPaths = input.media_paths ? JSON.stringify(input.media_paths) : null;
  const maxAttempts = input.max_attempts ?? OUTBOX_DEFAULTS.MAX_ATTEMPTS;
  const createdAt = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO outbox (client_event_id, action_type, payload, media_paths, status, max_attempts, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)
     ON CONFLICT(client_event_id) DO NOTHING`,
    [input.client_event_id, input.action_type, payload, mediaPaths, maxAttempts, createdAt],
  );

  if (result.changes > 0 && result.lastInsertRowId > 0) {
    outboxEmitter.emit();
    return result.lastInsertRowId;
  }

  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM outbox WHERE client_event_id = ? LIMIT 1`,
    [input.client_event_id],
  );
  if (existing && typeof existing.id === 'number') {
    return existing.id;
  }
  throw new Error('Failed to enqueue outbox item');
}

export async function processNext(): Promise<OutboxItem | null> {
  const db = await getDb();
  const nowIso = new Date().toISOString();

  const row = await db.getFirstAsync<OutboxRow>(
    `SELECT * FROM outbox
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
    [nowIso],
  );

  return row ? rowToItem(row) : null;
}

export async function markSynced(id: number): Promise<void> {
  const db = await getDb();
  const syncedAt = new Date().toISOString();

  await db.runAsync(
    `UPDATE outbox SET status = 'synced', synced_at = ?, last_error = NULL WHERE id = ?`,
    [syncedAt, id],
  );
  outboxEmitter.emit();
}

export async function markFailed(id: number, error: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<OutboxRow>(
    `SELECT id, attempts, max_attempts FROM outbox WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!row) return;

  const newAttempts = row.attempts + 1;
  const isExhausted = newAttempts >= row.max_attempts;
  const status: OutboxStatus = isExhausted ? 'failed' : 'pending';
  const nextRetryAt = isExhausted ? null : computeNextRetryIso(newAttempts);

  await db.runAsync(
    `UPDATE outbox
       SET attempts = ?, last_error = ?, next_retry_at = ?, status = ?
     WHERE id = ?`,
    [newAttempts, error, nextRetryAt, status, id],
  );
  outboxEmitter.emit();
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const placeholders = ACTIVE_STATUSES.map(() => '?').join(',');
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM outbox WHERE status IN (${placeholders})`,
    [...ACTIVE_STATUSES],
  );
  return row?.count ?? 0;
}

export async function updateStatus(id: number, status: OutboxStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE outbox SET status = ? WHERE id = ?`, [status, id]);
  outboxEmitter.emit();
}

export async function markFailedNoRetry(id: number, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET status = 'failed', last_error = ? WHERE id = ?`,
    [error, id],
  );
  outboxEmitter.emit();
}

export async function getPendingItemsByAction(
  actionType: string,
  workId?: string,
): Promise<OutboxItem[]> {
  const db = await getDb();
  const query = `SELECT * FROM outbox WHERE action_type = ? AND status IN ('pending','uploading_media','calling_rpc','failed') ORDER BY created_at ASC`;

  const rows = await db.getAllAsync<OutboxRow>(query, [actionType]);

  if (!workId) return rows.map(rowToItem);

  return rows
    .map(rowToItem)
    .filter((item) => {
      try {
        const payload = JSON.parse(item.payload) as Record<string, unknown>;
        return payload.work_id === workId;
      } catch {
        return false;
      }
    });
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM outbox`);
  outboxEmitter.emit();
}

export async function getFailedItems(): Promise<OutboxItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'failed' ORDER BY created_at DESC`,
  );
  return rows.map(rowToItem);
}

export function computeNextRetryIso(attemptNumber: number, now: number = Date.now()): string {
  const steps = OUTBOX_DEFAULTS.BACKOFF_STEPS_MS;
  const idx = Math.min(Math.max(attemptNumber - 1, 0), steps.length - 1);
  return new Date(now + steps[idx]).toISOString();
}

function rowToItem(row: OutboxRow): OutboxItem {
  return {
    id: row.id,
    client_event_id: row.client_event_id,
    action_type: row.action_type,
    payload: row.payload,
    media_paths: row.media_paths,
    status: row.status,
    attempts: row.attempts,
    max_attempts: row.max_attempts,
    last_error: row.last_error,
    created_at: row.created_at,
    synced_at: row.synced_at,
    next_retry_at: row.next_retry_at,
  };
}
