import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAlternativeSlotsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity', () => ({
  findAlternativeSlots: findAlternativeSlotsMock,
}));

import { BookingValidationError } from '@/server/booking';
import {
  runBookingCreateUnifiedValidation,
  type BookingCreateValidationServiceFactory,
} from '@/server/bookings/unified-validation-create';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';
import type { Json } from '@/types/supabase';

type BookingCreateValidationClient = NonNullable<
  Parameters<BookingCreateValidationServiceFactory>[0]
>['client'];

const client = { from: vi.fn() } as unknown as BookingCreateValidationClient;

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

const baseArgs = {
  client,
  request,
  customer: { id: 'customer-1' },
  restaurantId: 'restaurant-1',
  bookingType: 'dinner' as const,
  startTime: '19:00',
  endTime: '20:30',
  durationMinutes: 90,
  scheduleTimezone: 'Europe/London',
  pastTimeBlocking: true,
  pastTimeGraceMinutes: 5,
  bookingSource: 'api',
  idempotencyKey: 'idem-1',
  clientRequestId: 'request-1',
  bookingDetails: { source: 'public' } as Json,
};

function buildValidationServiceFactory(createWithEnforcement: ReturnType<typeof vi.fn>) {
  return vi.fn(() => ({
    createWithEnforcement,
  })) as unknown as BookingCreateValidationServiceFactory;
}

describe('runBookingCreateUnifiedValidation', () => {
  beforeEach(() => {
    findAlternativeSlotsMock.mockReset();
  });

  it('returns created booking decisions from successful unified commits', async () => {
    const booking = { id: 'booking-1', status: 'pending' } as BookingRecord;
    const createWithEnforcement = vi.fn(async () => ({
      booking,
      duplicate: true,
    }));
    const validationServiceFactory = buildValidationServiceFactory(createWithEnforcement);

    await expect(
      runBookingCreateUnifiedValidation({
        ...baseArgs,
        validationServiceFactory,
      }),
    ).resolves.toEqual({
      kind: 'created',
      booking,
      reusedExisting: true,
    });

    expect(validationServiceFactory).toHaveBeenCalledWith({ client });
    expect(createWithEnforcement).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'restaurant-1',
        serviceId: 'dinner',
        partySize: 4,
        start: '2026-07-01T19:00:00',
        durationMinutes: 90,
        customerId: 'customer-1',
        idempotencyKey: 'idem-1',
      }),
      expect.objectContaining({
        actorId: 'request-1',
        tz: 'Europe/London',
        flags: {
          bookingPastTimeBlocking: true,
          bookingPastTimeGraceMinutes: 5,
          unified: true,
        },
      }),
    );
  });

  it('returns unified capacity responses with alternatives for capacity validation failures', async () => {
    const createWithEnforcement = vi.fn(async () => {
      throw new BookingValidationError({
        ok: false,
        issues: [
          {
            code: 'CAPACITY_EXCEEDED',
            message: 'No capacity available',
            detail: { utilizationPercent: 95 },
          },
        ],
      });
    });
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '18:45', available: true, utilizationPercent: 75 },
    ]);

    const result = await runBookingCreateUnifiedValidation({
      ...baseArgs,
      validationServiceFactory: buildValidationServiceFactory(createWithEnforcement),
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;
    expect(result.response.status).toBe(409);
    expect(result.response.headers.get('X-Capacity-Exceeded')).toBe('true');
    expect(result.response.headers.get('X-Booking-Validation')).toBe('unified');
    expect(result.response.headers.get('X-Utilization-Percent')).toBe('95');
    await expect(result.response.json()).resolves.toEqual({
      ok: false,
      issues: [
        {
          code: 'CAPACITY_EXCEEDED',
          message: 'No capacity available',
          detail: { utilizationPercent: 95 },
        },
      ],
      alternatives: [{ time: '18:45', available: true, utilizationPercent: 75 }],
      error: 'No capacity available',
      code: 'CAPACITY_EXCEEDED',
      message: 'No capacity available',
    });
  });

  it('returns unified validation responses for non-capacity validation failures', async () => {
    const createWithEnforcement = vi.fn(async () => {
      throw new BookingValidationError({
        ok: false,
        issues: [{ code: 'OUTSIDE_HOURS', message: 'Outside hours' }],
      });
    });

    const result = await runBookingCreateUnifiedValidation({
      ...baseArgs,
      validationServiceFactory: buildValidationServiceFactory(createWithEnforcement),
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;
    expect(result.response.status).toBe(400);
    expect(result.response.headers.get('X-Booking-Validation')).toBe('unified');
    await expect(result.response.json()).resolves.toEqual({
      ok: false,
      issues: [{ code: 'OUTSIDE_HOURS', message: 'Outside hours' }],
      error: 'Outside hours',
      code: 'OUTSIDE_HOURS',
      message: 'Outside hours',
    });

    expect(findAlternativeSlotsMock).not.toHaveBeenCalled();
  });

  it('maps a reused key with a different payload to 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const createWithEnforcement = vi.fn(async () => {
      throw new BookingValidationError({
        ok: false,
        issues: [
          {
            code: 'UNKNOWN',
            message: 'Unable to complete booking due to capacity constraints.',
            detail: { idempotencyConflict: true },
          },
        ],
      });
    });

    const result = await runBookingCreateUnifiedValidation({
      ...baseArgs,
      validationServiceFactory: buildValidationServiceFactory(createWithEnforcement),
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;
    expect(result.response.status).toBe(409);
    await expect(result.response.json()).resolves.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
      retryable: false,
    });
    expect(findAlternativeSlotsMock).not.toHaveBeenCalled();
  });

  it('keeps a transient create race retryable instead of reporting the slot as full', async () => {
    const createWithEnforcement = vi.fn(async () => {
      throw new BookingValidationError({
        ok: false,
        issues: [
          {
            code: 'CAPACITY_EXCEEDED',
            message: 'No capacity available for the requested time.',
            detail: { bookingConflict: true },
          },
        ],
      });
    });

    const result = await runBookingCreateUnifiedValidation({
      ...baseArgs,
      validationServiceFactory: buildValidationServiceFactory(createWithEnforcement),
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;
    expect(result.response.status).toBe(409);
    expect(result.response.headers.get('Retry-After')).toBe('1');
    await expect(result.response.json()).resolves.toMatchObject({
      code: 'BOOKING_CONFLICT',
      retryable: true,
      retryAfter: 1,
    });
    expect(findAlternativeSlotsMock).not.toHaveBeenCalled();
  });

  it('propagates unexpected validation service errors', async () => {
    const createError = new Error('validation service unavailable');
    const createWithEnforcement = vi.fn(async () => {
      throw createError;
    });

    await expect(
      runBookingCreateUnifiedValidation({
        ...baseArgs,
        validationServiceFactory: buildValidationServiceFactory(createWithEnforcement),
      }),
    ).rejects.toThrow(createError);
  });
});
