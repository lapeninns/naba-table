import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getVenuePolicy } from '@/server/capacity/policy';
import { computeBookingWindowWithFallback } from '@/server/capacity/table-assignment/booking-window';

describe('computeBookingWindowWithFallback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a canonical booking option before policy order when service lookup misses', () => {
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

  it('keeps policy-order fallback when no canonical service evidence is available', () => {
    const result = computeBookingWindowWithFallback({
      startISO: '2026-05-07T22:15:00.000+01:00',
      partySize: 8,
      policy: getVenuePolicy(),
    });

    expect(result.usedFallback).toBe(true);
    expect(result.fallbackService).toBe('lunch');
    expect(result.window.service).toBe('lunch');
    expect(result.window.durationMinutes).toBe(85);
  });
});
