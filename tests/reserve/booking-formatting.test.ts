import { describe, expect, it } from 'vitest';

import {
  formatReservationDate,
  formatReservationDateShort,
  formatReservationSummaryDate,
} from '@reserve/shared/formatting/booking';

describe('reservation date-only formatting', () => {
  it('does not shift date-only reservations to the previous day in western timezones', () => {
    const options = { timezone: 'America/New_York' };

    expect(formatReservationDate('2026-05-05', options)).toBe('Tuesday, 5 May 2026');
    expect(formatReservationDateShort('2026-05-05', options)).toBe('Tue, 05 May 2026');
    expect(formatReservationSummaryDate('2026-05-05', options)).toBe('May 05 2026');
  });

  it('rejects invalid calendar dates instead of rolling them forward', () => {
    expect(formatReservationDate('2026-02-31')).toBe('');
    expect(formatReservationDateShort('2026-02-31')).toBe('');
    expect(formatReservationSummaryDate('2026-02-31')).toBe('');
  });
});
