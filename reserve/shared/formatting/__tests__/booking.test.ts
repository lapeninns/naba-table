import { describe, expect, it } from 'vitest';

import {
  formatBookingLabel,
  formatDateForInput,
  formatReservationDate,
  formatReservationDateShort,
  formatReservationSummaryDate,
  formatReservationTime,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';

describe('booking formatting helpers', () => {
  it('formats booking labels with friendly casing', () => {
    expect(formatBookingLabel('drinks')).toBe('Drinks & cocktails');
    expect(formatBookingLabel('lunch')).toBe('Lunch');
  });

  it('formats reservation dates and times with timezone aware formatters', () => {
    expect(formatReservationDate('2025-03-01')).toBe('Saturday, 1 March 2025');
    expect(formatReservationSummaryDate('2025-03-01')).toBe('Mar 01 2025');
    expect(formatReservationTime('18:30')).toBe('19:30');
  });

  it('supports timezone overrides and additional formats', () => {
    expect(formatReservationTime('18:30', { timezone: 'UTC' })).toBe('18:30');
    const sampleDate = new Date('2025-03-01T18:30:00Z');
    expect(formatReservationTimeFromDate(sampleDate, { timezone: 'UTC' })).toBe('18:30');
    expect(formatReservationDateShort('2025-03-01', { timezone: 'UTC' })).toBe('Sat, 01 Mar 2025');
  });

  it('formats dates for input controls', () => {
    const sample = new Date(Date.UTC(2025, 2, 1, 12, 0, 0));
    expect(formatDateForInput(sample)).toBe('2025-03-01');
  });
});
