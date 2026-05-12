import * as SQLite from 'expo-sqlite';

const DB_NAME = 'orcarede.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_event_id TEXT    NOT NULL UNIQUE,
  action_type     TEXT    NOT NULL,
  payload         TEXT    NOT NULL,
  media_paths     TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending',
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  last_error      TEXT,
  created_at      TEXT    NOT NULL,
  synced_at       TEXT,
  next_retry_at   TEXT
);
`;

const STATUS_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS outbox_status_created_at_idx
  ON outbox (status, created_at);
`;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(STATUS_INDEX_SQL);
  return db;
}

export function __resetDbForTests(): void {
  dbPromise = null;
}
