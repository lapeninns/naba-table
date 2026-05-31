import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  featureFlags: {
    bookingPastTimeBlocking: false,
    bookingPastTimeGraceMinutes: 5,
    bookingValidationUnified: false,
    autoAssignOnBooking: false,
    inlineAutoAssignTimeoutMs: 4000,
    guestLookupPolicy: false,
  },
  security: {},
}));

const maybeSingleMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const getActiveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getDefaultRestaurantIdMock = vi.hoisted(() => vi.fn());
const getRestaurantBySlugMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const resolveBookingDurationMinutesMock = vi.hoisted(() => vi.fn());
const checkSlotAvailabilityMock = vi.hoisted(() => vi.fn());
const findAlternativeSlotsMock = vi.hoisted(() => vi.fn());
const createBookingWithCapacityCheckMock = vi.hoisted(() => vi.fn());
const upsertCustomerMock = vi.hoisted(() => vi.fn());
const fetchBookingsForContactMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const insertBookingRecordMock = vi.hoisted(() => vi.fn());
const generateUniqueBookingReferenceMock = vi.hoisted(() => vi.fn());
const enqueueBookingCreatedSideEffectsMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const extractClientIpMock = vi.hoisted(() => vi.fn());
const createBookingValidationServiceMock = vi.hoisted(() => vi.fn());
const mapValidationFailureMock = vi.hoisted(() => vi.fn());
const assertBookingNotInPastMock = vi.hoisted(() => vi.fn());

const BookingValidationErrorMock = vi.hoisted(
  () =>
    class BookingValidationError extends Error {
      response: Record<string, unknown>;

      constructor(response: Record<string, unknown>) {
        super('Booking validation failed');
        this.response = response;
      }
    },
);

function createQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    maybeSingle: maybeSingleMock,
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
  };

  return builder;
}

vi.mock('@/lib/env', () => ({
  env: envMock,
}));

vi.mock('@/server/supabase', () => ({
  getDefaultRestaurantId: getDefaultRestaurantIdMock,
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn() },
  })),
  getServiceSupabaseClient: vi.fn(() => ({
    from: fromMock,
  })),
  getTenantServiceSupabaseClient: vi.fn(() => ({ kind: 'tenant-client' })),
  MissingRestaurantContextError: class MissingRestaurantContextError extends Error {},
}));

vi.mock('@/server/restaurants/getActiveRestaurantId', () => ({
  getActiveRestaurantId: getActiveRestaurantIdMock,
}));

vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: getRestaurantBySlugMock,
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: getRestaurantScheduleMock,
}));

vi.mock('@/server/bookings/duration', () => ({
  resolveBookingDurationMinutes: resolveBookingDurationMinutesMock,
}));

vi.mock('@/server/bookings/pastTimeValidation', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@/server/bookings/pastTimeValidation')>();
  return {
    ...actual,
    assertBookingNotInPast: assertBookingNotInPastMock,
  };
});

vi.mock('@/server/capacity', () => ({
  checkSlotAvailability: checkSlotAvailabilityMock,
  findAlternativeSlots: findAlternativeSlotsMock,
  createBookingWithCapacityCheck: createBookingWithCapacityCheckMock,
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: vi.fn((value: string) => value.trim().toLowerCase()),
  upsertCustomer: upsertCustomerMock,
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCreatedSideEffects: enqueueBookingCreatedSideEffectsMock,
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/security/request', () => ({
  anonymizeIp: vi.fn(() => '127.0.0.0/24'),
  extractClientIp: extractClientIpMock,
}));

vi.mock('@/server/security/guest-lookup', () => ({
  computeGuestLookupHash: vi.fn(() => 'lookup-hash'),
}));

vi.mock('@/server/security/session-recovery-access-token', () => ({
  validateSessionRecoveryAccessToken: vi.fn(),
}));

vi.mock('@/server/booking', () => ({
  createBookingValidationService: createBookingValidationServiceMock,
  BookingValidationError: BookingValidationErrorMock,
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: mapValidationFailureMock,
  withValidationHeaders: vi.fn((response) => response),
}));

