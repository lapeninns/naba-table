import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  security: {} as { sessionRecoveryAccessTokenSecret?: string },
}));
const enqueueEmailJobMock = vi.hoisted(() => vi.fn());
const policyState = vi.hoisted(() => ({
  bookingPastTimeBlocking: false,
  bookingValidationUnified: false,
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

vi.mock('@/server/runtime-policy', () => ({
  getBookingPastTimeGraceMinutes: vi.fn(() => 5),
  getInlineAutoAssignTimeoutMs: vi.fn(() => 4_000),
  isAutoAssignOnBookingEnabled: vi.fn(() => false),
  isBookingPastTimeBlockingEnabled: vi.fn(() => policyState.bookingPastTimeBlocking),
  isGuestLookupPolicyEnabled: vi.fn(() => false),
  isUnifiedBookingValidationEnabled: vi.fn(() => policyState.bookingValidationUnified),
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

vi.mock('@/server/customers', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@/server/customers')>();
  return {
    ...actual,
    normalizeEmail: vi.fn((value: string) => value.trim().toLowerCase()),
    upsertCustomer: upsertCustomerMock,
  };
});

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCreatedSideEffects: enqueueBookingCreatedSideEffectsMock,
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/queue/email', () => ({
  enqueueEmailJob: enqueueEmailJobMock,
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
    policyState.bookingPastTimeBlocking = false;
    policyState.bookingValidationUnified = false;

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
    enqueueEmailJobMock.mockReset();
    enqueueEmailJobMock.mockResolvedValue(undefined);
    envMock.security = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses the removed contact-query lookup with 410 and runs no query', async () => {
    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/bookings?email=alex@example.com&phone=%2B447700900123&restaurantId=11111111-1111-4111-8111-111111111111',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toMatchObject({ code: 'CONTACT_LOOKUP_REMOVED' });
    expect(body.error).toBe(body.message);
    expect(JSON.stringify(body)).not.toContain('alex@example.com');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchBookingsForContactMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
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
    policyState.bookingPastTimeBlocking = true;
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
    // A full slot is rejected before the customer row is written.
    expect(upsertCustomerMock).not.toHaveBeenCalled();
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
    policyState.bookingValidationUnified = true;
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

    envMock.security = { sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret' };
    // The matched booking is still upcoming, so the lost-link email is worth sending.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-01T10:05:00.000Z'));
    const response = await POST(buildRequest());
    const body = await response.json();

    // A booking matched by the derived key is not the requester's to hold: no DTO, no cookie.
    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: 'BOOKING_NOT_COMPLETED', retryable: false });
    expect(body.booking).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('NB123456');
    expect(response.headers.getSetCookie().some((c) => c.includes('nt_bk.'))).toBe(false);
    expect(enqueueEmailJobMock).toHaveBeenCalledWith(
      { bookingId: 'booking-1', restaurantId: recoveredBooking.restaurant_id, type: 'manage_link' },
      { jobId: expect.stringMatching(/^manage_link:booking-1:\d+$/) },
    );
    expect(recoverBuilder.eq).toHaveBeenCalledWith('restaurant_id', recoveredBooking.restaurant_id);
    expect(recoverBuilder.eq).toHaveBeenCalledWith('customer_id', 'cust-1');
    expect(recoverBuilder.eq).toHaveBeenCalledWith('idempotency_key', expect.any(String));
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
    // A replay re-ensures the idempotent side effects (S2b), flagged as a replay.
    expect(enqueueBookingCreatedSideEffectsMock).toHaveBeenCalledTimes(1);
    expect(enqueueBookingCreatedSideEffectsMock).toHaveBeenCalledWith(
      expect.objectContaining({ replay: true }),
      expect.anything(),
    );
  });

  describe('Idempotency-Key replays', () => {
    const IDEMPOTENCY_KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const storedBooking = {
      id: '7d3c1a52-9e0b-4f6e-8a41-2b5c9d0e7f13',
      restaurant_id: '11111111-1111-4111-8111-111111111111',
      customer_id: 'cust-1',
      booking_date: '2026-07-01',
      start_time: '19:00:00',
      end_time: '20:30:00',
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
      client_request_id: IDEMPOTENCY_KEY,
      idempotency_key: IDEMPOTENCY_KEY,
      pending_ref: null,
      confirmation_token: 'confirm-token',
      confirmation_token_expires_at: '2026-07-01T12:00:00.000Z',
      created_at: '2026-07-01T10:00:00.000Z',
      updated_at: '2026-07-01T10:00:00.000Z',
    };

    // Replays land inside the 15-minute creator window of storedBooking.created_at.
    const REPLAY_NOW = new Date('2026-07-01T10:05:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(REPLAY_NOW);
      envMock.security = { sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret' };
    });

    function creatorCookies(response: Response): string[] {
      return response.headers
        .getSetCookie()
        .filter((cookie) => cookie.startsWith(`__Host-nt_bk.${storedBooking.id}=`));
    }

    function keyedRequest(overrides: Record<string, unknown> = {}) {
      const request = buildRequest(overrides);
      request.headers.set('Idempotency-Key', IDEMPOTENCY_KEY);
      return request;
    }

    function availableSlot() {
      checkSlotAvailabilityMock.mockResolvedValue({
        available: true,
        metadata: { servicePeriod: 'Dinner', maxCovers: 20, bookedCovers: 0 },
      });
    }

    it('replays the same key with the same body and status as the original, writing no booking', async () => {
      availableSlot();
      createBookingWithCapacityCheckMock.mockResolvedValueOnce({
        success: true,
        duplicate: false,
        booking: storedBooking,
      });
      const original = await POST(keyedRequest());
      const originalBody = await original.json();
      expect(original.status).toBe(201);
      expect(createBookingWithCapacityCheckMock).toHaveBeenCalledTimes(1);
      expect(createBookingWithCapacityCheckMock).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: IDEMPOTENCY_KEY,
          details: expect.objectContaining({ initial_status: 'pending' }),
        }),
      );
      expect(updateBookingRecordMock).not.toHaveBeenCalled();
      expect(creatorCookies(original)).toHaveLength(1);

      upsertCustomerMock.mockClear();
      enqueueBookingCreatedSideEffectsMock.mockClear();
      const keyBuilder = createQueryBuilder();
      keyBuilder.maybeSingle.mockResolvedValueOnce({ data: storedBooking, error: null });
      fromMock.mockReturnValueOnce(keyBuilder);

      const replay = await POST(keyedRequest());

      expect(replay.status).toBe(original.status);
      await expect(replay.json()).resolves.toEqual(originalBody);
      expect(keyBuilder.eq).toHaveBeenCalledWith('idempotency_key', IDEMPOTENCY_KEY);
      expect(keyBuilder.eq).not.toHaveBeenCalledWith('customer_id', expect.anything());
      // No booking or customer write on the replay...
      expect(createBookingWithCapacityCheckMock).toHaveBeenCalledTimes(1);
      expect(upsertCustomerMock).not.toHaveBeenCalled();
      expect(insertBookingRecordMock).not.toHaveBeenCalled();
      expect(updateBookingRecordMock).not.toHaveBeenCalled();
      // ...but the idempotent side effects are re-ensured (S2b), flagged as a replay.
      expect(enqueueBookingCreatedSideEffectsMock).toHaveBeenCalledTimes(1);
      expect(enqueueBookingCreatedSideEffectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ replay: true }),
        expect.anything(),
      );
      // The creator keeps (or regains) the booking cookie.
      expect(creatorCookies(replay)).toHaveLength(1);
    });

    it('refuses the same key replayed after the 15-minute window: 409, no cookie, no DTO', async () => {
      vi.setSystemTime(new Date('2026-07-01T10:16:00.000Z'));
      const keyBuilder = createQueryBuilder();
      keyBuilder.maybeSingle.mockResolvedValueOnce({ data: storedBooking, error: null });
      fromMock.mockReturnValueOnce(keyBuilder);

      const replay = await POST(keyedRequest());
      const body = await replay.json();

      expect(replay.status).toBe(409);
      expect(body).toMatchObject({ code: 'BOOKING_NOT_COMPLETED' });
      expect(body.booking).toBeUndefined();
      expect(creatorCookies(replay)).toHaveLength(0);
      expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
    });

    it('answers a lost race (RPC duplicate for our key) exactly like the original insert', async () => {
      availableSlot();
      createBookingWithCapacityCheckMock.mockResolvedValueOnce({
        success: true,
        duplicate: true,
        booking: storedBooking,
      });

      const response = await POST(keyedRequest());
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.duplicate).toBe(false);
      expect(body.booking.reference).toBe('NB654321');
      expect(creatorCookies(response)).toHaveLength(1);
      // The winner's insert already dispatched; ours only re-ensures, flagged as a replay.
      expect(enqueueBookingCreatedSideEffectsMock).toHaveBeenCalledTimes(1);
      expect(enqueueBookingCreatedSideEffectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ replay: true }),
        expect.anything(),
      );
    });

    it('refuses a derived (non-uuid) key sent as the header, even inside the window', async () => {
      const derivedKey = 'a'.repeat(32);
      const keyBuilder = createQueryBuilder();
      keyBuilder.maybeSingle.mockResolvedValueOnce({
        data: { ...storedBooking, idempotency_key: derivedKey, client_request_id: null },
        error: null,
      });
      fromMock.mockReturnValueOnce(keyBuilder);
      const request = buildRequest();
      request.headers.set('Idempotency-Key', derivedKey);

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({ code: 'BOOKING_NOT_COMPLETED' });
      expect(body.booking).toBeUndefined();
      expect(creatorCookies(response)).toHaveLength(0);
    });

    it('rejects the same key with a different party size as 409 IDEMPOTENCY_KEY_REUSED', async () => {
      const keyBuilder = createQueryBuilder();
      keyBuilder.maybeSingle.mockResolvedValueOnce({ data: storedBooking, error: null });
      fromMock.mockReturnValueOnce(keyBuilder);

      const response = await POST(keyedRequest({ party: 6 }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', retryable: false });
      expect(body.error).toBe(body.message);
      expect(JSON.stringify(body)).not.toContain('NB654321');
      expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
      expect(upsertCustomerMock).not.toHaveBeenCalled();
    });

    it('maps the RPC IDEMPOTENCY_KEY_REUSED result (concurrent different payload) to 409', async () => {
      availableSlot();
      createBookingWithCapacityCheckMock.mockResolvedValueOnce({
        success: false,
        duplicate: false,
        error: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This request key was already used for a different booking.',
        details: { idempotencyConflict: true },
        retryable: false,
      });

      const response = await POST(keyedRequest());
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(enqueueBookingCreatedSideEffectsMock).not.toHaveBeenCalled();
    });

    it('never records the raw key in observability events', async () => {
      availableSlot();
      createBookingWithCapacityCheckMock.mockResolvedValueOnce({
        success: true,
        duplicate: false,
        booking: null,
      });

      await POST(keyedRequest());

      expect(recordObservabilityEventMock).toHaveBeenCalled();
      expect(JSON.stringify(recordObservabilityEventMock.mock.calls)).not.toContain(
        IDEMPOTENCY_KEY,
      );
    });
  });

  describe('key-less create, cancel, rebook the same slot', () => {
    type Row = Record<string, unknown>;

    function bookingRow(overrides: Row): Row {
      return {
        restaurant_id: '11111111-1111-4111-8111-111111111111',
        customer_id: 'cust-1',
        booking_date: '2026-07-01',
        start_time: '19:00:00',
        end_time: '20:30:00',
        start_at: null,
        end_at: null,
        party_size: 4,
        booking_type: 'dinner',
        seating_preference: 'any',
        status: 'pending',
        customer_name: 'Alex Guest',
        customer_email: 'alex@example.com',
        customer_phone: '+447700900123',
        notes: null,
        marketing_opt_in: true,
        client_request_id: '11111111-1111-4111-8111-333333333333',
        pending_ref: null,
        confirmation_token: null,
        confirmation_token_expires_at: null,
        created_at: '2026-07-01T10:00:00.000Z',
        updated_at: '2026-07-01T10:00:00.000Z',
        ...overrides,
      };
    }

    /** PostgREST-shaped reads over an in-memory bookings table (eq, not in, order, limit). */
    function bookingsTable(rows: Row[]) {
      return () => {
        const filters: Array<(row: Row) => boolean> = [];
        let limitCount: number | null = null;
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn((column: string, value: unknown) => {
            filters.push(
              (row) =>
                String(row[column] ?? '').slice(0, String(value).length) === String(value) &&
                row[column] !== null,
            );
            return builder;
          }),
          not: vi.fn((column: string, operator: string, value: string) => {
            const excluded = value.replace(/[()]/g, '').split(',');
            filters.push((row) => !(operator === 'in' && excluded.includes(String(row[column]))));
            return builder;
          }),
          order: vi.fn(() => builder),
          limit: vi.fn((count: number) => {
            limitCount = count;
            return builder;
          }),
          maybeSingle: vi.fn(async () => {
            let matched = rows.filter((row) => filters.every((filter) => filter(row)));
            if (limitCount !== null) matched = matched.slice(0, limitCount);
            if (matched.length > 1) return { data: null, error: new Error('multiple rows') };
            return { data: matched[0] ?? null, error: null };
          }),
        };
        return builder;
      };
    }

    /** Mirrors the RPC contract proven in tests/db/booking-create-idempotency.sql. */
    function rpcOver(rows: Row[]) {
      let sequence = 0;
      return async (params: {
        restaurantId: string;
        customerId: string;
        bookingDate: string;
        startTime: string;
        endTime: string;
        partySize: number;
        idempotencyKey: string | null;
        details?: Record<string, unknown> | null;
      }) => {
        const derived = params.details?.idempotency_key_kind === 'derived';
        const existing = rows.find(
          (row) =>
            row.restaurant_id === params.restaurantId &&
            params.idempotencyKey !== null &&
            row.idempotency_key === params.idempotencyKey,
        );
        if (existing) {
          if (!(derived && ['cancelled', 'no_show'].includes(String(existing.status)))) {
            return existing.party_size === params.partySize
              ? { success: true, duplicate: true, booking: existing }
              : {
                  success: false,
                  duplicate: false,
                  error: 'IDEMPOTENCY_KEY_REUSED',
                  details: { idempotencyConflict: true },
                  retryable: false,
                };
          }
          existing.idempotency_key = null;
        }
        sequence += 1;
        const inserted = bookingRow({
          id: `booking-rebook-${sequence}`,
          reference: `NBREB${sequence}`,
          party_size: params.partySize,
          idempotency_key: params.idempotencyKey,
        });
        rows.push(inserted);
        return { success: true, duplicate: false, booking: inserted };
      };
    }

    beforeEach(() => {
      checkSlotAvailabilityMock.mockResolvedValue({
        available: true,
        metadata: { servicePeriod: 'Dinner', maxCovers: 20, bookedCovers: 0 },
      });
    });

    it.each([
      ['the same party size', 4],
      ['a different party size', 2],
    ])('inserts a NEW booking (201) after a cancel, with %s', async (_label, rebookParty) => {
      const rows: Row[] = [];
      const table = bookingsTable(rows);
      fromMock.mockImplementation((name: string) =>
        name === 'bookings' ? table() : createQueryBuilder(),
      );
      createBookingWithCapacityCheckMock.mockImplementation(rpcOver(rows));

      const first = await POST(buildRequest());
      const firstBody = await first.json();
      expect(first.status).toBe(201);
      const firstCall = createBookingWithCapacityCheckMock.mock.calls[0]?.[0];
      expect(firstCall.details).toMatchObject({ idempotency_key_kind: 'derived' });
      expect(firstCall.idempotencyKey).toMatch(/^[0-9a-f]{32}$/);

      const firstRow = rows.find((row) => row.id === firstBody.booking.id);
      expect(firstRow).toBeDefined();
      if (firstRow) firstRow.status = 'cancelled';

      const rebook = await POST(buildRequest({ party: rebookParty }));
      const rebookBody = await rebook.json();

      expect(rebook.status).toBe(201);
      expect(rebookBody.duplicate).toBe(false);
      expect(rebookBody.code).toBeUndefined();
      expect(rebookBody.booking.id).not.toBe(firstBody.booking.id);
      expect(rebookBody.booking.party_size).toBe(rebookParty);
      expect(createBookingWithCapacityCheckMock).toHaveBeenCalledTimes(2);
      expect(rows.filter((row) => row.status !== 'cancelled')).toHaveLength(1);
    });

    it('still matches the live booking for a key-less double submit (no second insert)', async () => {
      const rows: Row[] = [];
      const table = bookingsTable(rows);
      fromMock.mockImplementation((name: string) =>
        name === 'bookings' ? table() : createQueryBuilder(),
      );
      createBookingWithCapacityCheckMock.mockImplementation(rpcOver(rows));

      const first = await POST(buildRequest());
      const firstBody = await first.json();
      const second = await POST(buildRequest());
      const secondBody = await second.json();

      // The derived-key match is not proof of being the creator: neutral 409, no DTO.
      expect(first.status).toBe(201);
      expect(firstBody.booking.id).toEqual(expect.any(String));
      expect(second.status).toBe(409);
      expect(secondBody).toMatchObject({ code: 'BOOKING_NOT_COMPLETED' });
      expect(secondBody.booking).toBeUndefined();
      expect(createBookingWithCapacityCheckMock).toHaveBeenCalledTimes(1);
      expect(rows).toHaveLength(1);
    });
  });
});
