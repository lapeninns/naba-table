import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  runBookingCreatePersistence,
  type BookingCreateLegacyCapacityRunner,
  type BookingCreatePersistenceKeyedBookingFinder,
  type BookingCreateUnifiedValidationRunner,
} from '@/server/bookings/create-persistence';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreatePrecommitContextResult } from '@/server/bookings/create-precommit-context';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';

const client = { from: vi.fn() } as never;
const restaurantId = '11111111-1111-4111-8111-111111111111';
const request = {
  restaurantId,
  date: '2026-07-01',
  time: '18:30',
  party: 4,
  bookingType: 'dinner',
  name: 'Alex Guest',
  email: 'alex@example.com',
  phone: '07123456789',
  marketingOptIn: false,
} as BookingCreateRequest;
const HEADER_KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';
const requestContext = {
  headerIdempotencyKey: HEADER_KEY,
  clientRequestId: 'client-request-1',
  opsEmailProvidedHeader: false,
  isOpsWalkIn: false,
  requestSource: 'api.bookings',
  bookingSource: 'api',
  bookingDetails: null,
} satisfies BookingCreateRequestContext;
const booking = {
  id: 'booking-1',
  status: 'pending',
  idempotency_key: HEADER_KEY,
  customer_email: request.email,
  customer_phone: request.phone,
} as BookingRecord;

function buildPrecommit(
  overrides: Partial<Extract<BookingCreatePrecommitContextResult, { kind: 'continue' }>> = {},
) {
  return {
    kind: 'continue',
    booking: undefined,
    bookingType: 'dinner',
    customer: { id: 'customer-1' },
    durationMinutes: 90,
    endTime: '20:00',
    idempotencyKey: HEADER_KEY,
    reusedExisting: false,
    createOrigin: null,
    scheduleTimezone: 'Europe/London',
    startTime: '18:30',
    ...overrides,
  } satisfies Extract<BookingCreatePrecommitContextResult, { kind: 'continue' }>;
}

const missingKeyedBooking = vi.fn(async () => null) as BookingCreatePersistenceKeyedBookingFinder;

