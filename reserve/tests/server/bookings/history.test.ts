import { describe, expect, it } from 'vitest';

import { __test__ } from '@/server/bookingHistory';

import type { BookingHistoryChange } from '@/types/bookingHistory';
import type { Database } from '@/types/supabase';

describe('booking history helpers', () => {
  it('computes diffs for tracked fields only', () => {
    const changes = __test__.computeDiff(
      {
        booking_date: '2025-05-01',
        start_time: '18:00',
        notes: 'Original note',
        status: 'confirmed',
      },
      {
        booking_date: '2025-05-02',
        start_time: '19:30',
        notes: 'Updated note',
        status: 'confirmed',
      },
    );

    const fields = changes.map((change: BookingHistoryChange) => change.field);
    expect(fields).toContain('booking_date');
    expect(fields).toContain('start_time');
    expect(fields).toContain('notes');
    expect(fields).not.toContain('status'); // unchanged
  });

  it('prefers changes from audit metadata when present', () => {
    const audit = {
      actor: 'guest@example.com',
      metadata: {
        changes: [
          { field: 'party_size', before: 2, after: 4 },
          { field: 'status', before: 'confirmed', after: 'cancelled' },
        ],
      },
    } as unknown as Database['public']['Tables']['audit_logs']['Row'];

    const version = {
      version_id: 1,
      change_type: 'updated',
      changed_at: '2025-01-01T12:00:00Z',
      changed_by: null,
      old_data: { party_size: 2, status: 'confirmed' } as unknown,
      new_data: { party_size: 4, status: 'cancelled' } as unknown,
    } as unknown as Database['public']['Tables']['booking_versions']['Row'];

    const event = __test__.buildHistoryEvent(version, audit);
    expect(event.actor).toBe('guest@example.com');
    expect(event.changes.map((c) => c.field)).toEqual(['party_size', 'status']);
  });

  it('falls back to computed diff and changed_by when audit is absent', () => {
    const version = {
      version_id: 2,
      change_type: 'updated',
      changed_at: '2025-01-02T12:00:00Z',
      changed_by: 'user-123',
      old_data: { notes: 'Before' } as unknown,
      new_data: { notes: 'After' } as unknown,
    } as unknown as Database['public']['Tables']['booking_versions']['Row'];

    const event = __test__.buildHistoryEvent(version, null);
    expect(event.actor).toBe('user-123');
    expect(event.changes).toEqual([
      {
        field: 'notes',
        label: 'Guest notes',
        before: 'Before',
        after: 'After',
      },
    ]);
  });
});
