import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkSlotAvailabilityMock = vi.hoisted(() => vi.fn());
const findAlternativeSlotsMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const anonymizeIpMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity', () => ({
  checkSlotAvailability: checkSlotAvailabilityMock,
  findAlternativeSlots: findAlternativeSlotsMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/security/request', () => ({
  anonymizeIp: anonymizeIpMock,
}));

import {
  buildCapacityCreateGenericFailureResponse,
  buildCapacityCreateUnavailableResponse,
  buildCapacityFailureResponse,
  buildUnifiedValidationCapacityExceededResponse,
  resolveCapacityCreateFailureDecision,
  runBookingCreateCapacityPrecheck,
  safeFindBookingAlternatives,
} from '@/server/bookings/capacity-failure-response';

describe('booking capacity failure response helpers', () => {
  beforeEach(() => {
    checkSlotAvailabilityMock.mockReset();
    findAlternativeSlotsMock.mockReset();
    recordObservabilityEventMock.mockReset();
    anonymizeIpMock.mockReset();
    anonymizeIpMock.mockImplementation((ip: string) => `anon:${ip}`);
  });

  it('maps capacity alternative slots into the public response shape', async () => {
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '18:30', available: true, utilizationPercent: 80, bookedCovers: 12 },
      { time: '20:00', available: true, utilizationPercent: 70, maxCovers: 20 },
    ]);

    await expect(
      safeFindBookingAlternatives({
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        partySize: 4,
        preferredTime: '19:00',
        durationMinutes: 90,
        bookingOption: 'dinner',
      }),
    ).resolves.toEqual([
      { time: '18:30', available: true, utilizationPercent: 80 },
      { time: '20:00', available: true, utilizationPercent: 70 },
    ]);

    expect(findAlternativeSlotsMock).toHaveBeenCalledWith(
      {
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        partySize: 4,
        preferredTime: '19:00',
        durationMinutes: 90,
        bookingOption: 'dinner',
        maxAlternatives: 5,
        searchWindowMinutes: 120,
      },
      undefined,
    );
  });

  it('falls back to an empty alternatives list when lookup fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    findAlternativeSlotsMock.mockRejectedValue(new Error('capacity unavailable'));

    await expect(
      safeFindBookingAlternatives({
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        partySize: 4,
        preferredTime: '19:00',
      }),
    ).resolves.toEqual([]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[bookings][POST][alternatives]',
      expect.stringContaining('capacity unavailable'),
    );

    consoleErrorSpy.mockRestore();
  });

  it('builds capacity exceeded responses with headers and observability', async () => {
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '20:00', available: true, utilizationPercent: 70 },
    ]);

    const response = await buildCapacityFailureResponse({
      restaurantId: 'restaurant-1',
      date: '2026-05-22',
      startTime: '19:00',
      partySize: 4,
      requestSource: 'api.bookings',
      clientIp: '203.0.113.10',
      code: 'CAPACITY_EXCEEDED',
      message: 'No capacity available',
      details: {
        utilizationPercent: 100,
        servicePeriod: 'Dinner',
      },
    });

    await expect(response.json()).resolves.toEqual({
      error: 'No capacity available',
      code: 'CAPACITY_EXCEEDED',
      details: {
        utilizationPercent: 100,
        servicePeriod: 'Dinner',
      },
      alternatives: [{ time: '20:00', available: true, utilizationPercent: 70 }],
    });
    expect(response.status).toBe(409);
    expect(response.headers.get('X-Capacity-Exceeded')).toBe('true');
    expect(response.headers.get('X-Utilization-Percent')).toBe('100');
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.capacity_exceeded',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        time: '19:00',
        partySize: 4,
        ipScope: 'anon:203.0.113.10',
        alternativesFound: 1,
        utilizationPercent: 100,
        servicePeriod: 'Dinner',
      },
    });
  });

  it('continues booking creation when capacity precheck is available', async () => {
    checkSlotAvailabilityMock.mockResolvedValue({ available: true });

    await expect(
      runBookingCreateCapacityPrecheck({
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        startTime: '19:00',
        partySize: 4,
        durationMinutes: 90,
        bookingOption: 'dinner',
        requestSource: 'api.bookings',
        clientIp: '203.0.113.10',
      }),
    ).resolves.toEqual({ kind: 'continue' });

    expect(checkSlotAvailabilityMock).toHaveBeenCalledWith(
      {
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        time: '19:00',
        partySize: 4,
        durationMinutes: 90,
        bookingOption: 'dinner',
      },
      undefined,
    );
    expect(findAlternativeSlotsMock).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
  });

  it('returns a booking create capacity response when precheck is unavailable', async () => {
    checkSlotAvailabilityMock.mockResolvedValue({
      available: false,
      reason: 'No capacity left',
      metadata: {
        utilizationPercent: 100,
        servicePeriod: 'Dinner',
      },
    });
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '20:00', available: true, utilizationPercent: 70 },
    ]);

    const result = await runBookingCreateCapacityPrecheck({
      restaurantId: 'restaurant-1',
      date: '2026-05-22',
      startTime: '19:00',
      partySize: 4,
      durationMinutes: 90,
      bookingOption: 'dinner',
      requestSource: 'api.bookings',
      clientIp: '203.0.113.10',
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') {
      return;
    }

    expect(result.response.status).toBe(409);
    expect(result.response.headers.get('X-Capacity-Exceeded')).toBe('true');
    expect(result.response.headers.get('X-Utilization-Percent')).toBe('100');
    await expect(result.response.json()).resolves.toEqual({
      error: 'No capacity left',
      code: 'CAPACITY_EXCEEDED',
      details: {
        requestedTime: '19:00',
        partySize: 4,
        utilizationPercent: 100,
        servicePeriod: 'Dinner',
      },
      alternatives: [{ time: '20:00', available: true, utilizationPercent: 70 }],
    });
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.capacity_exceeded',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        time: '19:00',
        partySize: 4,
        ipScope: 'anon:203.0.113.10',
        alternativesFound: 1,
        requestedTime: '19:00',
        utilizationPercent: 100,
        servicePeriod: 'Dinner',
      },
    });
  });

  it('continues booking creation and records observability when capacity precheck fails', async () => {
    const onError = vi.fn();
    const capacityError = new Error('Capacity precheck unavailable');
    checkSlotAvailabilityMock.mockRejectedValue(capacityError);

    await expect(
      runBookingCreateCapacityPrecheck({
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        startTime: '19:00',
        partySize: 4,
        durationMinutes: 90,
        bookingOption: 'dinner',
        requestSource: 'api.bookings',
        clientIp: '203.0.113.10',
        onError,
      }),
    ).resolves.toEqual({ kind: 'continue' });

    expect(onError).toHaveBeenCalledWith(capacityError);
    expect(findAlternativeSlotsMock).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.capacity_precheck.failed',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        time: '19:00',
        partySize: 4,
        error: expect.stringContaining('Capacity precheck unavailable'),
      },
    });
  });

  it('builds booking conflict retry responses', async () => {
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '20:15', available: true, utilizationPercent: 65 },
    ]);

    const response = await buildCapacityFailureResponse({
      restaurantId: 'restaurant-1',
      date: '2026-05-22',
      startTime: '19:00',
      partySize: 4,
      requestSource: 'api.bookings',
      clientIp: '203.0.113.10',
      code: 'BOOKING_CONFLICT',
      message: 'This time slot was just booked. Please try again.',
      details: { servicePeriod: 'Dinner' },
      retryable: true,
      retryAfterSeconds: 2,
    });

    await expect(response.json()).resolves.toEqual({
      error: 'This time slot was just booked. Please try again.',
      code: 'BOOKING_CONFLICT',
      details: { servicePeriod: 'Dinner' },
      alternatives: [{ time: '20:15', available: true, utilizationPercent: 65 }],
      retryable: true,
      retryAfter: 2,
    });
    expect(response.status).toBe(409);
    expect(response.headers.get('Retry-After')).toBe('2');
    expect(response.headers.get('X-Conflict-Type')).toBe('race_condition');
    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
  });

  it('builds capacity unavailable responses without alternative lookup', () => {
    expect(
      buildCapacityCreateUnavailableResponse({
        message: null,
        details: undefined,
      }),
    ).toEqual({
      body: {
        error: 'Capacity enforcement unavailable',
        code: 'CAPACITY_UNAVAILABLE',
        details: null,
      },
      init: { status: 503 },
    });

    expect(findAlternativeSlotsMock).not.toHaveBeenCalled();
  });

  it('builds generic capacity create failure responses with defaults', () => {
    expect(
      buildCapacityCreateGenericFailureResponse({
        message: null,
        code: null,
        details: undefined,
      }),
    ).toEqual({
      body: {
        error: 'Unable to create booking',
        code: 'INTERNAL_ERROR',
        details: null,
      },
      init: { status: 500 },
    });
  });

  it('preserves explicit generic capacity create failure fields', () => {
    expect(
      buildCapacityCreateGenericFailureResponse({
        message: 'Unable to reserve covers',
        code: 'CUSTOM_CAPACITY_ERROR',
        details: { covers: 4 },
      }),
    ).toEqual({
      body: {
        error: 'Unable to reserve covers',
        code: 'CUSTOM_CAPACITY_ERROR',
        details: { covers: 4 },
      },
      init: { status: 500 },
    });
  });

  it('resolves capacity create unavailable failures', () => {
    expect(
      resolveCapacityCreateFailureDecision({
        code: 'CAPACITY_UNAVAILABLE',
        message: 'Capacity service offline',
        details: { service: 'capacity' },
      }),
    ).toEqual({
      kind: 'unavailable',
      message: 'Capacity service offline',
      details: { service: 'capacity' },
    });
  });

  it('resolves capacity exceeded failures with the existing default message', () => {
    expect(
      resolveCapacityCreateFailureDecision({
        code: 'CAPACITY_EXCEEDED',
        message: null,
        details: { utilizationPercent: 100 },
      }),
    ).toEqual({
      kind: 'capacity_failure',
      code: 'CAPACITY_EXCEEDED',
      message: 'No capacity available',
      details: { utilizationPercent: 100 },
    });
  });

  it('resolves booking conflict failures with retry guidance', () => {
    expect(
      resolveCapacityCreateFailureDecision({
        code: 'BOOKING_CONFLICT',
        message: null,
        details: { servicePeriod: 'Dinner' },
      }),
    ).toEqual({
      kind: 'capacity_failure',
      code: 'BOOKING_CONFLICT',
      message: 'This time slot was just booked. Please try again.',
      details: { servicePeriod: 'Dinner' },
      retryable: true,
      retryAfterSeconds: 1,
    });
  });

  it('resolves generic capacity create failures without changing fields', () => {
    expect(
      resolveCapacityCreateFailureDecision({
        code: 'CUSTOM_CAPACITY_ERROR',
        message: 'Unable to reserve covers',
        details: ['raw-detail'],
      }),
    ).toEqual({
      kind: 'generic',
      code: 'CUSTOM_CAPACITY_ERROR',
      message: 'Unable to reserve covers',
      details: ['raw-detail'],
    });
  });

  it('builds unified validation capacity exceeded responses with alternatives and headers', async () => {
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '20:30', available: true, utilizationPercent: 55 },
    ]);

    const response = await buildUnifiedValidationCapacityExceededResponse({
      restaurantId: 'restaurant-1',
      date: '2026-05-22',
      partySize: 4,
      preferredTime: '19:00',
      durationMinutes: 90,
      bookingOption: 'dinner',
      response: {
        ok: false,
        issues: [
          {
            code: 'CAPACITY_EXCEEDED',
            message: 'No capacity available',
            detail: { utilizationPercent: 100 },
          },
        ],
      },
    });

    expect(response).toEqual({
      body: {
        ok: false,
        issues: [
          {
            code: 'CAPACITY_EXCEEDED',
            message: 'No capacity available',
            detail: { utilizationPercent: 100 },
          },
        ],
        alternatives: [{ time: '20:30', available: true, utilizationPercent: 55 }],
      },
      init: {
        status: 409,
        headers: {
          'X-Capacity-Exceeded': 'true',
          'X-Booking-Validation': 'unified',
          'X-Utilization-Percent': '100',
        },
      },
    });
  });

  it('omits utilization header when unified capacity detail has no numeric utilization', async () => {
    findAlternativeSlotsMock.mockResolvedValue([]);

    const response = await buildUnifiedValidationCapacityExceededResponse({
      restaurantId: 'restaurant-1',
      date: '2026-05-22',
      partySize: 4,
      preferredTime: '19:00',
      response: {
        ok: false,
        issues: [
          {
            code: 'CAPACITY_EXCEEDED',
            message: 'No capacity available',
            detail: { utilizationPercent: '100' },
          },
        ],
      },
    });

    expect(response?.init.headers).toEqual({
      'X-Capacity-Exceeded': 'true',
      'X-Booking-Validation': 'unified',
    });
  });

  it('returns null for non-capacity unified validation failures', async () => {
    await expect(
      buildUnifiedValidationCapacityExceededResponse({
        restaurantId: 'restaurant-1',
        date: '2026-05-22',
        partySize: 4,
        preferredTime: '19:00',
        response: {
          ok: false,
          issues: [{ code: 'OUTSIDE_HOURS', message: 'Outside hours' }],
        },
      }),
    ).resolves.toBeNull();

    expect(findAlternativeSlotsMock).not.toHaveBeenCalled();
  });
});
