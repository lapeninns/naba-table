import { describe, expect, it } from 'vitest';

import { bookingHelpers, storageKeys } from '../booking';

describe('bookingHelpers', () => {
  it('normalizes time strings', () => {
    expect(bookingHelpers.normalizeTime('18:30')).toBe('18:30');
    expect(bookingHelpers.normalizeTime(' 07:15:20 ')).toBe('07:15');
  });

  it('formats dates for summaries', () => {
    expect(bookingHelpers.formatSummaryDate('2025-03-01')).toMatch(/Mar 01 2025/);
  });

  it('derives booking type from time and date', () => {
    expect(bookingHelpers.bookingTypeFromTime('13:00', '2025-04-10')).toBe('lunch');
    expect(bookingHelpers.bookingTypeFromTime('18:30', '2025-04-10')).toBe('dinner');
  });

  it('exposes storage keys', () => {
    expect(storageKeys.contacts).toBe('bookingflow-contacts');
  });
});
