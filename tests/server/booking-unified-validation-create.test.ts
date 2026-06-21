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

    await expect(
      runBookingCreateUnifiedValidation({
        ...baseArgs,
        validationServiceFactory: buildValidationServiceFactory(createWithEnforcement),
      }),
    ).resolves.toEqual({
      kind: 'response',
      body: {
        ok: false,
        issues: [
          {
            code: 'CAPACITY_EXCEEDED',
            message: 'No capacity available',
            detail: { utilizationPercent: 95 },
          },
        ],
        alternatives: [{ time: '18:45', available: true, utilizationPercent: 75 }],
      },
      init: {
        status: 409,
        headers: {
          'X-Capacity-Exceeded': 'true',
          'X-Booking-Validation': 'unified',
          'X-Utilization-Percent': '95',
        },
      },
    });
  });

  it('returns unified validation responses for non-capacity validation failures', async () => {
    const createWithEnforcement = vi.fn(async () => {
      throw new BookingValidationError({
        ok: false,
        issues: [{ code: 'OUTSIDE_HOURS', message: 'Outside hours' }],
      });
    });

    await expect(
      runBookingCreateUnifiedValidation({
        ...baseArgs,
        validationServiceFactory: buildValidationServiceFactory(createWithEnforcement),
      }),
    ).resolves.toEqual({
      kind: 'response',
      body: {
        ok: false,
        issues: [{ code: 'OUTSIDE_HOURS', message: 'Outside hours' }],
      },
      init: {
        status: 400,
        headers: {
          'X-Booking-Validation': 'unified',
        },
      },
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
