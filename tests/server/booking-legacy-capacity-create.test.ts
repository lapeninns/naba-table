import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAlternativeSlotsMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const anonymizeIpMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity', () => ({
  checkSlotAvailability: vi.fn(),
  createBookingWithCapacityCheck: vi.fn(),
  findAlternativeSlots: findAlternativeSlotsMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/security/request', () => ({
  anonymizeIp: anonymizeIpMock,
}));

import {
  runBookingCreateLegacyCapacityCreate,
  type BookingCreateCapacityCreator,
  type BookingCreateInitialStatusEnforcer,
  type BookingCreateMissingRecordResolver,
} from '@/server/bookings/legacy-capacity-create';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';
import type { Json } from '@/types/supabase';

type LegacyCapacityClient = Parameters<BookingCreateMissingRecordResolver>[0]['client'] &
  Parameters<BookingCreateInitialStatusEnforcer>[0]['client'];

const client = { from: vi.fn() } as unknown as LegacyCapacityClient;

const request = {
  date: '2026-07-01',
  time: '19:00',
  party: 4,
  bookingType: 'dinner',
  notes: 'Window seat please',
  name: 'Alex Guest',
  email: 'alex@example.com',
  phone: '+447700900123',
  marketingOptIn: true,
} satisfies BookingCreateRequest;

const customer = { id: 'customer-1' };
const pendingBooking = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  customer_id: 'customer-1',
  booking_date: '2026-07-01',
  start_time: '19:00',
  end_time: '20:30',
  status: 'pending',
} as BookingRecord;

const confirmedBooking = {
  ...pendingBooking,
  status: 'confirmed',
} as BookingRecord;

const baseArgs = {
  client,
  request,
  customer,
  restaurantId: 'restaurant-1',
  bookingType: 'dinner' as const,
  startTime: '19:00',
  endTime: '20:30',
  durationMinutes: 90,
  bookingSource: 'api',
  idempotencyKey: 'idem-1',
  clientRequestId: 'request-1',
  bookingDetails: { source: 'public' } as Json,
  clientIp: '203.0.113.10',
  requestSource: 'api.bookings',
};

