import type { DatabaseSync } from 'node:sqlite';

import type { Row, StorageBackend, TableName } from './backend';

/**
 * Durable backend on `node:sqlite`. Each table stores the row as JSON in
 * `data` plus the columns the operator needs to inspect or index directly
 * (dedup key uniqueness, lease owner/expiry, attempt state, check-run id).
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  dedup_key TEXT NOT NULL UNIQUE,
  profile TEXT NOT NULL,
  state TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS request_dedup (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  state TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_request_idx ON attempts (request_id);
CREATE INDEX IF NOT EXISTS attempts_state_idx ON attempts (state);
CREATE TABLE IF NOT EXISTS leases (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  check_run_id INTEGER,
  state TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS heartbeats (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
`;

type ColumnExtractor = (row: Row) => Record<string, string | number | null>;

const asText = (value: unknown): string => (typeof value === 'string' ? value : String(value));
const asIntegerOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

const EXTRA_COLUMNS: Readonly<Record<TableName, ColumnExtractor>> = {
  requests: (row) => ({
    dedup_key: asText(row.dedupKey),
    profile: asText(row.profile),
    state: asText(row.state),
  }),
  request_dedup: () => ({}),
  attempts: (row) => ({ request_id: asText(row.requestId), state: asText(row.state) }),
  leases: (row) => ({ owner: asText(row.owner), expires_at: asText(row.expiresAt) }),
  publications: (row) => ({
    check_run_id: asIntegerOrNull(row.checkRunId),
    state: asText(row.state),
  }),
  heartbeats: (row) => ({ at: asText(row.at) }),
  counters: () => ({}),
};

export class SqliteUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      'node:sqlite is unavailable in this runtime. The controller queue requires Node.js 22.13+ ' +
        '(node:sqlite unflagged). Run the controller under the pinned runtime (node22) or pass ' +
        '--store memory for a non-durable dry run.',
    );
    this.name = 'SqliteUnavailableError';
    this.cause = cause;
  }
}

async function loadDatabaseSync(): Promise<typeof DatabaseSync> {
  try {
    const moduleName = 'node:sqlite';
    const sqlite = (await import(moduleName)) as { DatabaseSync?: typeof DatabaseSync };
    if (typeof sqlite.DatabaseSync !== 'function') {
      throw new Error('node:sqlite loaded without DatabaseSync');
    }
    return sqlite.DatabaseSync;
  } catch (error) {
    throw new SqliteUnavailableError(error);
  }
}

function parseRow(value: unknown): Row {
  if (typeof value !== 'string') {
    throw new Error('Corrupt queue row: data column is not text');
  }
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Corrupt queue row: data column is not an object');
  }
  return parsed as Row;
}

export async function openSqliteBackend(filePath: string): Promise<StorageBackend> {
  const Database = await loadDatabaseSync();
  const db = new Database(filePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);

  const put = (table: TableName, id: string, row: Row): void => {
    const extra = EXTRA_COLUMNS[table](row);
    const columns = ['id', ...Object.keys(extra), 'data'];
    const placeholders = columns.map(() => '?').join(', ');
    const statement = db.prepare(
      `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    );
    statement.run(id, ...Object.values(extra), JSON.stringify(row));
  };

  let depth = 0;
  return {
    get: (table, id) => {
      const found = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
      return found ? parseRow(found.data) : undefined;
    },
    put,
    delete: (table, id) => {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    },
    list: (table) =>
      db
        .prepare(`SELECT data FROM ${table} ORDER BY rowid ASC`)
        .all()
        .map((found) => parseRow(found.data)),
    transaction: (fn) => {
      if (depth > 0) return fn();
      depth += 1;
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        depth -= 1;
      }
    },
    close: () => {
      db.close();
    },
  };
}
