import { describe, expect, it } from 'vitest';

import { buildOpsDateRange } from '@/utils/ops/bookings';

describe('buildOpsDateRange', () => {
  it('returns UTC day boundaries when no timezone is provided', () => {
    const range = buildOpsDateRange('2030-01-01');

    expect(range).not.toBeNull();
    expect(range?.date).toBe('2030-01-01');
    expect(range?.from.startsWith('2030-01-01T00:00:00')).toBe(true);
    expect(range?.to.startsWith('2030-01-02T00:00:00')).toBe(true);
  });

  it('computes boundaries in the supplied timezone', () => {
    const range = buildOpsDateRange('2030-01-01', 'America/New_York');

    expect(range).not.toBeNull();
    expect(range?.from).toBe('2030-01-01T05:00:00.000Z');
    expect(range?.to).toBe('2030-01-02T05:00:00.000Z');
  });

  it('returns null for invalid dates', () => {
    expect(buildOpsDateRange('not-a-date')).toBeNull();
    expect(buildOpsDateRange('')).toBeNull();
  });
});
