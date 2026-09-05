import { describe, expect, it } from 'vitest';

import {
  computeEffectiveRecoveryWindowDays,
  impliedContentTtlDays,
  RecoveryWindowError,
} from '../../scripts/db/backup/recovery-window';
import { computeContentTtlDays } from '../../server/dual-sync/retention/policy';

describe('computeEffectiveRecoveryWindowDays', () => {
  it('takes the longest-lived copy plus an interval and overhang, rounding up', () => {
    expect(
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: 7,
        independentRetentionDays: 7,
        intervalHours: 12,
        overhangDays: 1,
      }),
    ).toBe(9);
    // 7 + 0.5 + 0.25 = 7.75 → 8 (never rounds down)
    expect(
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: 1,
        independentRetentionDays: 7,
        intervalHours: 12,
        overhangDays: 0.25,
      }),
    ).toBe(8);
    // Native retention dominates when it is the longest copy.
    expect(
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: 30,
        independentRetentionDays: 7,
        intervalHours: 12,
        overhangDays: 0,
      }),
    ).toBe(30);
    // Exact integers stay exact.
    expect(
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: 7,
        independentRetentionDays: 6,
        intervalHours: 24,
        overhangDays: 0,
      }),
    ).toBe(7);
  });

  it('never returns less than one day and rejects invalid inputs', () => {
    expect(
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: 0.1,
        independentRetentionDays: 0,
        intervalHours: 0,
        overhangDays: 0,
      }),
    ).toBe(1);
    expect(() =>
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: 0,
        independentRetentionDays: 0,
        intervalHours: 12,
        overhangDays: 1,
      }),
    ).toThrow(RecoveryWindowError);
    expect(() =>
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: -1,
        independentRetentionDays: 7,
        intervalHours: 12,
        overhangDays: 1,
      }),
    ).toThrow(RecoveryWindowError);
    expect(() =>
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: Number.NaN,
        independentRetentionDays: 7,
        intervalHours: 12,
        overhangDays: 1,
      }),
    ).toThrow(RecoveryWindowError);
  });

  it('bridges read-only to the GBP retention policy TTL', () => {
    expect(impliedContentTtlDays(9)).toBe(computeContentTtlDays(9));
  });
});