describe('runBookingCreatePersistence', () => {
  it('reuses precommit bookings without invoking create branches', async () => {
    const unifiedValidationRunner = vi.fn() as unknown as BookingCreateUnifiedValidationRunner;
    const legacyCapacityRunner = vi.fn() as unknown as BookingCreateLegacyCapacityRunner;

    await expect(
      runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        legacyCapacityRunner,
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit({ booking, reusedExisting: true, createOrigin: 'key_replay' }),
        request,
        requestContext,
        restaurantId,
        unifiedValidationRunner,
        useUnifiedValidation: true,
      }),
    ).resolves.toEqual({
      kind: 'created',
      booking,
      customer: { id: 'customer-1' },
      idempotencyKey: HEADER_KEY,
      reusedExisting: true,
      createOrigin: 'key_replay',
    });

    expect(unifiedValidationRunner).not.toHaveBeenCalled();
    expect(legacyCapacityRunner).not.toHaveBeenCalled();
  });

  it('runs unified validation when enabled and returns created bookings', async () => {
    const unifiedValidationRunner = vi.fn(async () => ({
      kind: 'created',
      booking,
      reusedExisting: false,
    })) as BookingCreateUnifiedValidationRunner;

    await expect(
      runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit(),
        request,
        requestContext,
        restaurantId,
        unifiedValidationRunner,
        useUnifiedValidation: true,
      }),
    ).resolves.toEqual({
      kind: 'created',
      booking,
      customer: { id: 'customer-1' },
      idempotencyKey: HEADER_KEY,
      reusedExisting: false,
      createOrigin: 'inserted',
    });

    expect(unifiedValidationRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        request,
        customer: { id: 'customer-1' },
        restaurantId,
        bookingType: 'dinner',
        startTime: '18:30',
        endTime: '20:00',
        durationMinutes: 90,
        scheduleTimezone: 'Europe/London',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        bookingSource: 'api',
        idempotencyKey: HEADER_KEY,
        clientRequestId: 'client-request-1',
        bookingDetails: null,
      }),
    );
  });

  it('classifies an RPC duplicate carrying the header key as a key replay', async () => {
    const unifiedValidationRunner = vi.fn(async () => ({
      kind: 'created',
      booking,
      reusedExisting: true,
    })) as BookingCreateUnifiedValidationRunner;

    await expect(
      runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit(),
        request,
        requestContext,
        restaurantId,
        unifiedValidationRunner,
        useUnifiedValidation: true,
      }),
    ).resolves.toMatchObject({ reusedExisting: true, createOrigin: 'key_replay' });
  });

  it('classifies an RPC duplicate found by the deterministic key as recovered', async () => {
    const unifiedValidationRunner = vi.fn(async () => ({
      kind: 'created',
      booking: { ...booking, idempotency_key: 'deterministic-idem' },
      reusedExisting: true,
    })) as BookingCreateUnifiedValidationRunner;

    await expect(
      runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit({ idempotencyKey: 'deterministic-idem' }),
        request,
        requestContext: { ...requestContext, headerIdempotencyKey: null },
        restaurantId,
        unifiedValidationRunner,
        useUnifiedValidation: true,
      }),
    ).resolves.toMatchObject({ reusedExisting: true, createOrigin: 'recovered' });
  });

  it('returns unified validation responses directly', async () => {
    const unifiedValidationRunner = vi.fn(async () => ({
      kind: 'response',
      response: NextResponse.json(
        { ok: false, issues: [{ code: 'OUTSIDE_HOURS' }] },
        { status: 400, headers: { 'X-Booking-Validation': 'unified' } },
      ),
    })) as BookingCreateUnifiedValidationRunner;

    const result = await runBookingCreatePersistence({
      client,
      clientIp: '192.0.2.10',
      keyedBookingFinder: missingKeyedBooking,
      pastTimeBlocking: true,
      pastTimeGraceMinutes: 5,
      precommit: buildPrecommit(),
      request,
      requestContext,
      restaurantId,
      unifiedValidationRunner,
      useUnifiedValidation: true,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') {
      return;
    }

    await expect(result.response.json()).resolves.toEqual({
      ok: false,
      issues: [{ code: 'OUTSIDE_HOURS' }],
    });
    expect(result.response.status).toBe(400);
    expect(result.response.headers.get('X-Booking-Validation')).toBe('unified');
  });

  it('runs legacy capacity creation when unified validation is disabled', async () => {
    const legacyCapacityRunner = vi.fn(async () => ({
      kind: 'created',
      booking,
      reusedExisting: false,
      recovered: false,
    })) as BookingCreateLegacyCapacityRunner;

    await expect(
      runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        legacyCapacityRunner,
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit(),
        request,
        requestContext,
        restaurantId,
        useUnifiedValidation: false,
      }),
    ).resolves.toEqual({
      kind: 'created',
      booking,
      customer: { id: 'customer-1' },
      idempotencyKey: HEADER_KEY,
      reusedExisting: false,
      createOrigin: 'inserted',
    });

    expect(legacyCapacityRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        request,
        customer: { id: 'customer-1' },
        restaurantId,
        bookingType: 'dinner',
        startTime: '18:30',
        endTime: '20:00',
        durationMinutes: 90,
        bookingSource: 'api',
        idempotencyKey: HEADER_KEY,
        clientRequestId: 'client-request-1',
        bookingDetails: null,
        clientIp: '192.0.2.10',
        requestSource: 'api.bookings',
      }),
    );
  });

  it('marks legacy missing-record recoveries as recovered', async () => {
    const legacyCapacityRunner = vi.fn(async () => ({
      kind: 'created',
      booking: { ...booking, idempotency_key: 'other-key' },
      reusedExisting: false,
      recovered: true,
    })) as BookingCreateLegacyCapacityRunner;

    await expect(
      runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        legacyCapacityRunner,
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit(),
        request,
        requestContext,
        restaurantId,
        useUnifiedValidation: false,
      }),
    ).resolves.toMatchObject({ createOrigin: 'recovered' });
  });

  it('returns legacy capacity responses directly', async () => {
    const response = NextResponse.json({ error: 'No capacity' }, { status: 409 });
    const legacyCapacityRunner = vi.fn(async () => ({
      kind: 'response',
      response,
    })) as BookingCreateLegacyCapacityRunner;

    await expect(
      runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        keyedBookingFinder: missingKeyedBooking,
        legacyCapacityRunner,
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit(),
        request,
        requestContext,
        restaurantId,
        useUnifiedValidation: false,
      }),
    ).resolves.toEqual({
      kind: 'response',
      response,
    });
  });

  describe('server-derived key marker', () => {
    it('marks the details of a key-less request as a derived key', async () => {
      const unifiedValidationRunner = vi.fn(async () => ({
        kind: 'created',
        booking: { ...booking, idempotency_key: 'deterministic-idem' },
        reusedExisting: false,
      })) as BookingCreateUnifiedValidationRunner;

      await runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit({ idempotencyKey: 'deterministic-idem' }),
        request,
        requestContext: {
          ...requestContext,
          headerIdempotencyKey: null,
          bookingDetails: { channel: 'web' },
        },
        restaurantId,
        unifiedValidationRunner,
        useUnifiedValidation: true,
      });

      expect(unifiedValidationRunner).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'deterministic-idem',
          bookingDetails: { channel: 'web', idempotency_key_kind: 'derived' },
        }),
      );
    });

    it('leaves the details of a client-keyed request untouched', async () => {
      const legacyCapacityRunner = vi.fn(async () => ({
        kind: 'created',
        booking,
        reusedExisting: false,
        recovered: false,
      })) as BookingCreateLegacyCapacityRunner;

      await runBookingCreatePersistence({
        client,
        clientIp: '192.0.2.10',
        legacyCapacityRunner,
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit: buildPrecommit(),
        request,
        requestContext: { ...requestContext, bookingDetails: { channel: 'web' } },
        restaurantId,
        useUnifiedValidation: false,
      });

      expect(legacyCapacityRunner).toHaveBeenCalledWith(
        expect.objectContaining({ bookingDetails: { channel: 'web' } }),
      );
    });
  });

  describe('same-key retry that loses the race to its own first attempt', () => {
    const committed = {
      ...booking,
      id: 'booking-first-attempt',
      restaurant_id: restaurantId,
      customer_id: 'customer-1',
      booking_date: request.date,
      start_time: '18:30:00',
      party_size: request.party,
      idempotency_key: HEADER_KEY,
    } as BookingRecord;
    const capacityFailure = () =>
      NextResponse.json({ code: 'CAPACITY_EXCEEDED', error: 'Full' }, { status: 409 });

    it.each([true, false])(
      'answers a capacity failure as a key replay when the key now holds a matching booking (unified: %s)',
      async (useUnifiedValidation) => {
        const failure = { kind: 'response', response: capacityFailure() } as const;
        const unifiedValidationRunner = vi.fn(
          async () => failure,
        ) as unknown as BookingCreateUnifiedValidationRunner;
        const legacyCapacityRunner = vi.fn(
          async () => failure,
        ) as unknown as BookingCreateLegacyCapacityRunner;
        const keyedBookingFinder = vi.fn(async () => committed);

        await expect(
          runBookingCreatePersistence({
            client,
            clientIp: '192.0.2.10',
            keyedBookingFinder,
            legacyCapacityRunner,
            pastTimeBlocking: true,
            pastTimeGraceMinutes: 5,
            precommit: buildPrecommit(),
            request,
            requestContext,
            restaurantId,
            unifiedValidationRunner,
            useUnifiedValidation,
          }),
        ).resolves.toEqual({
          kind: 'created',
          booking: committed,
          customer: { id: 'customer-1' },
          idempotencyKey: HEADER_KEY,
          reusedExisting: true,
          createOrigin: 'key_replay',
        });
        expect(keyedBookingFinder).toHaveBeenCalledWith(client, {
          restaurantId,
          idempotencyKey: HEADER_KEY,
        });
      },
    );

    it('keeps the failure when the keyed booking has a different payload', async () => {
      const failure = { kind: 'response', response: capacityFailure() } as const;
      const unifiedValidationRunner = vi.fn(
        async () => failure,
      ) as unknown as BookingCreateUnifiedValidationRunner;

      await expect(
        runBookingCreatePersistence({
          client,
          clientIp: '192.0.2.10',
          keyedBookingFinder: vi.fn(async () => ({ ...committed, party_size: 2 }) as BookingRecord),
          pastTimeBlocking: true,
          pastTimeGraceMinutes: 5,
          precommit: buildPrecommit(),
          request,
          requestContext,
          restaurantId,
          unifiedValidationRunner,
          useUnifiedValidation: true,
        }),
      ).resolves.toBe(failure);
    });

    it('does not look a key up for key-less requests', async () => {
      const failure = { kind: 'response', response: capacityFailure() } as const;
      const keyedBookingFinder = vi.fn(async () => committed);

      await expect(
        runBookingCreatePersistence({
          client,
          clientIp: '192.0.2.10',
          keyedBookingFinder,
          pastTimeBlocking: true,
          pastTimeGraceMinutes: 5,
          precommit: buildPrecommit({ idempotencyKey: 'deterministic-idem' }),
          request,
          requestContext: { ...requestContext, headerIdempotencyKey: null },
          restaurantId,
          unifiedValidationRunner: vi.fn(
            async () => failure,
          ) as unknown as BookingCreateUnifiedValidationRunner,
          useUnifiedValidation: true,
        }),
      ).resolves.toBe(failure);
      expect(keyedBookingFinder).not.toHaveBeenCalled();
    });
  });
});
