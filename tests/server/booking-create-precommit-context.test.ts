import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  runBookingCreatePrecommitContext,
  type BookingCreateCustomerContextResolver,
  type BookingCreateDurationResolver,
  type BookingCreateEndTimeDeriver,
  type BookingCreateKeyedBookingFinder,
  type BookingCreatePrecommitCapacityPrechecker,
  type BookingCreateRecoveredRecordResolver,
  type BookingCreateScheduleGateRunner,
} from '@/server/bookings/create-precommit-context';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';

const client = { from: vi.fn() } as never;
const restaurantId = '11111111-1111-4111-8111-111111111111';
const customer = { id: 'customer-1' };
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
const recoveredBooking = {
  id: 'booking-1',
  customer_id: 'customer-1',
  customer_email: request.email,
  customer_phone: request.phone,
  booking_date: '2026-07-01',
  start_time: '18:45:00',
  party_size: 4,
  idempotency_key: 'deterministic-idem-1',
  status: 'pending',
} as BookingRecord;
const keyedBooking = {
  ...recoveredBooking,
  id: 'booking-keyed',
  idempotency_key: HEADER_KEY,
} as BookingRecord;

function buildContinueDeps(
  overrides: Partial<{
    capacityPrechecker: BookingCreatePrecommitCapacityPrechecker;
    customerContextResolver: BookingCreateCustomerContextResolver;
    durationResolver: BookingCreateDurationResolver;
    endTimeDeriver: BookingCreateEndTimeDeriver;
    keyedBookingFinder: BookingCreateKeyedBookingFinder;
    recoveredRecordResolver: BookingCreateRecoveredRecordResolver;
    scheduleGateRunner: BookingCreateScheduleGateRunner;
  }> = {},
) {
  return {
    scheduleGateRunner: vi.fn(async () => ({
      kind: 'continue',
      startTime: '18:45',
      bookingType: 'dinner',
      scheduleTimezone: 'Europe/London',
    })) as BookingCreateScheduleGateRunner,
    durationResolver: vi.fn(async () => ({
      bookingOption: 'dinner',
      durationMinutes: 90,
    })) as BookingCreateDurationResolver,
    endTimeDeriver: vi.fn(() => '20:15') as BookingCreateEndTimeDeriver,
    customerContextResolver: vi.fn(async () => ({
      customer,
      deterministicIdempotencyKey: 'deterministic-idem-1',
      idempotencyKey: HEADER_KEY,
    })) as BookingCreateCustomerContextResolver,
    keyedBookingFinder: vi.fn(async () => null) as BookingCreateKeyedBookingFinder,
    recoveredRecordResolver: vi.fn(async () => null) as BookingCreateRecoveredRecordResolver,
    capacityPrechecker: vi.fn(async () => ({
      kind: 'continue',
    })) as BookingCreatePrecommitCapacityPrechecker,
    ...overrides,
  };
}