describe('runBookingCreateLegacyCapacityCreate', () => {
  beforeEach(() => {
    findAlternativeSlotsMock.mockReset();
    recordObservabilityEventMock.mockReset();
    anonymizeIpMock.mockReset();
    anonymizeIpMock.mockImplementation((ip: string) => `anon:${ip}`);
  });

  it('returns created bookings after initial status enforcement', async () => {
    const capacityCreator = vi.fn(async () => ({
      success: true,
      duplicate: false,
      booking: confirmedBooking,
    }));
    const initialStatusEnforcer = vi.fn(async () => pendingBooking);

    await expect(
      runBookingCreateLegacyCapacityCreate({
        ...baseArgs,
        capacityCreator: capacityCreator as BookingCreateCapacityCreator,
        initialStatusEnforcer: initialStatusEnforcer as BookingCreateInitialStatusEnforcer,
      }),
    ).resolves.toEqual({
      kind: 'created',
      booking: pendingBooking,
      reusedExisting: false,
    });

    expect(capacityCreator).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'restaurant-1',
        customerId: 'customer-1',
        bookingDate: '2026-07-01',
        startTime: '19:00',
        endTime: '20:30',
        partySize: 4,
        idempotencyKey: 'idem-1',
      }),
    );
    expect(initialStatusEnforcer).toHaveBeenCalledWith({
      booking: confirmedBooking,
      client,
      reusedExisting: false,
      onError: undefined,
    });
  });

  it('recovers missing booking records before status enforcement', async () => {
    const recoveredBooking = { ...pendingBooking, id: 'booking-recovered' } as BookingRecord;
    const capacityCreator = vi.fn(async () => ({
      success: true,
      duplicate: false,
      booking: undefined,
    }));
    const missingRecordResolver = vi.fn(async () => recoveredBooking);
    const initialStatusEnforcer = vi.fn(async () => recoveredBooking);

    await expect(
      runBookingCreateLegacyCapacityCreate({
        ...baseArgs,
        capacityCreator: capacityCreator as BookingCreateCapacityCreator,
        initialStatusEnforcer: initialStatusEnforcer as BookingCreateInitialStatusEnforcer,
        missingRecordResolver: missingRecordResolver as BookingCreateMissingRecordResolver,
      }),
    ).resolves.toEqual({
      kind: 'created',
      booking: recoveredBooking,
      reusedExisting: false,
    });

    expect(missingRecordResolver).toHaveBeenCalledWith({
      client,
      resolveArgs: expect.objectContaining({
        restaurantId: 'restaurant-1',
        source: 'api.bookings',
        recovery: {
          restaurantId: 'restaurant-1',
          idempotencyKey: 'idem-1',
          customerId: 'customer-1',
          bookingDate: '2026-07-01',
          startTime: '19:00',
          endTime: '20:30',
        },
      }),
    });
  });

  it('returns a guarded capacity unavailable response when missing booking recovery fails', async () => {
    const capacityCreator = vi.fn(async () => ({
      success: true,
      duplicate: false,
      booking: undefined,
    }));
    const missingRecordResolver = vi.fn(async () => null);
    const initialStatusEnforcer = vi.fn(async () => pendingBooking);

    const result = await runBookingCreateLegacyCapacityCreate({
      ...baseArgs,
      capacityCreator: capacityCreator as BookingCreateCapacityCreator,
      initialStatusEnforcer: initialStatusEnforcer as BookingCreateInitialStatusEnforcer,
      missingRecordResolver: missingRecordResolver as BookingCreateMissingRecordResolver,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;

    expect(result.response.status).toBe(503);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Booking could not be confirmed safely. Please try again.',
      code: 'CAPACITY_UNAVAILABLE',
      details: null,
    });
    expect(initialStatusEnforcer).not.toHaveBeenCalled();
  });

  it('returns capacity unavailable responses for unavailable capacity enforcement', async () => {
    const capacityCreator = vi.fn(async () => ({
      success: false,
      error: 'CAPACITY_UNAVAILABLE',
      message: 'Capacity service offline',
      details: { service: 'capacity' },
    }));

    const result = await runBookingCreateLegacyCapacityCreate({
      ...baseArgs,
      capacityCreator: capacityCreator as BookingCreateCapacityCreator,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;

    expect(result.response.status).toBe(503);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Capacity service offline',
      code: 'CAPACITY_UNAVAILABLE',
      details: { service: 'capacity' },
    });
  });

  it('returns retryable capacity conflict responses with alternatives', async () => {
    const capacityCreator = vi.fn(async () => ({
      success: false,
      error: 'BOOKING_CONFLICT',
      message: null,
      details: { servicePeriod: 'Dinner' },
    }));
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '20:15', available: true, utilizationPercent: 65 },
    ]);

    const result = await runBookingCreateLegacyCapacityCreate({
      ...baseArgs,
      capacityCreator: capacityCreator as BookingCreateCapacityCreator,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;

    expect(result.response.status).toBe(409);
    expect(result.response.headers.get('Retry-After')).toBe('1');
    expect(result.response.headers.get('X-Conflict-Type')).toBe('race_condition');
    await expect(result.response.json()).resolves.toEqual({
      error: 'This time slot was just booked. Please try again.',
      code: 'BOOKING_CONFLICT',
      details: { servicePeriod: 'Dinner' },
      alternatives: [{ time: '20:15', available: true, utilizationPercent: 65 }],
      retryable: true,
      retryAfter: 1,
    });
  });

  it('returns generic capacity create failure responses', async () => {
    const capacityCreator = vi.fn(async () => ({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Unable to reserve covers',
      details: { code: 'rpc_failed' },
    }));

    const result = await runBookingCreateLegacyCapacityCreate({
      ...baseArgs,
      capacityCreator: capacityCreator as BookingCreateCapacityCreator,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;

    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      error: 'Unable to reserve covers',
      code: 'INTERNAL_ERROR',
      details: { code: 'rpc_failed' },
    });
  });

  it('keeps status enforcement errors non-fatal through the injected enforcer', async () => {
    const statusError = new Error('status update failed');
    const onStatusError = vi.fn();
    const capacityCreator = vi.fn(async () => ({
      success: true,
      duplicate: false,
      booking: confirmedBooking,
    }));
    const initialStatusEnforcer = vi.fn(async (args) => {
      args.onError?.(statusError);
      return args.booking;
    });

    await expect(
      runBookingCreateLegacyCapacityCreate({
        ...baseArgs,
        capacityCreator: capacityCreator as BookingCreateCapacityCreator,
        initialStatusEnforcer: initialStatusEnforcer as BookingCreateInitialStatusEnforcer,
        onStatusError,
      }),
    ).resolves.toEqual({
      kind: 'created',
      booking: confirmedBooking,
      reusedExisting: false,
    });

    expect(onStatusError).toHaveBeenCalledWith(statusError);
  });
});
