/**
 * Storage backend contract. The queue store implements all queue semantics on
 * top of this tiny table abstraction so the in-memory (tests) and SQLite
 * (production) backends behave identically.
 */
export const TABLE_NAMES = [
  'requests',
  'request_dedup',
  'attempts',
  'leases',
  'publications',
  'heartbeats',
  'counters',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

export type Row = Record<string, unknown>;

export interface StorageBackend {
  get(table: TableName, id: string): Row | undefined;
  put(table: TableName, id: string, row: Row): void;
  delete(table: TableName, id: string): void;
  list(table: TableName): readonly Row[];
  /** Runs `fn` atomically. Backends without transactions may run it directly. */
  transaction<T>(fn: () => T): T;
  close(): void;
}
