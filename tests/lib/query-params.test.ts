import { describe, expect, it } from 'vitest';

import {
  daysBetweenInclusive,
  firstString,
  safeBool,
  safeDate,
  stringArray,
} from '@/lib/api/query-params';

describe('query parameter normalization', () => {
  it('reads the first duplicate string deterministically', () => {
    const params = new URLSearchParams('restaurantId=one&restaurantId=two');
    expect(firstString(params, 'restaurantId')).toBe('one');
  });

  it('normalizes repeated and comma-separated arrays', () => {
    const params = new URLSearchParams('status=pending,confirmed&status=cancelled');
    expect(stringArray(params, 'status')).toEqual(['pending', 'confirmed', 'cancelled']);
  });

  it('parses query booleans without z.coerce.boolean truthiness traps', () => {
    expect(
      safeBool(new URLSearchParams('includeAlternatives=false'), 'includeAlternatives', true),
    ).toBe(false);
    expect(safeBool(new URLSearchParams('includeAlternatives=true'), 'includeAlternatives')).toBe(
      true,
    );
    expect(
      safeBool(new URLSearchParams('includeAlternatives=0'), 'includeAlternatives', true),
    ).toBe(false);
  });

  it('accepts only real ISO calendar dates', () => {
    expect(safeDate(new URLSearchParams('from=2026-02-28'), 'from')).toBe('2026-02-28');
    expect(safeDate(new URLSearchParams('from=2026-02-31'), 'from')).toBeUndefined();
    expect(safeDate(new URLSearchParams('from=not-a-date'), 'from')).toBeUndefined();
  });

  it('counts inclusive date windows', () => {
    expect(daysBetweenInclusive('2026-05-01', '2026-05-01')).toBe(1);
    expect(daysBetweenInclusive('2026-05-01', '2026-05-31')).toBe(31);
  });
});
