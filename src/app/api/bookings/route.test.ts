process.env.BASE_URL ??= "http://localhost:3000";

import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi, type SpyInstance } from 'vitest';

vi.mock('@/lib/env', () => {
  return {
    env: {
      get featureFlags() {
        return {
          loyaltyPilotRestaurantIds: undefined,
          enableTestApi: true,
          guestLookupPolicy: true,
          opsGuardV2: false,
          bookingPastTimeBlocking: false,
          bookingPastTimeGraceMinutes: 5,
          autoAssignOnBooking: false,
          inlineAutoAssignTimeoutMs: 4000,
          autoAssignMaxRetries: 0,
          autoAssignRetryDelaysMs: [],
          autoAssignStartCutoffMinutes: 15,
          autoAssignCreatedEmailDeferMinutes: 0,
        } as const;
      },
      get resend() {
        return {
          apiKey: "test-resend-api-key",
          from: "reservations@example.com",
        } as const;
      },
      get supabase() {
        return {
          url: 'http://localhost:54321',
          anonKey: 'test-anon-key',
          serviceKey: 'test-service-role-key',
        } as const;
      },
      get app() {
        return {
          url: 'http://localhost:3000',
          version: 'test',
          commitSha: null,
        } as const;
      },
      get misc() {
        return {
          siteUrl: 'http://localhost:3000',
          baseUrl: 'http://localhost:3000',
          openAiKey: null,
          analyzeBuild: false,
          bookingDefaultRestaurantId: null,
        } as const;
      },
      get security() {
        return {
          guestLookupPepper: null,
          sessionRecoveryAccessTokenSecret: null,
          sessionRecoveryAccessTokenTtlSeconds: 900,
        } as const;
      },
    },
  };
});

import { env } from '@/lib/env';
import { OperatingHoursError } from '@/server/bookings/timeValidation';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

import { GET, POST } from './route';


const assertBookingWithinOperatingWindowMock = vi.hoisted(() => vi.fn());
const assertBookingNotInPastMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getRestaurantBySlugMock = vi.hoisted(() => vi.fn());
const getDefaultRestaurantIdMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn(() => ({})));
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn(() => ({})));
const upsertCustomerMock = vi.hoisted(() => vi.fn());
const fetchBookingsForContactMock = vi.hoisted(() => vi.fn());
const buildBookingAuditSnapshotMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const enqueueBookingCreatedSideEffectsMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const getActiveLoyaltyProgramMock = vi.hoisted(() => vi.fn());
const calculateLoyaltyAwardMock = vi.hoisted(() => vi.fn());
const applyLoyaltyAwardMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const computeGuestLookupHashMock = vi.hoisted(() => vi.fn());
const createBookingWithCapacityCheckMock = vi.hoisted(() => vi.fn());
const attachTokenToBookingMock = vi.hoisted(() => vi.fn());
const generateConfirmationTokenMock = vi.hoisted(() => vi.fn(() => "token-123"));
const computeTokenExpiryMock = vi.hoisted(() => vi.fn(() => "2099-01-01T00:00:00.000Z"));
const attemptInlineAutoAssignMock = vi.hoisted(() => vi.fn((_client, booking) => booking));

vi.mock('@/server/bookings/timeValidation', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/bookings/timeValidation');
  return {
    ...actual,
    assertBookingWithinOperatingWindow: assertBookingWithinOperatingWindowMock,
  };
});

vi.mock('@/server/bookings/pastTimeValidation', async () => {
  const actual = await vi.importActual('@/server/bookings/pastTimeValidation');
  return {
    ...actual,
    assertBookingNotInPast: (...args: unknown[]) => assertBookingNotInPastMock(...args),
  };
});

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: (...args: unknown[]) => getRestaurantScheduleMock(...args),
}));

vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: (...args: unknown[]) => getRestaurantBySlugMock(...args),
}));

vi.mock('@/server/supabase', () => ({
  getDefaultRestaurantId: (...args: unknown[]) => getDefaultRestaurantIdMock(...args),
  getRouteHandlerSupabaseClient: (...args: unknown[]) => getRouteHandlerSupabaseClientMock(...args),
  getServiceSupabaseClient: (...args: unknown[]) => getServiceSupabaseClientMock(...args),
  getTenantServiceSupabaseClient: (...args: unknown[]) => getTenantServiceSupabaseClientMock(...args),
}));