describe('runBookingCreatePrecommitContext', () => {
  it('checks the key and capacity before writing the customer', async () => {
    const deps = buildContinueDeps();

    await expect(
      runBookingCreatePrecommitContext({
        ...deps,
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        request,
        requestContext,
        restaurantId,
      }),
    ).resolves.toEqual({
      kind: 'continue',
      booking: undefined,
      bookingType: 'dinner',
      customer,
      durationMinutes: 90,
      endTime: '20:15',
      idempotencyKey: HEADER_KEY,
      reusedExisting: false,
      createOrigin: null,
      scheduleTimezone: 'Europe/London',
      startTime: '18:45',
    });

    const keyOrder = vi.mocked(deps.keyedBookingFinder).mock.invocationCallOrder[0]!;
    const precheckOrder = vi.mocked(deps.capacityPrechecker).mock.invocationCallOrder[0]!;
    const customerOrder = vi.mocked(deps.customerContextResolver).mock.invocationCallOrder[0]!;
    const recoveryOrder = vi.mocked(deps.recoveredRecordResolver).mock.invocationCallOrder[0]!;
    expect(keyOrder).toBeLessThan(precheckOrder);
    expect(precheckOrder).toBeLessThan(customerOrder);
    expect(customerOrder).toBeLessThan(recoveryOrder);
    expect(deps.keyedBookingFinder).toHaveBeenCalledWith(client, {
      restaurantId,
      idempotencyKey: HEADER_KEY,
    });

    expect(deps.scheduleGateRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId,
        date: '2026-07-01',
        requestedTime: '18:30',
        fallbackBookingType: 'dinner',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        requestSource: 'api.bookings',
        clientIp: '192.0.2.10',
      }),
    );
    expect(deps.durationResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: '18:45',
        bookingOption: 'dinner',
        timezone: 'Europe/London',
      }),
    );
    expect(deps.endTimeDeriver).toHaveBeenCalledWith('18:45', 90);
    expect(deps.customerContextResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingDate: '2026-07-01',
        startTime: '18:45',
        endTime: '20:15',
        headerIdempotencyKey: HEADER_KEY,
      }),
    );
    // The header key was already looked up per restaurant; recovery only tries the signature.
    expect(deps.recoveredRecordResolver).toHaveBeenCalledWith(client, {
      restaurantId,
      idempotencyKey: null,
      customerId: 'customer-1',
      bookingDate: '2026-07-01',
      startTime: '18:45',
      endTime: '20:15',
      partySize: 4,
    });
    expect(deps.capacityPrechecker).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId,
        date: '2026-07-01',
        startTime: '18:45',
        partySize: 4,
        durationMinutes: 90,
        bookingOption: 'dinner',
        requestSource: 'api.bookings',
        clientIp: '192.0.2.10',
      }),
    );
  });

  it('short-circuits schedule-gate responses as NextResponse instances', async () => {
    const deps = buildContinueDeps({
      scheduleGateRunner: vi.fn(async () => ({
        kind: 'response',
        body: { error: 'Closed' },
        init: { status: 400 },
      })) as BookingCreateScheduleGateRunner,
    });

    const result = await runBookingCreatePrecommitContext({
      ...deps,
      client,
      clientIp: '192.0.2.10',
      pastTimeBlocking: true,
      request,
      requestContext,
      restaurantId,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') {
      return;
    }

    await expect(result.response.json()).resolves.toEqual({ error: 'Closed' });
    expect(result.response.status).toBe(400);
    expect(deps.durationResolver).not.toHaveBeenCalled();
  });

  it('replays the booking created with the same key and skips precheck and customer writes', async () => {
    const deps = buildContinueDeps({
      keyedBookingFinder: vi.fn(async () => keyedBooking) as BookingCreateKeyedBookingFinder,
    });

    await expect(
      runBookingCreatePrecommitContext({
        ...deps,
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        request,
        requestContext,
        restaurantId,
      }),
    ).resolves.toMatchObject({
      kind: 'continue',
      booking: keyedBooking,
      customer: { id: 'customer-1' },
      idempotencyKey: HEADER_KEY,
      reusedExisting: true,
      createOrigin: 'key_replay',
    });

    expect(deps.capacityPrechecker).not.toHaveBeenCalled();
    expect(deps.customerContextResolver).not.toHaveBeenCalled();
    expect(deps.recoveredRecordResolver).not.toHaveBeenCalled();
  });

  it('replays a same-key retry before the schedule gate, even when the gate would now refuse', async () => {
    const committed = { ...keyedBooking, start_time: '18:30:00' } as BookingRecord;
    const deps = buildContinueDeps({
      keyedBookingFinder: vi.fn(async () => committed) as BookingCreateKeyedBookingFinder,
      scheduleGateRunner: vi.fn(async () => ({
        kind: 'response',
        body: { error: 'That time has passed.' },
        init: { status: 422 },
      })) as BookingCreateScheduleGateRunner,
    });

    await expect(
      runBookingCreatePrecommitContext({
        ...deps,
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        request,
        requestContext,
        restaurantId,
      }),
    ).resolves.toMatchObject({
      kind: 'continue',
      booking: committed,
      idempotencyKey: HEADER_KEY,
      reusedExisting: true,
      createOrigin: 'key_replay',
    });

    expect(deps.scheduleGateRunner).not.toHaveBeenCalled();
    expect(deps.keyedBookingFinder).toHaveBeenCalledTimes(1);
    expect(deps.capacityPrechecker).not.toHaveBeenCalled();
    expect(deps.customerContextResolver).not.toHaveBeenCalled();
  });

  it('still runs the gate for a keyed booking that does not match the requested time exactly', async () => {
    const deps = buildContinueDeps({
      keyedBookingFinder: vi.fn(async () => keyedBooking) as BookingCreateKeyedBookingFinder,
    });

    await runBookingCreatePrecommitContext({
      ...deps,
      client,
      clientIp: '192.0.2.10',
      pastTimeBlocking: true,
      request,
      requestContext,
      restaurantId,
    });

    expect(deps.scheduleGateRunner).toHaveBeenCalledTimes(1);
    // The pre-gate lookup is reused by the post-gate check, not repeated.
    expect(deps.keyedBookingFinder).toHaveBeenCalledTimes(1);
  });

  it('rejects the same key with a different party size as 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const deps = buildContinueDeps({
      keyedBookingFinder: vi.fn(async () => ({
        ...keyedBooking,
        party_size: 2,
      })) as BookingCreateKeyedBookingFinder,
    });

    const result = await runBookingCreatePrecommitContext({
      ...deps,
      client,
      clientIp: '192.0.2.10',
      pastTimeBlocking: true,
      request,
      requestContext,
      restaurantId,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') return;
    expect(result.response.status).toBe(409);
    const body = (await result.response.json()) as Record<string, unknown>;
    expect(body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(JSON.stringify(body)).not.toContain('booking-keyed');
    expect(deps.customerContextResolver).not.toHaveBeenCalled();
  });

  it('marks signature matches as recovered, not as the creator replay', async () => {
    const deps = buildContinueDeps({
      recoveredRecordResolver: vi.fn(async () => ({
        booking: recoveredBooking,
        method: 'signature' as const,
      })) as BookingCreateRecoveredRecordResolver,
    });

    await expect(
      runBookingCreatePrecommitContext({
        ...deps,
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        request,
        requestContext,
        restaurantId,
      }),
    ).resolves.toMatchObject({
      kind: 'continue',
      booking: recoveredBooking,
      reusedExisting: true,
      createOrigin: 'recovered',
    });
  });

  it('uses the deterministic key for recovery when the client sent no key', async () => {
    const deps = buildContinueDeps({
      customerContextResolver: vi.fn(async () => ({
        customer,
        deterministicIdempotencyKey: 'deterministic-idem-1',
        idempotencyKey: 'deterministic-idem-1',
      })) as BookingCreateCustomerContextResolver,
      recoveredRecordResolver: vi.fn(async () => ({
        booking: recoveredBooking,
        method: 'idempotency_key' as const,
      })) as BookingCreateRecoveredRecordResolver,
    });

    await expect(
      runBookingCreatePrecommitContext({
        ...deps,
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        request,
        requestContext: { ...requestContext, headerIdempotencyKey: null },
        restaurantId,
      }),
    ).resolves.toMatchObject({
      booking: recoveredBooking,
      idempotencyKey: 'deterministic-idem-1',
      createOrigin: 'recovered',
    });
    expect(deps.keyedBookingFinder).not.toHaveBeenCalled();
    expect(deps.recoveredRecordResolver).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ idempotencyKey: 'deterministic-idem-1' }),
    );
  });

  it('short-circuits capacity precheck responses before any customer write', async () => {
    const response = NextResponse.json({ error: 'No capacity' }, { status: 409 });
    const deps = buildContinueDeps({
      capacityPrechecker: vi.fn(async () => ({
        kind: 'response',
        response,
      })) as BookingCreatePrecommitCapacityPrechecker,
    });

    await expect(
      runBookingCreatePrecommitContext({
        ...deps,
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        request,
        requestContext,
        restaurantId,
      }),
    ).resolves.toEqual({
      kind: 'response',
      response,
    });
    expect(deps.customerContextResolver).not.toHaveBeenCalled();
  });

  it('answers a full-slot precheck as a key replay when its own first attempt just committed', async () => {
    const response = NextResponse.json({ error: 'No capacity' }, { status: 409 });
    const keyedBookingFinder = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(keyedBooking) as unknown as BookingCreateKeyedBookingFinder;
    const deps = buildContinueDeps({
      keyedBookingFinder,
      capacityPrechecker: vi.fn(async () => ({
        kind: 'response',
        response,
      })) as BookingCreatePrecommitCapacityPrechecker,
    });

    await expect(
      runBookingCreatePrecommitContext({
        ...deps,
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        request,
        requestContext,
        restaurantId,
      }),
    ).resolves.toMatchObject({
      kind: 'continue',
      booking: keyedBooking,
      reusedExisting: true,
      createOrigin: 'key_replay',
    });
    expect(keyedBookingFinder).toHaveBeenCalledTimes(2);
    expect(deps.customerContextResolver).not.toHaveBeenCalled();
  });

  it('keeps the precheck failure for key-less requests without a second lookup', async () => {
    const response = NextResponse.json({ error: 'No capacity' }, { status: 409 });
    const deps = buildContinueDeps({
      capacityPrechecker: vi.fn(async () => ({
        kind: 'response',
        response,
      })) as BookingCreatePrecommitCapacityPrechecker,
    });

    await expect(
      runBookingCreatePrecommitContext({
        ...deps,
        client,
        clientIp: '192.0.2.10',
        pastTimeBlocking: true,
        request,
        requestContext: { ...requestContext, headerIdempotencyKey: null },
        restaurantId,
      }),
    ).resolves.toEqual({ kind: 'response', response });
    expect(deps.keyedBookingFinder).not.toHaveBeenCalled();
  });
});