vi.mock('@/server/bookings/confirmation-token', () => ({
  generateConfirmationToken: vi.fn(() => 'confirm-token'),
  computeTokenExpiry: vi.fn(() => new Date('2026-04-14T12:00:00.000Z').toISOString()),
  getStoredBookingConfirmationTokenState: vi.fn((booking) => ({
    confirmationToken: booking.confirmation_token ?? null,
    confirmationTokenExpiresAt:
      typeof booking.confirmation_token_expires_at === 'string'
        ? booking.confirmation_token_expires_at
        : null,
  })),
  buildBookingConfirmationTokenAttachment: vi.fn(
    ({
      bookingId,
      confirmationToken,
      confirmationTokenExpiresAt,
    }: {
      bookingId: string;
      confirmationToken: string | null;
      confirmationTokenExpiresAt: string | null;
    }) =>
      confirmationToken && confirmationTokenExpiresAt
        ? null
        : {
            bookingId,
            confirmationToken: confirmationToken ?? 'confirm-token',
            confirmationTokenExpiresAt:
              confirmationTokenExpiresAt ?? new Date('2026-04-14T12:00:00.000Z').toISOString(),
          },
  ),
  attachTokenToBooking: vi.fn(async () => undefined),
  resolveBookingCreateConfirmationToken: vi.fn(async ({ booking }) => {
    return booking.confirmation_token ?? 'confirm-token';
  }),
}));

vi.mock('@reserve/shared/validation', () => ({
  CUSTOMER_PHONE_LENGTH_MAX: 20,
  CUSTOMER_PHONE_LENGTH_MIN: 10,
  isUKPhone: vi.fn(() => true),
}));

vi.mock('@/server/bookings', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@/server/bookings')>();
  return {
    ...actual,
    fetchBookingsForContact: fetchBookingsForContactMock,
    buildBookingAuditSnapshot: vi.fn(() => ({})),
    updateBookingRecord: updateBookingRecordMock,
    inferMealTypeFromTime: vi.fn(() => 'dinner'),
    logAuditEvent: logAuditEventMock,
    insertBookingRecord: insertBookingRecordMock,
    generateUniqueBookingReference: generateUniqueBookingReferenceMock,
  };
});

import { PastBookingError } from '@/server/bookings/pastTimeValidation';
import { GET, POST } from '@/src/app/api/bookings/route';

function buildSchedule() {
  return {
    date: '2026-07-01',
    timezone: 'Europe/London',
    isClosed: false,
    window: {
      opensAt: '17:00',
      closesAt: '22:00',
    },
    slots: [
      {
        value: '19:00',
        display: '7:00 PM',
        periodId: 'period-1',
        periodName: 'Dinner',
        bookingOption: 'dinner',
        defaultBookingOption: 'dinner',
        availability: {
          services: { lunch: 'disabled', dinner: 'enabled' },
          labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
        },
        disabled: false,
      },
    ],
  };
}

function buildRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest('https://www.nabatable.com/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      restaurantId: '11111111-1111-4111-8111-111111111111',
      date: '2026-07-01',
      time: '19:00',
      party: 4,
      bookingType: 'dinner',
      notes: 'Window seat please',
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '+447700900123',
      marketingOptIn: true,
      ...overrides,
    }),
  });
}

