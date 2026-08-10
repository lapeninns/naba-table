import { describe, expect, it, vi } from 'vitest';

import { reconcileCoreOutbox, type CoreOutboxEntry } from '@/server/dual-sync/core-outbox';

const HASH = 'c'.repeat(64);
const entry: CoreOutboxEntry = {
  id: '00000000-0000-4000-8000-000000000001',
  restaurantId: '00000000-0000-4000-8000-000000000010',
  sourceTable: 'restaurant_categories',
  sourceRowId: '00000000-0000-4000-8000-000000000100',
  operation: 'UPDATE',
  changedColumns: ['display_name'],
  beforeHash: HASH,
  afterHash: 'd'.repeat(64),
  idempotencyHash: 'e'.repeat(64),
  attemptCount: 1,
  leaseToken: '00000000-0000-4000-8000-000000000900',
};

describe('Core outbox reconciliation', () => {
  it('is read-only by default and reports metadata-only missing work', async () => {
    // Given
    const repairMissing = vi.fn();

    // When
    const result = await reconcileCoreOutbox({
      ports: {
        census: async () => [
          { entry, hasOutstandingOutbox: false, hasMatchingCandidateOrState: false },
        ],
        repairMissing,
      },
      limit: 500,
    });

    // Then
    expect(result).toEqual({
      inspected: 1,
      missing: 1,
      repaired: 0,
      missingIds: [entry.id],
      repairedIds: [],
    });
    expect(repairMissing).not.toHaveBeenCalled();
  });

  it('repairs only work absent from both outbox and candidate/state presence', async () => {
    // Given
    const repairMissing = vi.fn(async (entries: readonly CoreOutboxEntry[]) =>
      entries.map((item) => item.id),
    );

    // When
    const result = await reconcileCoreOutbox({
      ports: {
        census: async () => [
          { entry, hasOutstandingOutbox: false, hasMatchingCandidateOrState: false },
          {
            entry: { ...entry, id: '00000000-0000-4000-8000-000000000002' },
            hasOutstandingOutbox: true,
            hasMatchingCandidateOrState: false,
          },
        ],
        repairMissing,
      },
      repair: true,
    });

    // Then
    expect(result.repairedIds).toEqual([entry.id]);
    expect(repairMissing).toHaveBeenCalledWith([entry]);
  });
});
