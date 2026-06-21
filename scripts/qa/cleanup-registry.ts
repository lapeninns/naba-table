import fs from 'node:fs';
import path from 'node:path';

import { redactQaArtifact } from './redaction';
import { ensureQaRunId, type QaRunIdEnv } from './run-id';

export type QaCleanupRecordStatus = 'cleaned' | 'failed' | 'pending';

export type QaCleanupRecordInput = {
  id: string;
  metadata?: Record<string, unknown>;
  restaurantId?: string;
  type: string;
};

export type QaCleanupRecord = QaCleanupRecordInput & {
  createdAt: string;
  qaRunId: string;
  status: QaCleanupRecordStatus;
};

export type QaCleanupRegistrySnapshot = {
  records: QaCleanupRecord[];
  runId: string;
};

export type QaCleanupRegistryOptions = {
  env?: QaRunIdEnv;
  now?: () => Date;
  path?: string;
  runId?: string;
};

export class QaCleanupPendingError extends Error {
  readonly pendingRecords: readonly QaCleanupRecord[];

  constructor(pendingRecords: readonly QaCleanupRecord[]) {
    super(`QA cleanup registry has ${pendingRecords.length} pending record(s).`);
    this.name = 'QaCleanupPendingError';
    this.pendingRecords = pendingRecords;
  }
}

function cleanupKey(record: Pick<QaCleanupRecordInput, 'id' | 'type'>): string {
  return `${record.type}:${record.id}`;
}

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required for QA cleanup registry records.`);
  }
  return normalized;
}

function isCleanupRecord(value: unknown): value is QaCleanupRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.type === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.qaRunId === 'string' &&
    (record.status === 'pending' || record.status === 'cleaned' || record.status === 'failed')
  );
}

function readSnapshot(filePath: string): QaCleanupRegistrySnapshot | null {
  if (!fs.existsSync(filePath)) return null;
  const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error(`Invalid QA cleanup registry snapshot at ${filePath}.`);
  }

  const rawSnapshot = snapshot as { records?: unknown; runId?: unknown };
  if (typeof rawSnapshot.runId !== 'string' || !Array.isArray(rawSnapshot.records)) {
    throw new Error(`Invalid QA cleanup registry snapshot at ${filePath}.`);
  }
  if (!rawSnapshot.records.every(isCleanupRecord)) {
    throw new Error(`Invalid QA cleanup registry record in ${filePath}.`);
  }

  return {
    records: rawSnapshot.records,
    runId: rawSnapshot.runId,
  };
}

function serializeRecord(record: QaCleanupRecord): QaCleanupRecord {
  const metadata = record.metadata
    ? (redactQaArtifact(record.metadata) as Record<string, unknown>)
    : undefined;
  return {
    ...record,
    ...(metadata ? { metadata } : {}),
  };
}

export class QaCleanupRegistry {
  private readonly now: () => Date;
  private readonly registryPath: string | null;
  private readonly records = new Map<string, QaCleanupRecord>();
  readonly runId: string;

  constructor(options: QaCleanupRegistryOptions = {}) {
    this.registryPath = options.path ?? null;
    const snapshot = this.registryPath ? readSnapshot(this.registryPath) : null;
    this.runId = options.runId ?? snapshot?.runId ?? ensureQaRunId(options.env ?? process.env);
    this.now = options.now ?? (() => new Date());

    if (snapshot && snapshot.runId !== this.runId) {
      throw new Error(
        `QA cleanup registry runId mismatch: ${snapshot.runId} cannot be loaded as ${this.runId}.`,
      );
    }
    for (const record of snapshot?.records ?? []) {
      this.records.set(cleanupKey(record), record);
    }
    this.persist();
  }

  private persist(): void {
    if (!this.registryPath) return;
    fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
    fs.writeFileSync(this.registryPath, `${JSON.stringify(this.toJSON(), null, 2)}\n`, 'utf8');
  }

  register(input: QaCleanupRecordInput): QaCleanupRecord {
    const type = requireNonEmpty(input.type, 'type');
    const id = requireNonEmpty(input.id, 'id');
    const key = cleanupKey({ id, type });
    const existing = this.records.get(key);
    if (existing) return existing;

    const record: QaCleanupRecord = {
      ...input,
      id,
      type,
      createdAt: this.now().toISOString(),
      qaRunId: this.runId,
      status: 'pending',
    };
    this.records.set(key, record);
    this.persist();
    return record;
  }

  markCleaned(input: Pick<QaCleanupRecordInput, 'id' | 'type'>): QaCleanupRecord {
    const key = cleanupKey(input);
    const existing = this.records.get(key);
    if (!existing) {
      throw new Error(`Cannot mark unknown QA cleanup record "${key}" as cleaned.`);
    }

    const updated = { ...existing, status: 'cleaned' as const };
    this.records.set(key, updated);
    this.persist();
    return updated;
  }

  markFailed(input: Pick<QaCleanupRecordInput, 'id' | 'type'>): QaCleanupRecord {
    const key = cleanupKey(input);
    const existing = this.records.get(key);
    if (!existing) {
      throw new Error(`Cannot mark unknown QA cleanup record "${key}" as failed.`);
    }

    const updated = { ...existing, status: 'failed' as const };
    this.records.set(key, updated);
    this.persist();
    return updated;
  }

  all(): QaCleanupRecord[] {
    return Array.from(this.records.values());
  }

  pending(): QaCleanupRecord[] {
    return this.all().filter((record) => record.status === 'pending');
  }

  assertNoPendingRecords(): void {
    const pending = this.pending();
    if (pending.length > 0) {
      throw new QaCleanupPendingError(pending);
    }
  }

  save(): void {
    this.persist();
  }

  toJSON(): QaCleanupRegistrySnapshot {
    return {
      records: this.all().map(serializeRecord),
      runId: this.runId,
    };
  }
}
