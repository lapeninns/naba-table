import { describe, expect, it } from 'vitest';

import {
  assertLimitsWithinOperatingConfig,
  isFallbackEligible,
  isWithinDedicatedWindow,
  loadOperatingConfig,
  localMinuteOfDay,
  nextPollDelayMs,
  validateOperatingConfig,
  type OperatingConfig,
} from '@/scripts/ci/contracts/operating-config';
import { nightlyProfile } from '@/scripts/ci/profiles/nightly';
import { prProfile } from '@/scripts/ci/profiles/pr';

function issuesOf(input: unknown): string[] {
  const result = validateOperatingConfig(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
}

describe('operating config', () => {
  const config = loadOperatingConfig();

  it('matches the agreed operating values', () => {
    expect(config).toEqual<OperatingConfig>({
      version: 1,
      timezone: 'Europe/London',
      dedicatedWindow: { start: '00:30', end: '06:30' },
      nightlyStart: '00:45',
      disk: { minFreeGiB: 100, ciCapGiB: 120 },
      retention: { logs: { days: 7, maxGiB: 10 }, evidence: { days: 14 } },
      polling: { intervalSeconds: 30, jitterSeconds: 10 },
      heartbeat: { alertAfterMinutes: 15 },
      fallback: { eligibilityAfterMinutes: 60 },
    });
  });

  it('rejects invalid time zones, clocks, and inconsistent windows', () => {
    expect(issuesOf({ ...config, timezone: 'Mars/Olympus' })).toEqual([
      expect.stringContaining('timezone'),
    ]);
    const badClock = issuesOf({ ...config, nightlyStart: '24:00' });
    expect(badClock.length).toBeGreaterThan(0);
    expect(badClock.every((issue) => issue.startsWith('nightlyStart'))).toBe(true);
    expect(issuesOf({ ...config, nightlyStart: '07:00' })).toEqual([
      expect.stringContaining('nightlyStart'),
    ]);
    expect(issuesOf({ ...config, polling: { intervalSeconds: 30, jitterSeconds: 30 } })).toEqual([
      expect.stringContaining('jitterSeconds'),
    ]);
    expect(issuesOf({ ...config, fallback: { eligibilityAfterMinutes: 5 } })).toEqual([
      expect.stringContaining('eligibilityAfterMinutes'),
    ]);
    expect(issuesOf({ ...config, extra: true })).toEqual([expect.stringContaining('extra')]);
  });

  it('evaluates the dedicated window in Europe/London across DST', () => {
    // 2026-09-04 is BST (UTC+1): 00:45 London == 23:45 UTC the day before.
    expect(localMinuteOfDay(new Date('2026-09-03T23:45:00.000Z'), 'Europe/London')).toBe(45);
    expect(isWithinDedicatedWindow(new Date('2026-09-03T23:45:00.000Z'), config)).toBe(true);
    expect(isWithinDedicatedWindow(new Date('2026-09-04T05:29:00.000Z'), config)).toBe(true);
    expect(isWithinDedicatedWindow(new Date('2026-09-04T05:30:00.000Z'), config)).toBe(false);
    expect(isWithinDedicatedWindow(new Date('2026-09-04T12:00:00.000Z'), config)).toBe(false);
    // 2026-01-15 is GMT (UTC+0).
    expect(isWithinDedicatedWindow(new Date('2026-01-15T00:30:00.000Z'), config)).toBe(true);
    expect(isWithinDedicatedWindow(new Date('2026-01-15T00:29:00.000Z'), config)).toBe(false);
  });

  it('computes fallback eligibility and jittered poll delays', () => {
    const last = new Date('2026-09-04T10:00:00.000Z');
    expect(isFallbackEligible(last, new Date('2026-09-04T10:59:00.000Z'), config)).toBe(false);
    expect(isFallbackEligible(last, new Date('2026-09-04T11:00:00.000Z'), config)).toBe(true);
    expect(nextPollDelayMs(config, () => 0)).toBe(30_000);
    expect(nextPollDelayMs(config, () => 0.999)).toBe(40_000);
  });

  it('checks profile disk allocations against the CI disk cap', () => {
    expect(() => assertLimitsWithinOperatingConfig(prProfile.limits, config)).not.toThrow();
    expect(() => assertLimitsWithinOperatingConfig(nightlyProfile.limits, config)).not.toThrow();
    expect(() =>
      assertLimitsWithinOperatingConfig({ ...prProfile.limits, diskGiB: 121 }, config),
    ).toThrow(/disk cap/u);
  });
});
