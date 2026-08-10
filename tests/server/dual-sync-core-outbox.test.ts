import { describe, expect, it } from 'vitest';

import {
  processCoreOutbox,
  type CoreOutboxEntry,
  type CoreOutboxPorts,
} from '@/server/dual-sync/core-outbox';
import { fieldKeysForCoreOutboxEntry } from '@/server/dual-sync/core-outbox/mapping';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function entry(overrides: Partial<CoreOutboxEntry> = {}): CoreOutboxEntry {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    restaurantId: '00000000-0000-4000-8000-000000000010',
    sourceTable: 'restaurant_hours',
    sourceRowId: '00000000-0000-4000-8000-000000000100',
    operation: 'UPDATE',
    changedColumns: ['opens_at'],
    beforeHash: HASH_A,
    afterHash: HASH_B,
    idempotencyHash: HASH_B,
    attemptCount: 1,
    leaseToken: '00000000-0000-4000-8000-000000000900',
    ...overrides,
  };
}

function ports(rows: readonly unknown[]): CoreOutboxPorts & {
  readonly completed: string[];
  readonly retried: string[];
  readonly discovered: Array<{
    readonly restaurantId: string;
    readonly fieldKeys: readonly string[];
  }>;
} {
  const completed: string[] = [];
  const retried: string[] = [];
  const discovered: Array<{ restaurantId: string; fieldKeys: readonly string[] }> = [];
  return {
    completed,
    retried,
    discovered,
    claim: async () => rows,
    complete: async (entries) => {
      completed.push(...entries.map((item) => item.id));
    },
    retry: async (entries) => {
      const ids = entries.map((item) => item.id);
      retried.push(...ids);
      return { deadLetterIds: [] };
    },
    isProviderOrigin: async () => false,
    discoverCandidates: async (input) => {
      discovered.push(input);
      return input.fieldKeys;
    },
    notifyDeadLetters: async () => undefined,
  };
}

describe('Core-change outbox consumer', () => {
  it('coalesces duplicate rows per tenant while completing every claimed id', async () => {
    // Given
    const first = entry();
    const second = entry({
      id: '00000000-0000-4000-8000-000000000002',
      sourceRowId: '00000000-0000-4000-8000-000000000101',
      changedColumns: ['closes_at'],
    });
    const fake = ports([first, second]);

    // When
    const result = await processCoreOutbox({ ports: fake, workerId: 'worker-a', maxJobs: 10 });

    // Then
    expect(result).toEqual({ claimed: 2, completed: 2, retried: 0, deadLettered: 0 });
    expect(fake.discovered).toEqual([
      {
        restaurantId: first.restaurantId,
        fieldKeys: [
          'operatingHours.weekly.0',
          'operatingHours.weekly.1',
          'operatingHours.weekly.2',
          'operatingHours.weekly.3',
          'operatingHours.weekly.4',
          'operatingHours.weekly.5',
          'operatingHours.weekly.6',
          'servicePeriods.*',
        ],
      },
    ]);
    expect(fake.completed).toEqual([first.id, second.id]);
  });

  it('isolates tenant failures and leaves successful tenants complete', async () => {
    // Given
    const first = entry();
    const second = entry({
      id: '00000000-0000-4000-8000-000000000002',
      restaurantId: '00000000-0000-4000-8000-000000000020',
    });
    const fake = ports([first, second]);
    fake.discoverCandidates = async (input) => {
      if (input.restaurantId === second.restaurantId) throw new TypeError('fixture failure');
      fake.discovered.push(input);
      return input.fieldKeys;
    };

    // When
    const result = await processCoreOutbox({ ports: fake, workerId: 'worker-a', maxJobs: 10 });

    // Then
    expect(result).toEqual({ claimed: 2, completed: 1, retried: 1, deadLettered: 0 });
    expect(fake.completed).toEqual([first.id]);
    expect(fake.retried).toEqual([second.id]);
  });

  it('safely completes provider-origin rows without candidate discovery', async () => {
    // Given
    const row = entry();
    const fake = ports([row]);
    fake.isProviderOrigin = async () => true;

    // When
    const result = await processCoreOutbox({ ports: fake, workerId: 'worker-a', maxJobs: 10 });

    // Then
    expect(result.completed).toBe(1);
    expect(fake.discovered).toEqual([]);
    expect(fake.completed).toEqual([row.id]);
  });

  it('leaves a discovered Core commit reclaimable when completion crashes', async () => {
    // Given
    const row = entry();
    const fake = ports([row]);
    fake.complete = async () => {
      throw new TypeError('simulated completion crash');
    };

    // When
    const run = processCoreOutbox({ ports: fake, workerId: 'worker-a', maxJobs: 10 });

    // Then
    await expect(run).rejects.toThrow('simulated completion crash');
    expect(fake.discovered).toHaveLength(1);
    expect(fake.retried).toEqual([]);
  });

  it('dead-letters strict-schema poison without logging content', async () => {
    // Given
    const row = { ...entry(), leakedValue: 'guest content' };
    const notices: readonly string[][] = [];
    const fake = ports([row]);
    fake.retry = async (entries) => ({ deadLetterIds: entries.map((item) => item.id) });
    fake.notifyDeadLetters = async (ids) => {
      (notices as string[][]).push([...ids]);
    };

    // When
    const result = await processCoreOutbox({ ports: fake, workerId: 'worker-a', maxJobs: 10 });

    // Then
    expect(result).toEqual({ claimed: 1, completed: 0, retried: 0, deadLettered: 1 });
    expect(notices).toEqual([[row.id]]);
    expect(JSON.stringify(result)).not.toContain('guest content');
  });

  it('maps deletes and all nine trigger tables to deterministic registry keys', () => {
    // Given
    const tables = [
      'restaurant_business_details',
      'restaurant_addresses',
      'restaurant_phone_numbers',
      'restaurant_links',
      'restaurant_categories',
      'restaurant_service_areas',
      'restaurant_hours',
      'restaurant_attributes',
      'restaurant_service_items',
    ] as const;

    // When
    const mapped = tables.map((sourceTable, index) =>
      fieldKeysForCoreOutboxEntry(
        entry({
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          sourceTable,
          operation: 'DELETE',
          beforeHash: HASH_A,
          afterHash: null,
        }),
      ),
    );

    // Then
    expect(mapped.every((keys) => keys.length > 0)).toBe(true);
    expect(mapped[1]).toEqual(['profile.address']);
    expect(mapped[2]).toEqual(['profile.contactPhone']);
    expect(mapped[8]).toEqual(['businessContext.serviceItems.*']);
  });

  it('maps specialized Core source triggers without unrelated restaurant fields', () => {
    // Given
    const profile = entry({
      sourceTable: 'restaurants',
      changedColumns: ['timezone', 'name', 'contact_phone'],
    });

    // When
    const profileKeys = fieldKeysForCoreOutboxEntry(profile);
    const periodKeys = fieldKeysForCoreOutboxEntry(
      entry({ sourceTable: 'restaurant_service_periods', changedColumns: ['service_periods'] }),
    );
    const hoursKeys = fieldKeysForCoreOutboxEntry(
      entry({
        sourceTable: 'restaurant_operating_hours',
        changedColumns: ['weekly_6', 'weekly_1'],
      }),
    );

    // Then
    expect(profileKeys).toEqual(['profile.contactPhone', 'profile.name']);
    expect(periodKeys).toEqual(['servicePeriods.*']);
    expect(hoursKeys).toEqual(['operatingHours.weekly.1', 'operatingHours.weekly.6']);
  });
});
