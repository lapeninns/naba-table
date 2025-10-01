import { describe, expect, it } from 'vitest';

import {
  clampMinutes,
  createMinutesRange,
  fromMinutes,
  normalizeTime,
  slotsForRange,
  toMinutes,
} from '@reserve/shared/time';

describe('shared/time primitives', () => {
  it('normalizes time strings', () => {
    expect(normalizeTime('18:30')).toBe('18:30');
    expect(normalizeTime('18:30:59')).toBe('18:30');
    expect(normalizeTime('18:30 ')).toBe('18:30');
    expect(normalizeTime('25:00')).toBeNull();
  });

  it('converts between time strings and minutes', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('01:30')).toBe(90);
    expect(fromMinutes(90)).toBe('01:30');
    expect(fromMinutes(24 * 60)).toBe('00:00');
  });

  it('clamps minute values within bounds', () => {
    expect(clampMinutes(-10, 0, 120)).toBe(0);
    expect(clampMinutes(50, 0, 120)).toBe(50);
    expect(clampMinutes(200, 0, 120)).toBe(120);
  });

  it('creates minute ranges and slots', () => {
    expect(createMinutesRange('12:00', '13:00', 30)).toEqual([720, 750]);
    expect(slotsForRange('12:00', '13:00', 30)).toEqual(['12:00', '12:30']);
  });
});
