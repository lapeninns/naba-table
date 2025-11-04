import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { __internal as demandInternal } from '@/server/capacity/demand-profiles';

describe('normalizeWindow edge cases', () => {
  const normalizeWindow = demandInternal.normalizeWindow as (s?: string, e?: string) => { startMinute: number; endMinute: number };
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('defaults missing values to [00:00, 24:00)', () => {
    expect(normalizeWindow()).toEqual({ startMinute: 0, endMinute: 1440 });
    expect(normalizeWindow(undefined, undefined)).toEqual({ startMinute: 0, endMinute: 1440 });
  });

  it('uses 00:00 when start is missing and end is valid', () => {
    expect(normalizeWindow(undefined, '13:15')).toEqual({ startMinute: 0, endMinute: 13 * 60 + 15 });
  });

  it('uses 24:00 when end is missing and start is valid', () => {
    expect(normalizeWindow('11:30')).toEqual({ startMinute: 11 * 60 + 30, endMinute: 1440 });
  });

  it('when end <= start and both provided, warns and clamps to end of day', () => {
    const res = normalizeWindow('18:00', '17:00');
    expect(res).toEqual({ startMinute: 18 * 60, endMinute: 1440 });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('ensures at least 1 minute duration when end equals start with defaults', () => {
    const res = normalizeWindow('10:00', '10:00');
    // Both provided → remainder of day behavior
    expect(res).toEqual({ startMinute: 10 * 60, endMinute: 1440 });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to defaults for invalid inputs', () => {
    expect(normalizeWindow('25:00', '99:99')).toEqual({ startMinute: 0, endMinute: 1440 });
  });
});

