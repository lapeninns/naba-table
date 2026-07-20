import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { resetLogSamplingForTests, sampleRoutineLog } from '@/lib/observability/log-sampling';
import { createOpsBookingApiTiming } from '@/src/app/api/ops/bookings/_shared/performance';

describe('sampleRoutineLog', () => {
  beforeEach(() => {
    resetLogSamplingForTests();
  });

  it('keeps the first occurrence and then one per rate window', () => {
    const decisions = Array.from({ length: 25 }, () => sampleRoutineLog('k', 10));
    expect(decisions[0]).toBe(true);
    expect(decisions.filter(Boolean)).toHaveLength(3); // occurrences 1, 11, 21
  });

  it('tracks keys independently', () => {
    expect(sampleRoutineLog('a', 10)).toBe(true);
    expect(sampleRoutineLog('b', 10)).toBe(true);
    expect(sampleRoutineLog('a', 10)).toBe(false);
  });

  it('always samples at rate 1', () => {
    expect(sampleRoutineLog('c', 1)).toBe(true);
    expect(sampleRoutineLog('c', 1)).toBe(true);
  });
});

describe('ops booking api timing log sampling', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetLogSamplingForTests();
    infoSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const timingLogs = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls
      .map(([line]) => {
        try {
          return JSON.parse(String(line)) as { message?: string; meta?: Record<string, unknown> };
        } catch {
          return null;
        }
      })
      .filter((entry) => entry?.message === 'ops.booking_api.timing');

  it('always logs failures at warn level', () => {
    const timing = createOpsBookingApiTiming('ops.bookings.dialog');
    timing.json({ error: 'nope' }, { status: 500 });

    expect(timingLogs(warnSpy)).toHaveLength(1);
    expect(timingLogs(infoSpy)).toHaveLength(0);
  });

  it('always logs slow requests at info level with a slow flag', () => {
    vi.useFakeTimers();
    const timing = createOpsBookingApiTiming('ops.bookings.dialog');
    // First healthy request consumes the sample slot.
    timing.json({ ok: true });

    const slowTiming = createOpsBookingApiTiming('ops.bookings.dialog');
    vi.advanceTimersByTime(5_000);
    slowTiming.json({ ok: true });

    const infoEntries = timingLogs(infoSpy);
    expect(infoEntries).toHaveLength(2);
    expect(infoEntries[1]?.meta?.slow).toBe(true);
  });

  it('samples healthy fast requests instead of logging each one', () => {
    for (let index = 0; index < 20; index += 1) {
      const timing = createOpsBookingApiTiming('ops.bookings.list');
      timing.json({ ok: true });
    }

    // 1st and 11th occurrences log info; the rest fall to debug level, which
    // the default LOG_LEVEL=info drops entirely (opt back in via LOG_LEVEL=debug).
    expect(timingLogs(infoSpy)).toHaveLength(2);
    expect(timingLogs(debugSpy)).toHaveLength(0);
  });

  it('still returns Server-Timing headers for every response', () => {
    const timing = createOpsBookingApiTiming('ops.bookings.dialog');
    const response = timing.json({ ok: true });
    expect(response.headers.get('Server-Timing')).toContain('total;dur=');
    expect(response.headers.get('X-Ops-Api-Duration-Ms')).toBeDefined();
  });
});
