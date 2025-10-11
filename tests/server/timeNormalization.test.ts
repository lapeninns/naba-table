import { describe, expect, it } from 'vitest';

import {
  TIME_REGEX,
  canonicalOptionalTime,
  canonicalTime,
  canonicalizeFromDb,
} from '@/server/restaurants/timeNormalization';

describe('timeNormalization', () => {
  it('canonicalTime strips seconds and preserves hours/minutes', () => {
    expect(canonicalTime('12:30:45')).toBe('12:30');
    expect(canonicalTime('07:05')).toBe('07:05');
  });

  it('canonicalOptionalTime returns null for empty values', () => {
    expect(canonicalOptionalTime(null)).toBeNull();
    expect(canonicalOptionalTime(undefined)).toBeNull();
    expect(canonicalOptionalTime('')).toBeNull();
    expect(canonicalOptionalTime('  ')).toBeNull();
  });

  it('canonicalizeFromDb trims and strips trailing seconds', () => {
    expect(canonicalizeFromDb('18:15:00')).toBe('18:15');
    expect(canonicalizeFromDb('09:00')).toBe('09:00');
    expect(canonicalizeFromDb(null)).toBeNull();
  });

  it('TIME_REGEX accepts optional seconds', () => {
    expect(TIME_REGEX.test('23:45')).toBe(true);
    expect(TIME_REGEX.test('23:45:59')).toBe(true);
    expect(TIME_REGEX.test('24:00')).toBe(false);
  });
});
