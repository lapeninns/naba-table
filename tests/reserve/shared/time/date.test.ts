import { describe, expect, it } from 'vitest';

import {
  LONDON_TIME_ZONE,
  createDateFromParts,
  getDayKey,
  isWeekend,
  parseReservationDate,
  toDateMidnight,
} from '@shared/time/date';

// All assertions are relative to the produced Date's local fields so the suite
// stays deterministic under any runner timezone (verified with TZ=Pacific/Chatham).

describe('parseReservationDate', () => {
  it('passes through valid ISO dates @contract', () => {
    expect(parseReservationDate('2026-03-29')).toBe('2026-03-29');
  });

  it('throws for malformed dates @contract', () => {
    expect(() => parseReservationDate('03-29-2026')).toThrow('Invalid reservation date: 03-29-2026');
  });
});

describe('toDateMidnight', () => {
  it('produces local midnight for the calendar day @contract', () => {
    const result = toDateMidnight('2026-03-27');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(27);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('stays on the requested day across a DST-transition date @contract', () => {
    // 2026-03-29 is the Europe/London spring-forward day; 2026-04-05 is the
    // Pacific/Chatham fall-back day. Local-midnight parsing must keep the day.
    for (const day of ['2026-03-29', '2026-04-05', '2026-09-27', '2026-10-25']) {
      const result = toDateMidnight(day);
      const [year, month, date] = day.split('-').map(Number);
      expect(result.getFullYear()).toBe(year);
      expect(result.getMonth()).toBe(month - 1);
      expect(result.getDate()).toBe(date);
    }
  });
});

describe('createDateFromParts', () => {
  it('combines date and time into a local Date @contract', () => {
    const result = createDateFromParts('2026-03-27', '19:30');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(27);
    expect(result.getHours()).toBe(19);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
  });

  it('accepts times with seconds and normalizes them @contract', () => {
    const result = createDateFromParts('2026-03-27', '09:15:00');
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(15);
  });

  it('keeps evening slots on the right day across DST boundaries @contract', () => {
    const result = createDateFromParts('2026-03-29', '19:00');
    expect(result.getDate()).toBe(29);
    expect(result.getHours()).toBe(19);
  });

  it('throws for invalid time or date parts @contract', () => {
    expect(() => createDateFromParts('2026-03-27', '25:00')).toThrow('Invalid time value: 25:00');
    expect(() => createDateFromParts('bad-date', '12:00')).toThrow('Invalid reservation date: bad-date');
  });
});

describe('isWeekend / getDayKey', () => {
  it('flags Saturday and Sunday as weekend @contract', () => {
    expect(isWeekend(toDateMidnight('2026-03-28'))).toBe(true); // Saturday
    expect(isWeekend(toDateMidnight('2026-03-29'))).toBe(true); // Sunday
    expect(isWeekend(toDateMidnight('2026-03-27'))).toBe(false); // Friday
  });

  it('returns the same day key for string and Date inputs @contract', () => {
    expect(getDayKey('2026-03-27')).toBe(5);
    expect(getDayKey(toDateMidnight('2026-03-27'))).toBe(5);
    expect(getDayKey('2026-03-29')).toBe(0);
  });
});

describe('LONDON_TIME_ZONE', () => {
  it('pins the venue timezone constant @contract', () => {
    expect(LONDON_TIME_ZONE).toBe('Europe/London');
  });
});
