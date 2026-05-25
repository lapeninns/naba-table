import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  runBookingCreatePrecommitContext,
  type BookingCreateCustomerContextResolver,
  type BookingCreateDurationResolver,
  type BookingCreateEndTimeDeriver,
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
const requestContext = {
  headerIdempotencyKey: 'header-idem-1',
  clientRequestId: 'client-request-1',
  opsEmailProvidedHeader: false,
  isOpsWalkIn: false,
  requestSource: 'api.bookings',
  bookingSource: 'api',
  bookingDetails: null,
} satisfies BookingCreateRequestContext;
const recoveredBooking = {
  id: 'booking-1',
  customer_email: request.email,
  customer_phone: request.phone,
  status: 'pending',
} as BookingRecord;

function buildContinueDeps(
  overrides: Partial<{
    capacityPrechecker: BookingCreatePrecommitCapacityPrechecker;
    customerContextResolver: BookingCreateCustomerContextResolver;
    durationResolver: BookingCreateDurationResolver;
    endTimeDeriver: BookingCreateEndTimeDeriver;
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
      idempotencyKey: 'header-idem-1',
    })) as BookingCreateCustomerContextResolver,
    recoveredRecordResolver: vi.fn(async () => null) as BookingCreateRecoveredRecordResolver,
    capacityPrechecker: vi.fn(async () => ({
      kind: 'continue',
    })) as BookingCreatePrecommitCapacityPrechecker,
    ...overrides,
  };
}

describe('runBookingCreatePrecommitContext', () => {
  it('builds the precommit context in the existing route order', async () => {
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
      idempotencyKey: 'header-idem-1',
      reusedExisting: false,
      scheduleTimezone: 'Europe/London',
      startTime: '18:45',
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
        headerIdempotencyKey: 'header-idem-1',
      }),
    );
    expect(deps.recoveredRecordResolver).toHaveBeenCalledWith(client, {
      restaurantId,
      idempotencyKey: 'header-idem-1',
      customerId: 'customer-1',
      bookingDate: '2026-07-01',
      startTime: '18:45',
      endTime: '20:15',
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

  it('returns recovered bookings and skips capacity precheck', async () => {
    const deps = buildContinueDeps({
      recoveredRecordResolver: vi.fn(
        async () => recoveredBooking,
      ) as BookingCreateRecoveredRecordResolver,
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
    });

    expect(deps.capacityPrechecker).not.toHaveBeenCalled();
  });

  it('short-circuits capacity precheck responses', async () => {
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
  });
});
