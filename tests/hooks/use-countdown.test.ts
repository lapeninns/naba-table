import { act, renderHook } from '@testing-library/react';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCountdown } from '@src/hooks/use-countdown';

const NOW_ISO = '2026-07-11T12:00:00.000Z';

function utc(iso: string) {
  return DateTime.fromISO(iso, { zone: 'utc' });
}

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract reports null minutes for a missing target', () => {
    const { result } = renderHook(() => useCountdown(null));

    expect(result.current.minutesRemaining).toBeNull();
    expect(result.current.timeStatus).toBe('upcoming');
  });

  it('@contract reports null minutes for an invalid target', () => {
    const { result } = renderHook(() => useCountdown(DateTime.fromISO('not-a-date')));

    expect(result.current.minutesRemaining).toBeNull();
  });

  it('@contract classifies a far-future target as upcoming', () => {
    const { result } = renderHook(() => useCountdown(utc('2026-07-11T12:30:00.000Z')));

    expect(result.current.minutesRemaining).toBe(30);
    expect(result.current.timeStatus).toBe('upcoming');
  });

  it('@contract classifies a target within 15 minutes as imminent', () => {
    const { result } = renderHook(() => useCountdown(utc('2026-07-11T12:10:00.000Z')));

    expect(result.current.minutesRemaining).toBe(10);
    expect(result.current.timeStatus).toBe('imminent');
  });

  it('@contract classifies a target up to an hour in the past as started', () => {
    const { result } = renderHook(() => useCountdown(utc('2026-07-11T11:30:00.000Z')));

    expect(result.current.minutesRemaining).toBe(-30);
    expect(result.current.timeStatus).toBe('started');
  });

  it('@contract classifies a target more than an hour in the past as past', () => {
    const { result } = renderHook(() => useCountdown(utc('2026-07-11T10:00:00.000Z')));

    expect(result.current.minutesRemaining).toBe(-120);
    expect(result.current.timeStatus).toBe('past');
  });

  it('@contract re-evaluates on the configured interval', () => {
    const { result } = renderHook(() =>
      useCountdown(utc('2026-07-11T12:16:00.000Z'), 60_000),
    );

    expect(result.current.minutesRemaining).toBe(16);
    expect(result.current.timeStatus).toBe('upcoming');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.minutesRemaining).toBe(15);
    expect(result.current.timeStatus).toBe('imminent');
  });

  it('@contract stops ticking after unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useCountdown(utc('2026-07-11T12:30:00.000Z')));

    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
