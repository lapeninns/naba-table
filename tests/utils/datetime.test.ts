import { describe, expect, it } from 'vitest';

import {
  dateKeyToCalendarDate,
  formatDateReadable,
  formatDateReadableShort,
  formatTimeRange,
  shiftDateKey,
} from '@/lib/utils/datetime';

describe('datetime utilities', () => {
  it('creates a stable calendar date from a date key', () => {
    const parsed = dateKeyToCalendarDate('2026-03-29');

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(29);
    expect(parsed?.getHours()).toBe(12);
  });

  it('shifts date keys without relying on device timezone math', () => {
    expect(shiftDateKey('2026-03-31', 1)).toBe('2026-04-01');
    expect(shiftDateKey('2026-04-01', -1)).toBe('2026-03-31');
  });

  it('formats date-only values in the target timezone without drifting the calendar date', () => {
    expect(formatDateReadable('2026-03-29', 'America/Los_Angeles')).toBe('Sunday 29 March 2026');
    expect(formatDateReadableShort('2026-03-29', 'Pacific/Auckland')).toBe('Sun 29 Mar 2026');
  });

  it('formats restaurant-local time ranges without shifting them through the device timezone', () => {
    expect(formatTimeRange('19:30', '21:00', 'America/Los_Angeles')).toBe('19:30 – 21:00');
    expect(formatTimeRange('08:15', null, 'Pacific/Auckland')).toBe('08:15');
  });
});
