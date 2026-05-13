type OutboxRow = {
  id: number;
  client_event_id: string;
  action_type: string;
  payload: string;
  media_paths: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
  next_retry_at: string | null;
  status_updated_at: string | null;
};

class InMemoryOutboxDb {
  rows: OutboxRow[] = [];
  nextId = 1;

  reset(): void {
    this.rows = [];
    this.nextId = 1;
  }

  async execAsync(_sql: string): Promise<void> {
    return;
  }

  async runAsync(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const norm = sql.replace(/\s+/g, ' ').trim().toUpperCase();

    if (norm.startsWith('INSERT INTO OUTBOX')) {
      const [client_event_id, action_type, payload, media_paths, max_attempts, created_at] =
        params as [string, string, string, string | null, number, string];
      if (this.rows.find((r) => r.client_event_id === client_event_id)) {
        return { lastInsertRowId: 0, changes: 0 };
      }
      const id = this.nextId++;
      this.rows.push({
        id,
        client_event_id,
        action_type,
        payload,
        media_paths: media_paths ?? null,
        status: 'pending',
        attempts: 0,
        max_attempts,
        last_error: null,
        created_at,
        synced_at: null,
        next_retry_at: null,
        status_updated_at: null,
      });
      return { lastInsertRowId: id, changes: 1 };
    }

    if (norm.startsWith("UPDATE OUTBOX SET STATUS = 'SYNCED'")) {
      const [synced_at, status_updated_at, id] = params as [string, string, number];
      const row = this.rows.find((r) => r.id === id);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.status = 'synced';
      row.synced_at = synced_at;
      row.last_error = null;
      row.status_updated_at = status_updated_at;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (norm.startsWith('UPDATE OUTBOX SET ATTEMPTS')) {
      const [attempts, last_error, next_retry_at, status, status_updated_at, id] = params as [
        number,
        string,
        string | null,
        string,
        string,
        number,
      ];
      const row = this.rows.find((r) => r.id === id);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.attempts = attempts;
      row.last_error = last_error;
      row.next_retry_at = next_retry_at;
      row.status = status;
      row.status_updated_at = status_updated_at;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (norm.startsWith("UPDATE OUTBOX SET STATUS = 'FAILED'")) {
      const [last_error, status_updated_at, id] = params as [string, string, number];
      const row = this.rows.find((r) => r.id === id);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.status = 'failed';
      row.last_error = last_error;
      row.status_updated_at = status_updated_at;
      return { lastInsertRowId: 0, changes: 1 };
    }

    // updateStatus: SET STATUS = ?, STATUS_UPDATED_AT = ? WHERE ID = ?
    if (norm.includes('SET STATUS = ?') && norm.includes('STATUS_UPDATED_AT = ?') && !norm.includes('ATTEMPTS')) {
      const [status, status_updated_at, id] = params as [string, string, number];
      const row = this.rows.find((r) => r.id === id);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.status = status;
      row.status_updated_at = status_updated_at;
      return { lastInsertRowId: 0, changes: 1 };
    }

    // recoverStuckItems
    if (norm.includes("IN ('UPLOADING_MEDIA', 'CALLING_RPC')") || norm.includes("IN ('UPLOADING_MEDIA','CALLING_RPC')")) {
      const [status_updated_at, cutoff] = params as [string, string];
      let changes = 0;
      for (const row of this.rows) {
        if (
          (row.status === 'uploading_media' || row.status === 'calling_rpc') &&
          (row.status_updated_at ?? row.created_at) < cutoff
        ) {
          row.status = 'pending';
          row.status_updated_at = status_updated_at;
          changes++;
        }
      }
      return { lastInsertRowId: 0, changes };
    }

    // retryFailedItem
    if (norm.includes("STATUS = 'PENDING'") && norm.includes('ATTEMPTS = 0') && norm.includes("STATUS = 'FAILED'")) {
      const [status_updated_at, id] = params as [string, number];
      const row = this.rows.find((r) => r.id === id && r.status === 'failed');
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.status = 'pending';
      row.attempts = 0;
      row.next_retry_at = null;
      row.last_error = null;
      row.status_updated_at = status_updated_at;
      return { lastInsertRowId: 0, changes: 1 };
    }

    // discardItem or clearAll
    if (norm.startsWith('DELETE FROM OUTBOX WHERE ID')) {
      const [id] = params as [number];
      const idx = this.rows.findIndex((r) => r.id === id);
      if (idx === -1) return { lastInsertRowId: 0, changes: 0 };
      this.rows.splice(idx, 1);
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (norm.startsWith('DELETE FROM OUTBOX')) {
      const before = this.rows.length;
      this.rows = [];
      return { lastInsertRowId: 0, changes: before };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getAllAsync<T = OutboxRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const norm = sql.replace(/\s+/g, ' ').trim().toUpperCase();

    if (norm.includes("WHERE STATUS != 'SYNCED'")) {
      const out = this.rows.filter((r) => r.status !== 'synced');
      out.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return out as unknown as T[];
    }

    if (norm.includes("WHERE STATUS = 'FAILED'")) {
      const out = this.rows.filter((r) => r.status === 'failed');
      out.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return out as unknown as T[];
    }
    if (norm.includes('WHERE ACTION_TYPE')) {
      const [actionType] = params as [string];
      const out = this.rows.filter(
        (r) => r.action_type === actionType && ['pending', 'uploading_media', 'calling_rpc', 'failed'].includes(r.status),
      );
      out.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return out as unknown as T[];
    }

    if (norm.includes('PRAGMA TABLE_INFO')) {
      return [
        { name: 'id' },
        { name: 'client_event_id' },
        { name: 'action_type' },
        { name: 'payload' },
        { name: 'media_paths' },
        { name: 'status' },
        { name: 'attempts' },
        { name: 'max_attempts' },
        { name: 'last_error' },
        { name: 'created_at' },
        { name: 'synced_at' },
        { name: 'next_retry_at' },
        { name: 'status_updated_at' },
      ] as unknown as T[];
    }

    return this.rows as unknown as T[];
  }

  async getFirstAsync<T = OutboxRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const norm = sql.replace(/\s+/g, ' ').trim().toUpperCase();

    if (norm.includes('SELECT COUNT(*)')) {
      const count = this.rows.filter((r) =>
        ['pending', 'uploading_media', 'calling_rpc'].includes(r.status),
      ).length;
      return { count } as unknown as T;
    }

    if (norm.includes("WHERE STATUS = 'PENDING'")) {
      const [nowIso] = params as [string];
      const pending = this.rows
        .filter((r) => r.status === 'pending')
        .filter((r) => !r.next_retry_at || r.next_retry_at <= (nowIso ?? ''));
      pending.sort((a, b) => {
        const cmp = a.created_at.localeCompare(b.created_at);
        return cmp !== 0 ? cmp : a.id - b.id;
      });
      return (pending[0] ?? null) as unknown as T | null;
    }

    if (norm.includes('WHERE CLIENT_EVENT_ID')) {
      const [client_event_id] = params as [string];
      const found = this.rows.find((r) => r.client_event_id === client_event_id);
      return (found ?? null) as unknown as T | null;
    }

    if (norm.includes('WHERE ID')) {
      const [id] = params as [number];
      const found = this.rows.find((r) => r.id === id);
      return (found ?? null) as unknown as T | null;
    }

    return null;
  }
}

const mockDb = new InMemoryOutboxDb();

export function __resetOutboxDb(): void {
  mockDb.reset();
}

export function __getMockOutboxDb(): InMemoryOutboxDb {
  return mockDb;
}

export const openDatabaseAsync = jest.fn(async () => mockDb);
