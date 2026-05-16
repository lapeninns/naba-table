import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { QaCleanupPendingError, QaCleanupRegistry } from '@/scripts/qa';

function tempRegistryPath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-cleanup-registry-')), 'registry.json');
}

describe('QA cleanup registry', () => {
  it('registers created records under the current QA_RUN_ID', () => {
    const registry = new QaCleanupRegistry({
      env: { QA_RUN_ID: 'qa-cleanup-123' },
      now: () => new Date('2026-05-16T12:00:00.000Z'),
    });

    const record = registry.register({
      id: 'booking-1',
      restaurantId: 'restaurant-1',
      type: 'booking',
    });

    expect(record).toEqual({
      id: 'booking-1',
      restaurantId: 'restaurant-1',
      type: 'booking',
      createdAt: '2026-05-16T12:00:00.000Z',
      qaRunId: 'qa-cleanup-123',
      status: 'pending',
    });
    expect(registry.pending()).toHaveLength(1);
  });

  it('is idempotent for duplicate type/id registrations', () => {
    const registry = new QaCleanupRegistry({ runId: 'qa-cleanup-dup' });
    const first = registry.register({ id: 'booking-1', type: 'booking' });
    const second = registry.register({ id: 'booking-1', type: 'booking' });

    expect(second).toBe(first);
    expect(registry.all()).toHaveLength(1);
  });

  it('reports pending cleanup records until they are marked cleaned', () => {
    const registry = new QaCleanupRegistry({ runId: 'qa-cleanup-pending' });
    registry.register({ id: 'booking-1', type: 'booking' });

    expect(() => registry.assertNoPendingRecords()).toThrowError(QaCleanupPendingError);

    registry.markCleaned({ id: 'booking-1', type: 'booking' });

    expect(registry.pending()).toEqual([]);
    expect(() => registry.assertNoPendingRecords()).not.toThrow();
  });

  it('persists created records and redacts sensitive metadata in the registry artifact', () => {
    const registryPath = tempRegistryPath();
    const registry = new QaCleanupRegistry({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      path: registryPath,
      runId: 'qa-cleanup-file',
    });

    registry.register({
      id: 'booking-1',
      metadata: {
        email: 'guest@example.test',
        manageUrl: '/bookings/recover?access_token=manage-secret',
        phone: '+447700900123',
      },
      restaurantId: 'restaurant-1',
      type: 'booking',
    });

    const artifact = fs.readFileSync(registryPath, 'utf8');
    expect(artifact).toContain('booking-1');
    expect(artifact).toContain('qa-cleanup-file');
    expect(artifact).not.toContain('guest@example.test');
    expect(artifact).not.toContain('manage-secret');
    expect(artifact).not.toContain('+447700900123');
  });

  it('loads an existing registry file and persists cleanup status updates', () => {
    const registryPath = tempRegistryPath();
    const first = new QaCleanupRegistry({ path: registryPath, runId: 'qa-cleanup-load' });
    first.register({ id: 'booking-1', type: 'booking' });

    const second = new QaCleanupRegistry({ path: registryPath, runId: 'qa-cleanup-load' });
    expect(second.pending()).toHaveLength(1);

    second.markCleaned({ id: 'booking-1', type: 'booking' });

    const artifact = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
      records: Array<{ status: string }>;
    };
    expect(artifact.records[0]?.status).toBe('cleaned');
  });
});
