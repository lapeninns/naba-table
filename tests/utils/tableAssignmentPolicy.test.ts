import { describe, expect, it } from 'vitest';

import { isTableAssignmentAllowed, OPS_TABLE_ASSIGNMENT_ALLOWED_STATUSES } from '@/lib/ops/table-assignment-policy';
import { getTodayInTimezone } from '@/lib/utils/datetime';

function addDays(dateValue: string, delta: number): string {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

describe('table assignment policy', () => {
  const timezone = 'UTC';
  const today = getTodayInTimezone(timezone);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  it('allows allowed statuses for today and future bookings', () => {
    for (const status of OPS_TABLE_ASSIGNMENT_ALLOWED_STATUSES) {
      expect(
        isTableAssignmentAllowed({ status, bookingDate: today, timezone }),
      ).toBe(true);
      expect(
        isTableAssignmentAllowed({ status, bookingDate: tomorrow, timezone }),
      ).toBe(true);
    }
  });

  it('blocks completed/cancelled/no_show regardless of date', () => {
    const blockedStatuses = ['completed', 'cancelled', 'no_show'] as const;
    for (const status of blockedStatuses) {
      expect(
        isTableAssignmentAllowed({ status, bookingDate: today, timezone }),
      ).toBe(false);
    }
  });

  it('blocks past bookings even with allowed status', () => {
    expect(
      isTableAssignmentAllowed({ status: 'confirmed', bookingDate: yesterday, timezone }),
    ).toBe(false);
  });

  it('blocks when booking date is missing', () => {
    expect(
      isTableAssignmentAllowed({ status: 'confirmed', bookingDate: null, timezone }),
    ).toBe(false);
  });
});
