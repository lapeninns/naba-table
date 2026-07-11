import { describe, expect, it } from 'vitest';

import {
  MINUTES_PER_DAY,
  clampMinutes,
  createMinutesRange,
  fromMinutes,
  minutesBetween,
  normalizeTime,
  slotsForRange,
  toMinutes,
} from '@shared/time/time';

describe('normalizeTime', () => {
  it.each([
    ['19:00', '19:00'],
    ['19:00:00', '19:00'],
    [' 08:30 ', '08:30'],
    ['23:59', '23:59'],
    ['00:00', '00:00'],
  ])('normalizes %s to %s @contract', (input, expected) => {
    expect(normalizeTime(input)).toBe(expected);
  });

  it.each([
    ['9:30', 'single-digit hour is not a reservation time'],
    ['24:00', 'hour past 23'],
    ['12:60', 'minutes past 59'],
    ['', 'empty string'],
    ['half past six', 'free text'],
  ])('rejects %s (%s) @contract', (input) => {
    expect(normalizeTime(input)).toBeNull();
  });

  it('returns null for null and undefined inputs @contract', () => {
    expect(normalizeTime(null)).toBeNull();
    expect(normalizeTime(undefined)).toBeNull();
  });
});

describe('toMinutes / fromMinutes', () => {
  it.each([
    ['00:00', 0],
    ['01:00', 60],
    ['12:30', 750],
    ['23:59', 1439],
  ])('converts %s to %d minutes and back @contract', (time, minutes) => {
    expect(toMinutes(time)).toBe(minutes);
    expect(fromMinutes(minutes)).toBe(time);
  });

  it('throws for invalid time values @contract', () => {
    expect(() => toMinutes('25:00')).toThrow('Invalid time value: 25:00');
    expect(() => fromMinutes(Number.NaN)).toThrow('Invalid minutes value: NaN');
    expect(() => fromMinutes(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('wraps overnight totals past midnight back into the day @contract', () => {
    // Overnight service math: 25:00 on the wire means 01:00 the next day.
    expect(fromMinutes(25 * 60)).toBe('01:00');
    expect(fromMinutes(MINUTES_PER_DAY)).toBe('00:00');
    expect(fromMinutes(MINUTES_PER_DAY + 90)).toBe('01:30');
  });

  it('wraps negative minutes backwards across midnight @contract', () => {
    expect(fromMinutes(-30)).toBe('23:30');
    expect(fromMinutes(-MINUTES_PER_DAY)).toBe('00:00');
  });
});

describe('clampMinutes', () => {
  it('clamps values into the default day range @contract', () => {
    expect(clampMinutes(-10)).toBe(0);
    expect(clampMinutes(500)).toBe(500);
    expect(clampMinutes(MINUTES_PER_DAY + 1)).toBe(MINUTES_PER_DAY);
  });

  it('throws when min exceeds max @contract', () => {
    expect(() => clampMinutes(10, 100, 50)).toThrow('Invalid clamp range: min 100 greater than max 50');
  });
});

describe('minutesBetween', () => {
  it('returns signed distance between two times @contract', () => {
    expect(minutesBetween('12:00', '13:30')).toBe(90);
    expect(minutesBetween('13:30', '12:00')).toBe(-90);
    expect(minutesBetween('12:00', '12:00')).toBe(0);
  });
});

describe('createMinutesRange / slotsForRange', () => {
  it('builds an exclusive-end range at the given step @contract', () => {
    expect(createMinutesRange('12:00', '13:00', 30)).toEqual([720, 750]);
    expect(slotsForRange('12:00', '13:00', 30)).toEqual(['12:00', '12:30']);
  });

  it('returns an empty schedule when end precedes start @contract', () => {
    expect(createMinutesRange('18:00', '17:00', 30)).toEqual([]);
    expect(slotsForRange('18:00', '18:00', 15)).toEqual([]);
  });

  it('rejects non-positive steps @contract', () => {
    expect(() => createMinutesRange('12:00', '13:00', 0)).toThrow(
      'Step minutes must be positive. Received 0',
    );
    expect(() => createMinutesRange('12:00', '13:00', -15)).toThrow();
  });
});
