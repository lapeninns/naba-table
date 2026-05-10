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
  attachTokenToBooking: vi.fn(async () => undefined),
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

import { POST } from '@/src/app/api/bookings/route';

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

function buildRequest() {
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
    expect(body.alternatives).toEqual([
      { time: '20:15', available: true, utilizationPercent: 65 },
    ]);
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
    expect(body.alternatives).toEqual([
      { time: '18:45', available: true, utilizationPercent: 75 },
    ]);
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
  });
});
