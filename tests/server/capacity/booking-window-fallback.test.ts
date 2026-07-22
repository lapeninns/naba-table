import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getVenuePolicy, ServiceNotFoundError } from '@/server/capacity/policy';
import {
  computeBookingWindowWithFallback,
  resetBookingWindowFallbackWarningsForTests,
} from '@/server/capacity/table-assignment/booking-window';

describe('computeBookingWindowWithFallback', () => {
  beforeEach(() => {
    resetBookingWindowFallbackWarningsForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('uses a canonical booking option within the bounded margin when service lookup misses', () => {
    const result = computeBookingWindowWithFallback({
      startISO: '2026-05-07T22:15:00.000+01:00',
      partySize: 8,
      bookingOption: 'dinner',
      policy: getVenuePolicy(),
    });

    expect(result.usedFallback).toBe(true);
    expect(result.fallbackService).toBe('dinner');
    expect(result.window.service).toBe('dinner');
    expect(result.window.durationMinutes).toBe(90);
    expect(result.window.dining.start.toISO()).toBe('2026-05-07T22:15:00.000+01:00');
    expect(result.window.clampedToServiceEnd).toBe(false);
  });

  it('no longer guesses a service from policy order without explicit evidence', () => {
    // Previously this silently fell back to lunch (the first configured
    // service) for a 22:15 start — an out-of-policy booking. It must now fail
    // with the controlled ServiceNotFoundError instead.
    expect(() =>
      computeBookingWindowWithFallback({
        startISO: '2026-05-07T22:15:00.000+01:00',
        partySize: 8,
        policy: getVenuePolicy(),
      }),
    ).toThrow(ServiceNotFoundError);
  });

  it('rejects starts beyond the bounded extension even with an explicit service', () => {
    // Dinner ends 22:00; the default bounded margin is 60 minutes, so a 23:30
    // start must not be force-fitted into dinner service.
    expect(() =>
      computeBookingWindowWithFallback({
        startISO: '2026-05-07T23:30:00.000+01:00',
        partySize: 4,
        bookingOption: 'dinner',
        policy: getVenuePolicy(),
      }),
    ).toThrow(ServiceNotFoundError);
  });

  it('disables the fallback entirely when CAPACITY_SERVICE_FALLBACK=off', () => {
    vi.stubEnv('CAPACITY_SERVICE_FALLBACK', 'off');
    expect(() =>
      computeBookingWindowWithFallback({
        startISO: '2026-05-07T22:15:00.000+01:00',
        partySize: 8,
        bookingOption: 'dinner',
        policy: getVenuePolicy(),
      }),
    ).toThrow(ServiceNotFoundError);
  });
});