vi.mock('@/server/customers', () => ({
  upsertCustomer: (...args: unknown[]) => upsertCustomerMock(...args),
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  normalizePhone: (phone: string) => phone.replace(/[^0-9]/g, ""),
}));

vi.mock('@/server/loyalty', () => ({
  getActiveLoyaltyProgram: (...args: unknown[]) => getActiveLoyaltyProgramMock(...args),
  calculateLoyaltyAward: (...args: unknown[]) => calculateLoyaltyAwardMock(...args),
  applyLoyaltyAward: (...args: unknown[]) => applyLoyaltyAwardMock(...args),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCreatedSideEffects: (...args: unknown[]) => enqueueBookingCreatedSideEffectsMock(...args),
  enqueueBookingUpdatedSideEffects: vi.fn(),
  enqueueBookingCancelledSideEffects: vi.fn(),
  safeBookingPayload: (payload: unknown) => payload,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: (...args: unknown[]) => recordObservabilityEventMock(...args),
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimitMock(...args),
}));

vi.mock('@/server/security/guest-lookup', () => ({
  computeGuestLookupHash: (...args: unknown[]) => computeGuestLookupHashMock(...args),
}));

vi.mock('@/server/bookings', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/bookings');
  return {
    ...actual,
    fetchBookingsForContact: (...args: unknown[]) => fetchBookingsForContactMock(...args),
    buildBookingAuditSnapshot: (...args: unknown[]) => buildBookingAuditSnapshotMock(...args),
    logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args),
    updateBookingRecord: (...args: unknown[]) => updateBookingRecordMock(...args),
  };
});

vi.mock('@/server/capacity', () => ({
  createBookingWithCapacityCheck: (...args: unknown[]) => createBookingWithCapacityCheckMock(...args),
}));

vi.mock('@/server/bookings/confirmation-token', async () => {
  const actual = await vi.importActual('@/server/bookings/confirmation-token');
  return {
    ...actual,
    attachTokenToBooking: (...args: unknown[]) => attachTokenToBookingMock(...args),
    generateConfirmationToken: (...args: unknown[]) => generateConfirmationTokenMock(...args),
    computeTokenExpiry: (...args: unknown[]) => computeTokenExpiryMock(...args),
  };
});

vi.mock('@/server/bookings/inline-auto-assign', () => ({
  attemptInlineAutoAssign: (...args: unknown[]) => attemptInlineAutoAssignMock(...args),
}));

