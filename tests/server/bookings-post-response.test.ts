import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  buildBookingCreateInvalidJsonResponse,
  buildBookingsPostHttpResponse,
} from '@/server/bookings/bookings-post-response';

import type {
  BookingsPostCompletionRunner,
  BookingsPostEntryGateRunner,
  BookingsPostFailureResponseBuilder,
  BookingsPostPersistenceRunner,
  BookingsPostPrecommitRunner,
} from '@/server/bookings/bookings-post-response';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';

const restaurantId = '11111111-1111-4111-8111-111111111111';
const validPayload = {
  restaurantId,
  date: '2026-07-01',
  time: '18:30',
  party: 4,
  bookingType: 'dinner',
  name: 'Alex Guest',
  email: 'alex@example.com',
  phone: '07123456789',
  marketingOptIn: false,
};
const requestContext = {
  headerIdempotencyKey: 'idem-header',
  clientRequestId: 'client-request',
  opsEmailProvidedHeader: false,
  isOpsWalkIn: false,
  requestSource: 'api.bookings',
  bookingSource: 'online',
  bookingDetails: null,
} satisfies BookingCreateRequestContext;

function baseArgs(overrides: Partial<Parameters<typeof buildBookingsPostHttpResponse>[0]> = {}) {
  return {
    autoAssignEnabled: true,
    bookingPastTimeBlocking: true,
    bookingPastTimeGraceMinutes: 5,
    bookingValidationUnified: true,
    clientIp: '203.0.113.10',
    headers: new Headers(),
    inlineAutoAssignTimeoutMs: 3000,
    payload: validPayload,
    recoverySecret: 'recovery-secret',
    recoveryTtlSeconds: 900,
    serviceClientFor: vi.fn(() => ({ from: vi.fn() }) as never),
    ...overrides,
  };
}

describe('bookings POST response orchestration', () => {
  it('builds the invalid JSON response used by the route adapter', async () => {
    const response = buildBookingCreateInvalidJsonResponse();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid JSON payload',
      code: 'INVALID_JSON',
      message: 'Invalid JSON payload',
    });
  });

  it('returns validation failures before running create gates', async () => {
    const entryGateRunner = vi.fn() as unknown as BookingsPostEntryGateRunner;

    const response = await buildBookingsPostHttpResponse(
      baseArgs({
        entryGateRunner,
        payload: { ...validPayload, email: 'not-an-email' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(entryGateRunner).not.toHaveBeenCalled();
  });

  it('short-circuits when the entry gate returns a response', async () => {
    const entryGateRunner = vi.fn(async () => ({
      kind: 'response',
      response: NextResponse.json({ error: 'Rate limited' }, { status: 429 }),
    })) as unknown as BookingsPostEntryGateRunner;
    const serviceClientFor = vi.fn();

    const response = await buildBookingsPostHttpResponse(
      baseArgs({
        entryGateRunner,
        serviceClientFor,
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: 'Rate limited' });
    expect(serviceClientFor).not.toHaveBeenCalled();
  });

  it('runs precommit, persistence, and completion with shared create context', async () => {
    const client = { from: vi.fn() } as never;
    const entryGateRunner = vi.fn(async () => ({
      kind: 'continue',
      restaurantId,
      requestContext,
    })) as unknown as BookingsPostEntryGateRunner;
    const precommit = {
      kind: 'continue',
      booking: undefined,
      bookingType: 'dinner',
      customer: { id: 'customer-1' },
      durationMinutes: 90,
      endTime: '20:00',
      idempotencyKey: 'idem-1',
      reusedExisting: false,
      scheduleTimezone: 'Europe/London',
      startTime: '18:30',
    };
    const precommitRunner = vi.fn(async () => precommit) as unknown as BookingsPostPrecommitRunner;
    const persistence = {
      kind: 'created',
      booking: { id: 'booking-1' },
      customer: { id: 'customer-1' },
      idempotencyKey: 'idem-1',
      reusedExisting: false,
    };
    const persistenceRunner = vi.fn(
      async () => persistence,
    ) as unknown as BookingsPostPersistenceRunner;
    const completionRunner = vi.fn(async () =>
      NextResponse.json({ bookingId: 'booking-1' }, { status: 201 }),
    ) as unknown as BookingsPostCompletionRunner;
    const logger = { error: vi.fn(), warn: vi.fn() };

    const response = await buildBookingsPostHttpResponse(
      baseArgs({
        completionRunner,
        entryGateRunner,
        logger,
        persistenceRunner,
        precommitRunner,
        serviceClientFor: vi.fn(() => client),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ bookingId: 'booking-1' });
    expect(precommitRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        clientIp: '203.0.113.10',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        requestContext,
        restaurantId,
      }),
    );
    expect(persistenceRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 5,
        precommit,
        requestContext,
        restaurantId,
        useUnifiedValidation: true,
      }),
    );
    expect(completionRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        autoAssignEnabled: true,
        client,
        inlineAutoAssignTimeoutMs: 3000,
        persistence,
        requestContext,
        restaurantId,
        useUnifiedValidation: true,
      }),
    );
  });

  it('delegates post-entry failures to the booking create failure response builder', async () => {
    const error = new Error('precommit failed');
    const entryGateRunner = vi.fn(async () => ({
      kind: 'continue',
      restaurantId,
      requestContext,
    })) as unknown as BookingsPostEntryGateRunner;
    const precommitRunner = vi.fn(async () => {
      throw error;
    }) as unknown as BookingsPostPrecommitRunner;
    const failureResponseBuilder = vi.fn(() =>
      NextResponse.json({ error: 'mapped failure' }, { status: 500 }),
    ) as unknown as BookingsPostFailureResponseBuilder;

    const response = await buildBookingsPostHttpResponse(
      baseArgs({
        entryGateRunner,
        failureResponseBuilder,
        precommitRunner,
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'mapped failure' });
    expect(failureResponseBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        restaurantId,
      }),
    );
  });
});
