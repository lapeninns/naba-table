import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertBookingNotInPast,
  getCurrentTimeInTimezone,
  __test__,
} from '@/server/bookings/pastTimeValidation';

describe('past time validation timezone handling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes Intl hour-cycle 24 output without advancing the calendar day', () => {
    expect(__test__.normalizeIsoLocal24HourRollover('2026-05-05T24:30:15.7')).toBe(
      '2026-05-05T00:30:15.700',
    );
  });

  it('does not reject a same-day future booking during the first local hour after midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T23:30:00.000Z'));

    expect(() =>
      assertBookingNotInPast('Europe/London', '2026-05-05', '00:45', { graceMinutes: 0 }),
    ).not.toThrow();
  });

  it('resolves current time in the requested timezone without rolling midnight forward a day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T23:30:00.000Z'));

    const current = getCurrentTimeInTimezone('Europe/London');

    expect(current.toISOString()).toBe('2026-05-04T23:30:00.000Z');
  });
});
