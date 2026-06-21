import { describe, expect, it } from 'vitest';

import { __test__ } from '@/server/bookingHistory';

describe('booking history mapping', () => {
  it('preserves non-numeric booking version IDs', () => {
    const event = __test__.buildHistoryEvent(
      {
        version_id: '018f4e41-6e18-71db-89f0-7a9d1b5f5b11',
        change_type: 'updated',
        changed_at: '2026-05-31T09:00:00.000Z',
        changed_by: 'system',
        old_data: {},
        new_data: {},
      } as never,
      null,
    );

    expect(event.versionId).toBe('018f4e41-6e18-71db-89f0-7a9d1b5f5b11');
  });
});
