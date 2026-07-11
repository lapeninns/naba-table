import { describe, expect, it } from 'vitest';

import { toIsoDateParam } from '@src/hooks/ops/utils/toIsoDateParam';

describe('toIsoDateParam', () => {
  it('@contract returns null for empty inputs', () => {
    expect(toIsoDateParam(undefined)).toBeNull();
    expect(toIsoDateParam(null)).toBeNull();
    expect(toIsoDateParam('')).toBeNull();
    expect(toIsoDateParam('   ')).toBeNull();
  });

  it('@contract passes date-only strings through unchanged', () => {
    expect(toIsoDateParam('2026-07-11')).toBe('2026-07-11');
    expect(toIsoDateParam('  2026-07-11  ')).toBe('2026-07-11');
  });

  it('@contract truncates parseable datetime strings to their UTC date part', () => {
    expect(toIsoDateParam('2026-07-11T23:30:00.000Z')).toBe('2026-07-11');
    expect(toIsoDateParam('2026-07-11T23:30:00+02:00')).toBe('2026-07-11');
  });

  it('@contract returns null for unparseable strings', () => {
    expect(toIsoDateParam('not-a-date')).toBeNull();
  });

  it('@contract truncates Date instances to their UTC date part', () => {
    expect(toIsoDateParam(new Date('2026-07-11T00:30:00.000Z'))).toBe('2026-07-11');
  });

  it('@contract returns null for invalid Date instances', () => {
    expect(toIsoDateParam(new Date('invalid'))).toBeNull();
  });
});
