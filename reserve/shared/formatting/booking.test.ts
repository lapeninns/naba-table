import {
  formatReservationDateFromDate,
  formatReservationDateShortFromDate,
  formatReservationDateTimeFromDate,
  formatReservationTimeFromDate,
} from './booking';

describe('booking formatting helpers', () => {
  it('formats dates and times deterministically with an explicit timezone', () => {
    const date = new Date('2026-01-15T18:30:00.000Z');
    const timezone = 'Europe/London';

    expect(formatReservationDateFromDate(date, { timezone })).toBe('Thursday, 15 January 2026');
    expect(formatReservationDateShortFromDate(date, { timezone })).toBe('Thu 15 Jan');
    expect(formatReservationTimeFromDate(date, { timezone })).toBe('18:30');
    expect(formatReservationDateTimeFromDate(date, { timezone })).toBe('15 Jan 2026, 18:30');
  });

  it('fails closed on invalid dates', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const invalid = new Date('not-a-date');
    const timezone = 'Europe/London';

    expect(formatReservationDateFromDate(invalid, { timezone })).toBe('');
    expect(formatReservationDateShortFromDate(invalid, { timezone })).toBe('');
    expect(formatReservationDateTimeFromDate(invalid, { timezone })).toBe('');
    expect(formatReservationTimeFromDate(invalid, { timezone })).toBe('');
    warnSpy.mockRestore();
  });
});