describe('public POST /api/bookings capacity handling', () => {
  beforeEach(() => {
    envMock.featureFlags.bookingValidationUnified = false;

    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    fromMock.mockReset();
    fromMock.mockImplementation(() => createQueryBuilder());
    getActiveRestaurantIdMock.mockReset();
    getActiveRestaurantIdMock.mockResolvedValue('11111111-1111-4111-8111-111111111111');
    getDefaultRestaurantIdMock.mockReset();
    getRestaurantBySlugMock.mockReset();
    getRestaurantScheduleMock.mockReset();
    getRestaurantScheduleMock.mockResolvedValue(buildSchedule());
    resolveBookingDurationMinutesMock.mockReset();
    resolveBookingDurationMinutesMock.mockResolvedValue({ durationMinutes: 90 });
    checkSlotAvailabilityMock.mockReset();
    findAlternativeSlotsMock.mockReset();
    createBookingWithCapacityCheckMock.mockReset();
    upsertCustomerMock.mockReset();
    upsertCustomerMock.mockResolvedValue({ id: 'cust-1' });
    fetchBookingsForContactMock.mockReset();
    fetchBookingsForContactMock.mockResolvedValue([]);
    updateBookingRecordMock.mockReset();
    updateBookingRecordMock.mockResolvedValue(undefined);
    logAuditEventMock.mockReset();
    logAuditEventMock.mockResolvedValue(undefined);
    insertBookingRecordMock.mockReset();
    generateUniqueBookingReferenceMock.mockReset();
    enqueueBookingCreatedSideEffectsMock.mockReset();
    enqueueBookingCreatedSideEffectsMock.mockResolvedValue(undefined);
    recordObservabilityEventMock.mockReset();
    consumeRateLimitMock.mockReset();
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    extractClientIpMock.mockReset();
    extractClientIpMock.mockReturnValue('127.0.0.1');
    createBookingValidationServiceMock.mockReset();
    mapValidationFailureMock.mockReset();
    assertBookingNotInPastMock.mockReset();
  });

  it('returns contact-query access diagnostics for public guest lookup', async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: true,
      limit: 20,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    fetchBookingsForContactMock.mockResolvedValueOnce([
      {
        id: 'booking-1',
        restaurant_id: '11111111-1111-4111-8111-111111111111',
        booking_date: '2026-07-01',
        start_time: '19:00',
        end_time: '20:30',
        reference: 'NB123456',
        party_size: 4,
        booking_type: 'dinner',
        seating_preference: 'any',
        status: 'confirmed',
        customer_name: 'Alex Guest',
        customer_email: 'alex@example.com',
        customer_phone: '+447700900123',
      },
    ]);

    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/bookings?email=alex@example.com&phone=%2B447700900123&restaurantId=11111111-1111-4111-8111-111111111111',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      bookings: [
        expect.objectContaining({
          id: '',
          restaurant_id: '',
          start_time: '',
          reference: null,
          customer_name: 'A***',
          customer_email: 'a***@e***.com',
          customer_phone: '***0123',
        }),
      ],
      access: {
        mode: 'contact_query',
        token: {
          provided: false,
          valid: false,
          reason: null,
          restaurantId: null,
        },
        restaurantId: '11111111-1111-4111-8111-111111111111',
        restaurantSource: 'query',
        lookupStrategy: 'legacy',
        policyEnabled: false,
        rateSource: 'memory',
      },
    });
    expect(fetchBookingsForContactMock).toHaveBeenCalledWith(
      { kind: 'tenant-client' },
      '11111111-1111-4111-8111-111111111111',
      'alex@example.com',
      '+447700900123',
    );
  });

  it('returns booking-create rate limit response and records observability', async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      limit: 60,
      remaining: 0,
      resetAt: 1_779_541_200_000,
      source: 'memory',
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(response.headers.get('Retry-After')).toEqual(expect.any(String));
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking_creation.rate_limited',
      severity: 'warning',
      context: {
        restaurant_id: '11111111-1111-4111-8111-111111111111',
        ip_scope: '127.0.0.0/24',
        reset_at: '2026-05-23T13:00:00.000Z',
        limit: 60,
        window_ms: 60_000,
        rate_source: 'memory',
      },
    });
    expect(upsertCustomerMock).not.toHaveBeenCalled();
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
  });

  it('returns past-time block response and records observability', async () => {
    envMock.featureFlags.bookingPastTimeBlocking = true;
    const details = {
      bookingTime: '2026-05-23T12:00:00 GMT+1',
      serverTime: '2026-05-23T13:00:00 GMT+1',
      timezone: 'Europe/London',
      gracePeriodMinutes: 5,
      timeDeltaMinutes: -60,
    };
    assertBookingNotInPastMock.mockImplementationOnce(() => {
      throw new PastBookingError('Booking time is in the past.', details);
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      error: 'Booking time is in the past.',
      code: 'BOOKING_IN_PAST',
      details,
    });
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.past_time.blocked',
      severity: 'warning',
      context: {
        restaurantId: '11111111-1111-4111-8111-111111111111',
        endpoint: 'bookings.create',
        actorRole: null,
        ipScope: '127.0.0.0/24',
        ...details,
      },
    });
    expect(upsertCustomerMock).not.toHaveBeenCalled();
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
  });

  it('continues booking creation after capacity precheck failure and records observability', async () => {
    const precheckError = new Error('Capacity precheck unavailable');
    const createdBooking = {
      id: 'booking-created',
      restaurant_id: '11111111-1111-4111-8111-111111111111',
      customer_id: 'cust-1',
      booking_date: '2026-07-01',
      start_time: '19:00',
      end_time: '20:30',
      start_at: null,
      end_at: null,
      reference: 'NB654321',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'any',
      status: 'pending',
      customer_name: 'Alex Guest',
      customer_email: 'alex@example.com',
      customer_phone: '+447700900123',
      notes: null,
      marketing_opt_in: true,
      client_request_id: null,
      idempotency_key: 'created-key',
      pending_ref: null,
      confirmation_token: null,
      confirmation_token_expires_at: null,
      created_at: '2026-07-01T10:00:00.000Z',
      updated_at: '2026-07-01T10:00:00.000Z',
    };
    checkSlotAvailabilityMock.mockRejectedValueOnce(precheckError);
    createBookingWithCapacityCheckMock.mockResolvedValueOnce({
      success: true,
      duplicate: false,
      booking: createdBooking,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.booking.id).toBe('booking-created');
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.capacity_precheck.failed',
      severity: 'warning',
      context: {
        restaurantId: '11111111-1111-4111-8111-111111111111',
        date: '2026-07-01',
        time: '19:00',
        partySize: 4,
        error: expect.stringContaining('Capacity precheck unavailable'),
      },
    });
    expect(createBookingWithCapacityCheckMock).toHaveBeenCalledOnce();
  });

  it('rejects online public bookings above the server-side party cap', async () => {
    const response = await POST(buildRequest({ party: 13 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(upsertCustomerMock).not.toHaveBeenCalled();
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
  });

  it('returns 409 with alternatives before createBookingWithCapacityCheck when the pre-check fails', async () => {
    checkSlotAvailabilityMock.mockResolvedValue({
      available: false,
      reason: 'No capacity available for this time slot.',
      metadata: {
        servicePeriod: 'Dinner',
        maxCovers: 20,
        bookedCovers: 20,
        availableCovers: 0,
        utilizationPercent: 100,
        maxParties: 10,
        bookedParties: 10,
        availableParties: 0,
      },
    });
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '18:30', available: true, utilizationPercent: 80 },
      { time: '20:00', available: true, utilizationPercent: 70 },
    ]);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('CAPACITY_EXCEEDED');
    expect(body.alternatives).toEqual([
      { time: '18:30', available: true, utilizationPercent: 80 },
      { time: '20:00', available: true, utilizationPercent: 70 },
    ]);
    expect(upsertCustomerMock).toHaveBeenCalledOnce();
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
    expect(fetchBookingsForContactMock).not.toHaveBeenCalled();
  });

  it('returns 409 with retry guidance and alternatives when the atomic create hits BOOKING_CONFLICT', async () => {
    checkSlotAvailabilityMock.mockResolvedValue({
      available: true,
      metadata: {
        servicePeriod: 'Dinner',
        maxCovers: 20,
        bookedCovers: 12,
        availableCovers: 8,
        utilizationPercent: 60,
        maxParties: 10,
        bookedParties: 4,
        availableParties: 6,
      },
    });
    createBookingWithCapacityCheckMock.mockResolvedValue({
      success: false,
      error: 'BOOKING_CONFLICT',
      message: 'This time slot was just booked. Please try again.',
      details: {
        servicePeriod: 'Dinner',
      },
    });
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '20:15', available: true, utilizationPercent: 65 },
    ]);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(response.headers.get('Retry-After')).toBe('1');
    expect(body.code).toBe('BOOKING_CONFLICT');
    expect(body.retryable).toBe(true);
    expect(body.alternatives).toEqual([{ time: '20:15', available: true, utilizationPercent: 65 }]);
  });

  it('fails closed when the capacity create succeeds but no booking can be recovered', async () => {
    checkSlotAvailabilityMock.mockResolvedValue({
      available: true,
      metadata: {
        servicePeriod: 'Dinner',
        maxCovers: 20,
        bookedCovers: 12,
        availableCovers: 8,
        utilizationPercent: 60,
        maxParties: 10,
        bookedParties: 4,
        availableParties: 6,
      },
    });
    createBookingWithCapacityCheckMock.mockResolvedValue({
      success: true,
      duplicate: false,
      booking: null,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe('CAPACITY_UNAVAILABLE');
    expect(insertBookingRecordMock).not.toHaveBeenCalled();
    expect(generateUniqueBookingReferenceMock).not.toHaveBeenCalled();
    expect(enqueueBookingCreatedSideEffectsMock).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'booking.create.recovery_failed',
        severity: 'error',
      }),
    );
  });

  it('adds alternatives to unified validation capacity failures', async () => {
    envMock.featureFlags.bookingValidationUnified = true;
    checkSlotAvailabilityMock.mockResolvedValue({
      available: true,
      metadata: {
        servicePeriod: 'Dinner',
        maxCovers: 20,
        bookedCovers: 12,
        availableCovers: 8,
        utilizationPercent: 60,
        maxParties: 10,
        bookedParties: 4,
        availableParties: 6,
      },
    });
    createBookingValidationServiceMock.mockReturnValue({
      createWithEnforcement: vi.fn(async () => {
        throw new BookingValidationErrorMock({
          ok: false,
          issues: [
            {
              code: 'CAPACITY_EXCEEDED',
              message: 'No capacity available for the requested time.',
              detail: {
                utilizationPercent: 95,
              },
            },
          ],
        });
      }),
    });
    mapValidationFailureMock.mockReturnValue({
      status: 409,
      body: {
        ok: false,
        issues: [
          {
            code: 'CAPACITY_EXCEEDED',
            message: 'No capacity available for the requested time.',
          },
        ],
      },
    });
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '18:45', available: true, utilizationPercent: 75 },
    ]);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(response.headers.get('X-Capacity-Exceeded')).toBe('true');
    expect(body.alternatives).toEqual([{ time: '18:45', available: true, utilizationPercent: 75 }]);
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
  });

  it('does not continue booking creation when strict public customer identity conflicts', async () => {
    checkSlotAvailabilityMock.mockResolvedValue({
      available: true,
      metadata: {
        servicePeriod: 'Dinner',
        maxCovers: 20,
        bookedCovers: 12,
        availableCovers: 8,
        utilizationPercent: 60,
        maxParties: 10,
        bookedParties: 4,
        availableParties: 6,
      },
    });
    upsertCustomerMock.mockRejectedValueOnce({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "customers_restaurant_id_email_normalized_key"',
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('DUPLICATE_RESOURCE');
    expect(upsertCustomerMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        restaurantId: '11111111-1111-4111-8111-111111111111',
        email: 'alex@example.com',
        phone: '+447700900123',
        identityMatchMode: 'strict',
        allowExistingUpdates: false,
      }),
    );
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
    expect(enqueueBookingCreatedSideEffectsMock).not.toHaveBeenCalled();
  });

  it('scopes public idempotency recovery to the resolved customer id', async () => {
    const recoveredBooking = {
      id: 'booking-1',
      restaurant_id: '11111111-1111-4111-8111-111111111111',
      customer_id: 'cust-1',
      booking_date: '2026-07-01',
      start_time: '19:00',
      end_time: '20:30',
      start_at: null,
      end_at: null,
      reference: 'NB123456',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'any',
      status: 'pending',
      customer_name: 'Alex Guest',
      customer_email: 'alex@example.com',
      customer_phone: '+447700900123',
      notes: null,
      marketing_opt_in: true,
      client_request_id: '11111111-1111-4111-8111-222222222222',
      idempotency_key: 'existing-key',
      pending_ref: null,
      confirmation_token: null,
      confirmation_token_expires_at: null,
      created_at: '2026-07-01T10:00:00.000Z',
      updated_at: '2026-07-01T10:00:00.000Z',
    };
    const recoverBuilder = createQueryBuilder();
    recoverBuilder.maybeSingle.mockResolvedValueOnce({ data: recoveredBooking, error: null });
    fromMock.mockReturnValueOnce(recoverBuilder);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.booking.id).toBe('booking-1');
    expect(recoverBuilder.eq).toHaveBeenCalledWith('restaurant_id', recoveredBooking.restaurant_id);
    expect(recoverBuilder.eq).toHaveBeenCalledWith('customer_id', 'cust-1');
    expect(recoverBuilder.eq).toHaveBeenCalledWith('idempotency_key', expect.any(String));
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
    expect(enqueueBookingCreatedSideEffectsMock).not.toHaveBeenCalled();
  });
});
