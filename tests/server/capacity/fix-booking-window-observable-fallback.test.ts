import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getVenuePolicy } from '@/server/capacity/policy';
import { computeBookingWindowWithFallback } from '@/server/capacity/table-assignment/booking-window';

// 22:15 London is past dinner service end (22:00) -> ServiceNotFoundError -> fallback.
const FALLBACK_START_ISO = '2026-05-07T22:15:00.000+01:00';
// 13:00 London is within the lunch window (12:00-15:00) -> no fallback.
const IN_SERVICE_START_ISO = '2026-05-07T13:00:00.000+01:00';

describe('#10 booking-window fallback is observable via the structured logger', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The structured logger funnels warn() through console.warn as a single
    // JSON string argument, so spying here lets us assert the structured path.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces usedFallback and fallbackService on the returned result when falling back', () => {
    const result = computeBookingWindowWithFallback({
      startISO: FALLBACK_START_ISO,
      partySize: 8,
      bookingOption: 'dinner',
      policy: getVenuePolicy(),
    });

    expect(result.usedFallback).toBe(true);
    expect(result.fallbackService).toBe('dinner');
    expect(result.window.service).toBe('dinner');
  });

  it('logs the fallback through the structured logger (not a bare console.warn(msg, obj))', () => {
    computeBookingWindowWithFallback({
      startISO: FALLBACK_START_ISO,
      partySize: 8,
      bookingOption: 'dinner',
      policy: getVenuePolicy(),
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [firstArg, ...rest] = warnSpy.mock.calls[0]!;
    // Structured logger emits exactly one JSON-string argument; the legacy
    // console.warn('message', { ...meta }) shape would have a second argument.
    expect(rest).toHaveLength(0);
    expect(typeof firstArg).toBe('string');

    const payload = JSON.parse(firstArg as string) as {
      level: string;
      message: string;
      module?: string;
      meta?: { usedFallback?: boolean; fallbackService?: string };
    };
    expect(payload.level).toBe('warn');
    expect(payload.message).toBe('service not found, using fallback service');
    expect(payload.module).toBe('capacity.booking-window');
    // usedFallback is observable in the logs as well as on the result.
    expect(payload.meta?.usedFallback).toBe(true);
    expect(payload.meta?.fallbackService).toBe('dinner');
  });

  it('does not flag a fallback (and does not log) for an in-service booking', () => {
    const result = computeBookingWindowWithFallback({
      startISO: IN_SERVICE_START_ISO,
      partySize: 4,
      policy: getVenuePolicy(),
    });

    expect(result.usedFallback).toBe(false);
    expect(result.fallbackService).toBeNull();
    expect(result.window.service).toBe('lunch');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
