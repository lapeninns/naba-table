import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  QaCleanupPendingError,
  QaCleanupRegistry,
  type QaCleanupRegistryOptions,
  type QaCleanupRegistrySnapshot,
} from '@/scripts/qa/cleanup-registry';

/**
 * Behavioral pins for scripts/qa/cleanup-registry.ts (MS-foundation-qa-harness-self-tests):
 * pending-record detection, clearing semantics, persistence, and artifact redaction.
 */

const FIXTURE_RUN_ID = 'qa-cleanup-registry-suite';

let fixtureDir: string;

function registryPath(): string {
  return path.join(fixtureDir, 'cleanup-registry.json');
}

function fixedClock(): () => Date {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 6, 11, 10, 0, tick++));
}

function newRegistry(overrides: QaCleanupRegistryOptions = {}): QaCleanupRegistry {
  return new QaCleanupRegistry({
    now: fixedClock(),
    path: registryPath(),
    runId: FIXTURE_RUN_ID,
    ...overrides,
  });
}

function readSnapshotFile(): QaCleanupRegistrySnapshot {
  return JSON.parse(fs.readFileSync(registryPath(), 'utf8')) as QaCleanupRegistrySnapshot;
}

beforeEach(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-cleanup-registry-'));
});

afterEach(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

describe('QaCleanupRegistry pending detection', () => {
  it('registers records as pending and blocks the no-pending gate @contract @local-only', () => {
    const registry = newRegistry();
    const record = registry.register({
      id: 'rest-123',
      restaurantId: 'rest-123',
      type: 'restaurant',
    });

    expect(record).toMatchObject({
      createdAt: '2026-07-11T10:00:00.000Z',
      qaRunId: FIXTURE_RUN_ID,
      status: 'pending',
    });
    expect(registry.pending().map((entry) => entry.id)).toEqual(['rest-123']);

    let caught: unknown;
    try {
      registry.assertNoPendingRecords();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(QaCleanupPendingError);
    expect((caught as QaCleanupPendingError).pendingRecords).toHaveLength(1);
    expect((caught as QaCleanupPendingError).message).toContain('1 pending record(s)');
  });

  it('markCleaned clears pending state and satisfies the gate @contract @local-only', () => {
    const registry = newRegistry();
    registry.register({ id: 'b-1', type: 'booking' });
    registry.register({ id: 'b-2', type: 'booking' });

    registry.markCleaned({ id: 'b-1', type: 'booking' });
    expect(registry.pending().map((entry) => entry.id)).toEqual(['b-2']);

    registry.markCleaned({ id: 'b-2', type: 'booking' });
    expect(registry.pending()).toEqual([]);
    expect(() => registry.assertNoPendingRecords()).not.toThrow();
    expect(readSnapshotFile().records.map((entry) => entry.status)).toEqual(['cleaned', 'cleaned']);
  });

  it('KNOWN-ISSUE: markFailed records slip past the no-pending gate @contract @local-only', () => {
    // KNOWN-ISSUE(scripts/qa/cleanup-registry.ts): pending() only matches status
    // "pending", so a record marked failed — cleanup was attempted and did NOT happen —
    // no longer trips assertNoPendingRecords(). A failed cleanup can therefore leak QA
    // fixtures without failing the run. Pinned as current behavior; changing it belongs
    // in a product-fix spec for the registry (harness scripts are out of scope here).
    const registry = newRegistry();
    registry.register({ id: 'rest-9', type: 'restaurant' });

    const failed = registry.markFailed({ id: 'rest-9', type: 'restaurant' });

    expect(failed.status).toBe('failed');
    expect(registry.pending()).toEqual([]);
    expect(() => registry.assertNoPendingRecords()).not.toThrow();
  });

  it('register is idempotent per type and id pair @contract @local-only', () => {
    const registry = newRegistry();
    const first = registry.register({ id: 'g-1', metadata: { seat: 'window' }, type: 'guest' });
    const second = registry.register({ id: 'g-1', metadata: { seat: 'bar' }, type: 'guest' });

    expect(second).toBe(first);
    expect(second.createdAt).toBe('2026-07-11T10:00:00.000Z');
    expect(registry.all()).toHaveLength(1);
    expect(registry.all()[0].metadata).toEqual({ seat: 'window' });
  });

  it('refuses to mark unknown records @contract @local-only', () => {
    const registry = newRegistry();

    expect(() => registry.markCleaned({ id: 'nope', type: 'booking' })).toThrow(
      'Cannot mark unknown QA cleanup record "booking:nope" as cleaned.',
    );
    expect(() => registry.markFailed({ id: 'nope', type: 'booking' })).toThrow('as failed');
  });

  it('requires non-empty type and id @contract @local-only', () => {
    const registry = newRegistry();

    expect(() => registry.register({ id: ' ', type: 'booking' })).toThrow('id is required');
    expect(() => registry.register({ id: 'b-1', type: '' })).toThrow('type is required');
  });
});

describe('QaCleanupRegistry persistence', () => {
  it('persists eagerly and reloads pending state from disk @contract @local-only', () => {
    const registry = newRegistry();
    expect(fs.existsSync(registryPath())).toBe(true);

    registry.register({ id: 'rest-1', type: 'restaurant' });

    const reloaded = new QaCleanupRegistry({ path: registryPath() });
    expect(reloaded.runId).toBe(FIXTURE_RUN_ID);
    expect(reloaded.pending().map((entry) => entry.id)).toEqual(['rest-1']);
    expect(() => reloaded.assertNoPendingRecords()).toThrow(QaCleanupPendingError);

    reloaded.markCleaned({ id: 'rest-1', type: 'restaurant' });
    const third = new QaCleanupRegistry({ path: registryPath() });
    expect(third.pending()).toEqual([]);
  });

  it('rejects loading a snapshot under a different runId @contract @local-only', () => {
    newRegistry();

    expect(() => new QaCleanupRegistry({ path: registryPath(), runId: 'qa-other-run' })).toThrow(
      'runId mismatch',
    );
  });

  it('derives the runId from the provided env when not passed explicitly @contract @local-only', () => {
    const env = { QA_RUN_ID: 'qa-cleanup-env-run' };
    const registry = new QaCleanupRegistry({
      env,
      path: path.join(fixtureDir, 'env-registry.json'),
    });

    expect(registry.runId).toBe('qa-cleanup-env-run');
  });

  it('redacts sensitive metadata in the persisted snapshot @contract @security @local-only', () => {
    const registry = newRegistry();
    const record = registry.register({
      id: 'g-7',
      metadata: {
        contactEmail: 'guest@example.com',
        note: 'ring +44 7911 123456 before service',
        table: 'T4',
      },
      type: 'guest',
    });

    // The in-memory record keeps raw values for the cleanup work itself…
    expect(record.metadata?.contactEmail).toBe('guest@example.com');

    // …but the serialized artifact is redacted.
    const persisted = readSnapshotFile().records[0];
    expect(persisted.metadata).toMatchObject({ contactEmail: '[redacted]', table: 'T4' });
    expect(persisted.metadata?.note).toBe('ring [redacted-phone] before service');
  });

  it('rejects malformed snapshot files @contract @local-only', () => {
    fs.writeFileSync(registryPath(), JSON.stringify(['not', 'an', 'object']), 'utf8');
    expect(() => newRegistry()).toThrow('Invalid QA cleanup registry snapshot');

    fs.writeFileSync(
      registryPath(),
      JSON.stringify({
        records: [{ createdAt: 'x', id: 'a', qaRunId: 'qa-x', status: 'weird', type: 'b' }],
        runId: FIXTURE_RUN_ID,
      }),
      'utf8',
    );
    expect(() => newRegistry()).toThrow('Invalid QA cleanup registry record');
  });

  it('operates in-memory when no path is configured @contract @local-only', () => {
    const registry = new QaCleanupRegistry({ now: fixedClock(), runId: FIXTURE_RUN_ID });
    registry.register({ id: 'b-1', type: 'booking' });
    registry.markCleaned({ id: 'b-1', type: 'booking' });
    registry.save();

    expect(registry.toJSON()).toEqual({
      records: [expect.objectContaining({ id: 'b-1', status: 'cleaned' })],
      runId: FIXTURE_RUN_ID,
    });
    expect(fs.readdirSync(fixtureDir)).toEqual([]);
  });
});
