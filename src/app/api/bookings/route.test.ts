process.env.BASE_URL ??= "http://localhost:3000";

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpyInstance } from 'vitest';

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
        } as const;
      },
    },
  };
});

import { GET, POST } from './route';
import { OperatingHoursError } from '@/server/bookings/timeValidation';
import { env } from '@/lib/env';

const assertBookingWithinOperatingWindowMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getDefaultRestaurantIdMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn(() => ({})));
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

vi.mock('@/server/bookings/timeValidation', async () => {
  const actual = await vi.importActual<typeof import('@/server/bookings/timeValidation')>(
    '@/server/bookings/timeValidation',
  );
  return {
    ...actual,
    assertBookingWithinOperatingWindow: assertBookingWithinOperatingWindowMock,
  };
});

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: (...args: unknown[]) => getRestaurantScheduleMock(...args),
}));

vi.mock('@/server/supabase', () => ({
  getDefaultRestaurantId: (...args: unknown[]) => getDefaultRestaurantIdMock(...args),
  getRouteHandlerSupabaseClient: (...args: unknown[]) => getRouteHandlerSupabaseClientMock(...args),
  getServiceSupabaseClient: (...args: unknown[]) => getServiceSupabaseClientMock(...args),
}));

vi.mock('@/server/customers', () => ({
  upsertCustomer: (...args: unknown[]) => upsertCustomerMock(...args),
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
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
  const actual = await vi.importActual<typeof import('@/server/bookings')>('@/server/bookings');
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
    getServiceSupabaseClientMock.mockReturnValue({});
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

    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      timezone: 'UTC',
      intervalMinutes: 15,
      defaultDurationMinutes: 90,
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
      });
    securitySpy = vi
      .spyOn(env, 'security', 'get')
      .mockReturnValue({
        guestLookupPepper: 'test-pepper',
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
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      rpc: rpcMock,
    });

    const response = await GET(
      createGetRequest('?email=test@example.com&phone=1234567890', { 'x-forwarded-for': '198.51.100.25' }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.bookings).toEqual(bookings);
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
});
