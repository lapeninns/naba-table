import type { Row, StorageBackend, TableName } from './backend';

/** In-memory backend for tests and `--dry-run`. Never persists anything. */
export function createMemoryBackend(): StorageBackend {
  const tables = new Map<TableName, Map<string, Row>>();
  const table = (name: TableName): Map<string, Row> => {
    let existing = tables.get(name);
    if (!existing) {
      existing = new Map();
      tables.set(name, existing);
    }
    return existing;
  };
  const clone = (row: Row): Row => JSON.parse(JSON.stringify(row)) as Row;
  return {
    get: (name, id) => {
      const row = table(name).get(id);
      return row ? clone(row) : undefined;
    },
    put: (name, id, row) => {
      table(name).set(id, clone(row));
    },
    delete: (name, id) => {
      table(name).delete(id);
    },
    list: (name) => [...table(name).values()].map(clone),
    transaction: (fn) => fn(),
    close: () => {
      tables.clear();
    },
  };
}