function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function createGetRequest(search: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/bookings${search}`, {
    method: 'GET',
    headers,
  });
}

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

const DEFAULT_CAPACITY_METADATA = {
  servicePeriod: 'Dinner',
  maxCovers: 80,
  bookedCovers: 20,
  availableCovers: 60,
  utilizationPercent: 25,
  maxParties: 40,
  bookedParties: 10,
} as const;

const DEFAULT_BOOKING = {
  id: 'booking-1',
  restaurant_id: 'rest-default',
  customer_id: 'customer-1',
  booking_date: '2025-10-10',
  start_time: '19:00',
  end_time: '21:00',
  start_at: '2025-10-10T19:00:00.000Z',
  end_at: '2025-10-10T21:00:00.000Z',
  party_size: 2,
  booking_type: 'dinner',
  seating_preference: 'any',
  status: 'confirmed',
  reference: 'REF123',
  customer_name: 'Test User',
  customer_email: 'test@example.com',
  customer_phone: '1234567890',
  notes: null,
  marketing_opt_in: false,
  loyalty_points_awarded: 0,
  source: 'api',
  auth_user_id: null,
  client_request_id: 'req-1',
  idempotency_key: null,
  details: null,
  created_at: '2025-10-01T10:00:00Z',
  updated_at: '2025-10-01T10:00:00Z',
  slot: null,
} as const;

describe('/api/bookings POST', () => {
  beforeEach(() => {
    getDefaultRestaurantIdMock.mockResolvedValue('rest-default');
    getServiceSupabaseClientMock.mockReturnValue({ from: vi.fn() });
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    createBookingWithCapacityCheckMock.mockResolvedValue({
      success: true,
      duplicate: false,
      booking: DEFAULT_BOOKING,
      capacity: DEFAULT_CAPACITY_METADATA,
    });
    enqueueBookingCreatedSideEffectsMock.mockResolvedValue({ queued: false });
    updateBookingRecordMock.mockImplementation(async (_client, _id, updates) => ({
      ...DEFAULT_BOOKING,
      ...(updates ?? {}),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 429 when rate limit exceeded for booking creation', async () => {
    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    const request = createRequest(payload);
    const retryReset = Date.now() + 45_000;

    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      limit: 60,
      remaining: 0,
      resetAt: retryReset,
      source: 'redis',
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    const json = await response.json();
    expect(json.error).toBe('Too many booking requests. Please try again in a moment.');
    expect(json.code).toBe('RATE_LIMITED');
    expect(json.retryAfter).toBeGreaterThan(0);
    
    // Verify rate limit headers are present
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();

    // Verify observability event was logged
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'api.bookings',
        eventType: 'booking_creation.rate_limited',
        severity: 'warning',
      }),
    );

    // Verify booking was not created
    expect(upsertCustomerMock).not.toHaveBeenCalled();
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
  });

  it('returns 400 when selected time is outside operating hours', async () => {
    const payload = {
      date: '2025-10-10',
      time: '19:45',
      party: 2,
      bookingType: 'lunch',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    const request = createRequest(payload);

    getDefaultRestaurantIdMock.mockResolvedValue('rest-closed');

    const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 'rest-closed' }, error: null });
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    getServiceSupabaseClientMock.mockReturnValue({ from: fromMock });

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 90,
      lastSeatingBufferMinutes: 120,
      isClosed: false,
      window: { opensAt: '10:00', closesAt: '22:00' },
      availableBookingOptions: [],
      occasionCatalog: [],
      slots: [],
    });
    assertBookingWithinOperatingWindowMock.mockImplementation(() => {
      throw new OperatingHoursError('OUTSIDE_WINDOW', 'Selected time is outside operating hours.');
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Selected time is outside operating hours.');
    expect(upsertCustomerMock).not.toHaveBeenCalled();
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
  });

  it('creates a booking when validation passes', async () => {
    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    const request = createRequest(payload);

    const bookingRecord = {
      id: 'booking-1',
      restaurant_id: RESTAURANT_ID,
      customer_id: 'customer-1',
      booking_date: payload.date,
      start_time: '19:00',
      end_time: '21:00',
      start_at: null,
      end_at: null,
      reference: 'REF123',
      party_size: payload.party,
      booking_type: 'dinner',
      seating_preference: payload.seating,
      status: 'confirmed',
      customer_name: payload.name,
      customer_email: payload.email,
      customer_phone: payload.phone,
      notes: payload.notes,
      marketing_opt_in: false,
      loyalty_points_awarded: 0,
      source: 'api',
      auth_user_id: null,
      client_request_id: 'req-1',
      pending_ref: null,
      idempotency_key: null,
      details: null,
      created_at: '2025-10-01T10:00:00Z',
      updated_at: '2025-10-01T10:00:00Z',
      slot: null,
    } as const;

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 90,
      lastSeatingBufferMinutes: 120,
      isClosed: false,
      window: { opensAt: '10:00', closesAt: '22:00' },
      availableBookingOptions: ['dinner'],
      occasionCatalog: [
        {
          key: 'dinner',
          label: 'Dinner',
          shortLabel: 'Dinner',
          description: null,
          availability: [],
          defaultDurationMinutes: 120,
          displayOrder: 20,
          isActive: true,
        },
      ],
      slots: [
        {
          value: '19:00',
          display: '7:00 PM',
          periodId: null,
          periodName: 'Dinner',
          bookingOption: 'dinner',
          defaultBookingOption: 'dinner',
          availability: {
            services: { lunch: 'disabled', dinner: 'enabled', drinks: 'disabled' },
            labels: {
              happyHour: false,
              drinksOnly: false,
              kitchenClosed: false,
              lunchWindow: false,
              dinnerWindow: true,
            },
          },
          disabled: false,
        },
      ],
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    const capacityMetadata = {
      servicePeriod: 'Dinner',
      maxCovers: 80,
      bookedCovers: 10,
      availableCovers: 70,
      utilizationPercent: 12,
      maxParties: 40,
      bookedParties: 6,
    } as const;

    createBookingWithCapacityCheckMock.mockResolvedValueOnce({
      success: true,
      duplicate: false,
      booking: { ...bookingRecord, client_request_id: 'req-1' },
      capacity: capacityMetadata,
    });
    fetchBookingsForContactMock.mockResolvedValueOnce([bookingRecord]);
    buildBookingAuditSnapshotMock.mockReturnValue({ previous: null, current: null, changes: [] });

    const response = await POST(request);
    const json = await response.json();
    expect(response.status).toBe(201);
    expect(assertBookingWithinOperatingWindowMock).toHaveBeenCalledWith({
      schedule: expect.any(Object),
      requestedTime: '19:00',
      bookingType: 'dinner',
    });
    expect(createBookingWithCapacityCheckMock).toHaveBeenCalledWith(expect.objectContaining({
      restaurantId: RESTAURANT_ID,
      startTime: '19:00',
      endTime: '21:00',
      partySize: payload.party,
      customerEmail: payload.email.toLowerCase(),
      seatingPreference: payload.seating,
    }));
    expect(json.booking.reference).toBe('REF123');
    expect(json.capacity).toBeNull();
  });

  it('returns 503 when capacity service is unavailable', async () => {
    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: payload.date,
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 120,
      slots: [{ value: '19:00', disabled: false, bookingOption: 'dinner' }],
      window: { opensAt: '10:00', closesAt: '23:00' },
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    createBookingWithCapacityCheckMock.mockResolvedValueOnce({
      success: false,
      error: 'CAPACITY_UNAVAILABLE',
      message: 'Capacity enforcement unavailable',
    });

    const response = await POST(createRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.code).toBe('CAPACITY_UNAVAILABLE');
    expect(json.error).toContain('Capacity enforcement unavailable');
  });

  it('returns 409 when capacity is exceeded', async () => {
    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '19:00',
      party: 6,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: payload.date,
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 120,
      slots: [{ value: '19:00', disabled: false, bookingOption: 'dinner' }],
      window: { opensAt: '10:00', closesAt: '23:00' },
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    createBookingWithCapacityCheckMock.mockResolvedValueOnce({
      success: false,
      error: 'CAPACITY_EXCEEDED',
      message: 'No capacity available',
      details: { seats: 0 },
    });

    const response = await POST(createRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe('CAPACITY_EXCEEDED');
    expect(json.error).toContain('No capacity available');
  });

  it('uses deterministic idempotency key when header is missing', async () => {
    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: payload.date,
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 120,
      slots: [{ value: '19:00', disabled: false, bookingOption: 'dinner' }],
      window: { opensAt: '10:00', closesAt: '23:00' },
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-abc' });
    createBookingWithCapacityCheckMock.mockResolvedValueOnce({
      success: true,
      duplicate: false,
      booking: { ...DEFAULT_BOOKING, id: 'booking-x', restaurant_id: RESTAURANT_ID },
    });

    await POST(createRequest(payload));

    const expectedKey = createHash('sha256')
      .update(`${RESTAURANT_ID}|customer-abc|${payload.date}|19:00|21:00`)
      .digest('hex')
      .slice(0, 32);

    expect(createBookingWithCapacityCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expectedKey,
      }),
    );
  });

  it('resolves restaurant id via slug when restaurantId is omitted', async () => {
    const payload = {
      restaurantSlug: 'white-horse-pub-waterbeach',
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    } as const;

    const request = createRequest(payload);

    getRestaurantBySlugMock.mockResolvedValue({
      id: RESTAURANT_ID,
      name: 'White Horse',
      slug: payload.restaurantSlug,
      timezone: 'UTC',
      capacity: 100,
    });

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: payload.date,
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 90,
      lastSeatingBufferMinutes: 120,
      isClosed: false,
      window: { opensAt: '10:00', closesAt: '22:00' },
      availableBookingOptions: ['dinner'],
      occasionCatalog: [],
      slots: [
        {
          value: '19:00',
          display: '7:00 PM',
          periodId: null,
          periodName: 'Dinner',
          bookingOption: 'dinner',
          defaultBookingOption: 'dinner',
          availability: {
            services: { lunch: 'disabled', dinner: 'enabled', drinks: 'disabled' },
            labels: {
              happyHour: false,
              drinksOnly: false,
              kitchenClosed: false,
              lunchWindow: false,
              dinnerWindow: true,
            },
          },
          disabled: false,
        },
      ],
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(getRestaurantBySlugMock).toHaveBeenCalledWith(payload.restaurantSlug);
    expect(createBookingWithCapacityCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: RESTAURANT_ID }),
    );
  });

  it('defaults past-time blocking to enabled when flag is undefined', async () => {
    const featureSpy = vi.spyOn(env, 'featureFlags', 'get').mockReturnValue({
      ...env.featureFlags,
      bookingPastTimeBlocking: undefined,
    });
    assertBookingNotInPastMock.mockReturnValue(undefined);

    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: payload.date,
      timezone: 'Europe/Paris',
      intervalMinutes: 15,
      defaultDurationMinutes: 120,
      slots: [{ value: '19:00', disabled: false, bookingOption: 'dinner' }],
      window: { opensAt: '10:00', closesAt: '23:00' },
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    createBookingWithCapacityCheckMock.mockResolvedValueOnce({
      success: true,
      duplicate: false,
      booking: DEFAULT_BOOKING,
    });

    await POST(createRequest(payload));

    expect(assertBookingNotInPastMock).toHaveBeenCalledWith(
      'Europe/Paris',
      payload.date,
      '19:00',
      expect.objectContaining({ graceMinutes: expect.any(Number) }),
    );
    featureSpy.mockRestore();
  });

  it('skips past-time check when feature flag is false', async () => {
    const featureSpy = vi.spyOn(env, 'featureFlags', 'get').mockReturnValue({
      ...env.featureFlags,
      bookingPastTimeBlocking: false,
    });
    assertBookingNotInPastMock.mockImplementation(() => {
      throw new Error('should not be called');
    });

    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: payload.date,
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 120,
      slots: [{ value: '19:00', disabled: false, bookingOption: 'dinner' }],
      window: { opensAt: '10:00', closesAt: '23:00' },
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    createBookingWithCapacityCheckMock.mockResolvedValueOnce({
      success: true,
      duplicate: false,
      booking: DEFAULT_BOOKING,
    });

    await POST(createRequest(payload));

    expect(assertBookingNotInPastMock).not.toHaveBeenCalled();
    featureSpy.mockRestore();
  });

  it('generates confirmation token with 30-day expiry when missing', async () => {
    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    const bookingWithToken = {
      ...DEFAULT_BOOKING,
      confirmation_token: null,
      confirmation_token_expires_at: null,
    };

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: payload.date,
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 120,
      slots: [{ value: '19:00', disabled: false, bookingOption: 'dinner' }],
      window: { opensAt: '10:00', closesAt: '23:00' },
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    createBookingWithCapacityCheckMock.mockResolvedValueOnce({
      success: true,
      duplicate: false,
      booking: bookingWithToken,
    });

    computeTokenExpiryMock.mockReturnValue('2099-02-01T00:00:00.000Z');
    attemptInlineAutoAssignMock.mockImplementation((_client, booking) => booking);

    const response = await POST(createRequest(payload));
    const json = await response.json();

    expect(json.confirmationToken).toBe('token-123');
    expect(generateConfirmationTokenMock).toHaveBeenCalledTimes(1);
    expect(computeTokenExpiryMock).toHaveBeenCalledWith(24 * 30);
    expect(attachTokenToBookingMock).toHaveBeenCalledWith(bookingWithToken.id, 'token-123', '2099-02-01T00:00:00.000Z');
  });

  it('returns 404 when restaurant context is missing and the default restaurant is absent', async () => {
    const payload = {
      date: '2025-10-10',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    } as const;

    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    getServiceSupabaseClientMock.mockReturnValue({ from: fromMock });

    const response = await POST(createRequest(payload));
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.code).toBe('RESTAURANT_NOT_FOUND');
    expect(createBookingWithCapacityCheckMock).not.toHaveBeenCalled();
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
  });
});

describe('/api/bookings GET', () => {
  let featureFlagsSpy: SpyInstance;
  let securitySpy: SpyInstance;

  beforeEach(() => {
     featureFlagsSpy = vi
       .spyOn(env, 'featureFlags', 'get')
       .mockReturnValue({
         loyaltyPilotRestaurantIds: undefined,
         enableTestApi: false,
         guestLookupPolicy: true,
         opsGuardV2: false,
         bookingValidationUnified: false,
       });

    securitySpy = vi
      .spyOn(env, 'security', 'get')
      .mockReturnValue({
        guestLookupPepper: 'test-pepper',
        sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret',
        sessionRecoveryAccessTokenTtlSeconds: 900,
      });

    getDefaultRestaurantIdMock.mockResolvedValue(RESTAURANT_ID);
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 20,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    computeGuestLookupHashMock.mockReturnValue('hash-value');
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const restaurantSingle = { data: { name: "Test Restaurant", slug: "test-rest" }, error: null };
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(restaurantSingle),
          }),
        }),
      }),
    });
    fetchBookingsForContactMock.mockResolvedValue([]);
  });

  afterEach(() => {
    featureFlagsSpy.mockRestore();
    securitySpy.mockRestore();
    vi.clearAllMocks();
  });

  it('returns 429 when rate limit exceeded', async () => {
    const retryReset = Date.now() + 10_000;
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      limit: 20,
      remaining: 0,
      resetAt: retryReset,
      source: 'memory',
    });

    const response = await GET(
      createGetRequest('?email=test@example.com&phone=1234567890', { 'x-forwarded-for': '203.0.113.10' }),
    );

    expect(response.status).toBe(429);
    const json = await response.json();
    expect(json.code).toBe('RATE_LIMITED');
    expect(fetchBookingsForContactMock).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'guest_lookup.rate_limited',
      }),
    );
  });

  it('returns bookings from guest lookup RPC when available', async () => {
    const bookings = [
      {
        id: 'booking-123',
        restaurant_id: RESTAURANT_ID,
        start_at: '2025-10-10T19:00:00.000Z',
        end_at: '2025-10-10T21:00:00.000Z',
        party_size: 2,
        status: 'confirmed',
        notes: null,
      },
    ];

    const rpcMock = vi.fn().mockResolvedValue({ data: bookings, error: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValueOnce({
      rpc: rpcMock,
    });

    const response = await GET(
      createGetRequest('?email=test@example.com&phone=1234567890', { 'x-forwarded-for': '198.51.100.25' }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json.bookings)).toBe(true);
    expect(json.bookings[0]).toMatchObject({
      id: 'booking-123',
      status: 'confirmed',
    });
    expect(rpcMock).toHaveBeenCalledWith('get_guest_bookings', {
      p_restaurant_id: RESTAURANT_ID,
      p_hash: 'hash-value',
    });
    expect(fetchBookingsForContactMock).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'guest_lookup.allowed',
      }),
    );
  });

  it('rejects session recovery access token with invalid signature', async () => {
    const token = createSessionRecoveryAccessToken({
      restaurantId: RESTAURANT_ID,
      email: 'test@example.com',
      phone: '1234567890',
      secret: 'wrong-secret',
      now: new Date('2025-10-01T10:00:00Z'),
    });

    const response = await GET(
      createGetRequest(`?access_token=${encodeURIComponent(token)}`, { 'x-forwarded-for': '203.0.113.10' }),
    );

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe('INVALID_ACCESS_TOKEN');
    expect(fetchBookingsForContactMock).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'guest_lookup.access_token_rejected',
      }),
    );
  });

  it('returns bookings when session recovery access token is valid', async () => {
    const bookings = [
      {
        id: 'booking-456',
        restaurant_id: RESTAURANT_ID,
        start_at: '2025-10-11T19:00:00.000Z',
        end_at: '2025-10-11T21:00:00.000Z',
        party_size: 2,
        status: 'confirmed',
        notes: null,
      },
    ];

    const token = createSessionRecoveryAccessToken({
      restaurantId: RESTAURANT_ID,
      email: 'test@example.com',
      phone: '1234567890',
      secret: 'test-session-recovery-secret',
      now: new Date(),
      ttlSeconds: 86_400,
    });

    const rpcMock = vi.fn().mockResolvedValue({ data: bookings, error: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      rpc: rpcMock,
    });

    const response = await GET(
      createGetRequest(`?access_token=${encodeURIComponent(token)}`, { 'x-forwarded-for': '198.51.100.25' }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.bookings).toEqual(bookings);
    expect(json.access).toEqual(
      expect.objectContaining({
        mode: 'token',
        restaurantSource: 'token',
        lookupStrategy: 'policy',
      }),
    );
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'guest_lookup.allowed',
        context: expect.objectContaining({
          access_mode: 'token',
          access_token_used: true,
        }),
      }),
    );
  });
});
