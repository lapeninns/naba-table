import { describe, expect, it } from 'vitest';

import {
  getBookingDateTimeMillis,
  parseBookingDateTime,
  toBookingUtcIso,
} from '@reserve/shared/formatting/bookingDateTime';

describe('bookingDateTime helpers', () => {
  it('converts UTC instants into the restaurant timezone for display', () => {
    const parsed = parseBookingDateTime('2026-07-01T18:30:00.000Z', 'Europe/London');

    expect(parsed?.toFormat('HH:mm')).toBe('19:30');
    expect(parsed?.toFormat('yyyy-MM-dd')).toBe('2026-07-01');
  });

  it('treats naive booking timestamps as venue-local times', () => {
    const parsed = parseBookingDateTime('2026-07-01T19:30', 'Europe/London');

    expect(parsed?.toFormat('HH:mm')).toBe('19:30');
    expect(getBookingDateTimeMillis('2026-07-01T19:30', 'Europe/London')).toBe(
      Date.parse('2026-07-01T18:30:00.000Z'),
    );
  });

  it('normalizes venue-local date and time into UTC ISO', () => {
    expect(toBookingUtcIso('2026-07-01', '19:30', 'Europe/London')).toBe(
      '2026-07-01T18:30:00.000Z',
    );
  });
});
