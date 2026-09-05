import type {
  CoordinatorContext,
  CoordinatorStorage,
  SqlRow,
  SqlValue,
} from '../../src/coordinator';
import type { DatabaseSync } from 'node:sqlite';

export type FakeCoordinatorStorage = CoordinatorStorage & {
  alarmAt: number | null;
  close(): void;
};

type SqliteBinding = null | number | string | Uint8Array;

function toBinding(value: SqlValue): SqliteBinding {
  return value instanceof ArrayBuffer ? new Uint8Array(value) : value;
}

/** node:sqlite-backed stand-in for Cloudflare's SQLite Durable Object storage. */
export async function createSqliteContext(): Promise<
  CoordinatorContext & { readonly storage: FakeCoordinatorStorage }
> {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = () => undefined; // node:sqlite prints an ExperimentalWarning on load.
  let db: DatabaseSync;
  try {
    const sqlite = await import('node:sqlite');
    db = new sqlite.DatabaseSync(':memory:');
  } finally {
    process.emitWarning = originalEmitWarning;
  }
  const storage: FakeCoordinatorStorage = {
    alarmAt: null,
    sql: {
      exec(query: string, ...bindings: SqlValue[]) {
        const rows = db.prepare(query).all(...bindings.map(toBinding));
        return { toArray: () => rows as unknown as SqlRow[] };
      },
    },
    async setAlarm(scheduledTime: number) {
      storage.alarmAt = scheduledTime;
    },
    async getAlarm() {
      return storage.alarmAt;
    },
    async deleteAlarm() {
      storage.alarmAt = null;
    },
    close() {
      db.close();
    },
  };
  return { storage };
}
