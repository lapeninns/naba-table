import { describe, expect, it } from 'vitest';

import {
  isReservationDate,
  isReservationTime,
  toReservationDate,
  toReservationTime,
} from '@shared/time/types';

describe('isReservationDate', () => {
  it.each(['2026-03-29', '1999-01-01', '2026-12-31'])('accepts %s @contract', (value) => {
    expect(isReservationDate(value)).toBe(true);
  });

  it.each([
    ['2026-3-29', 'unpadded month'],
    ['29-03-2026', 'reversed order'],
    ['2026/03/29', 'wrong separator'],
    ['2026-03-29T00:00:00', 'timestamp suffix'],
    ['', 'empty'],
  ])('rejects %s (%s) @contract', (value) => {
    expect(isReservationDate(value)).toBe(false);
  });

  it('rejects null and undefined @contract', () => {
    expect(isReservationDate(null)).toBe(false);
    expect(isReservationDate(undefined)).toBe(false);
  });
});

describe('isReservationTime', () => {
  it.each(['00:00', '09:15', '19:30', '23:59', ' 12:00 '])('accepts %s @contract', (value) => {
    expect(isReservationTime(value)).toBe(true);
  });

  it.each(['24:00', '9:30', '12:60', '12:00:00', 'noon', ''])('rejects %s @contract', (value) => {
    expect(isReservationTime(value)).toBe(false);
  });
});

describe('toReservationDate / toReservationTime', () => {
  it('returns branded values for valid inputs @contract', () => {
    expect(toReservationDate('2026-03-29')).toBe('2026-03-29');
    expect(toReservationTime('19:00')).toBe('19:00');
  });

  it('trims reservation times before branding @contract', () => {
    expect(toReservationTime(' 19:00 ')).toBe('19:00');
  });

  it('throws with the offending value for invalid inputs @contract', () => {
    expect(() => toReservationDate('29/03/2026')).toThrow('Invalid reservation date: 29/03/2026');
    expect(() => toReservationTime('25:00')).toThrow('Invalid reservation time: 25:00');
  });
});
