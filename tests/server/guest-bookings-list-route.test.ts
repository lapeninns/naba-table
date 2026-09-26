import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    reserve: {
      defaultDurationMinutes: 90,
    },
    security: {},
  },
}));

vi.mock('@/server/booking', () => ({
  BookingValidationError: class BookingValidationError extends Error {},
  createBookingValidationService: vi.fn(),
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(),
  withValidationHeaders: vi.fn((response) => response),
}));

vi.mock('@/server/bookings', () => ({
  BOOKING_TYPES: ['lunch', 'dinner'],
  buildBookingAuditSnapshot: vi.fn(() => ({})),
  deriveEndTimeFromDuration: vi.fn(() => '20:30'),
  fetchBookingsForContact: vi.fn(),
  generateUniqueBookingReference: vi.fn(),
  inferMealTypeFromTime: vi.fn(() => 'dinner'),
  insertBookingRecord: vi.fn(),
  logAuditEvent: vi.fn(),
  updateBookingRecord: vi.fn(),
}));

vi.mock('@/server/bookings/confirmation-token', () => ({
  computeTokenExpiry: vi.fn(() => '2026-05-16T12:00:00.000Z'),
  generateConfirmationToken: vi.fn(() => 'token'),
}));

vi.mock('@/server/bookings/duration', () => ({
  resolveBookingDurationMinutes: vi.fn(),
}));

vi.mock('@/server/capacity', () => ({
  checkSlotAvailability: vi.fn(),
  createBookingWithCapacityCheck: vi.fn(),
  findAlternativeSlots: vi.fn(),
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: vi.fn((value: string | null | undefined) => (value ?? '').trim().toLowerCase()),
  upsertCustomer: vi.fn(),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCreatedSideEffects: vi.fn(),
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(),
}));

vi.mock('@/server/restaurants/getActiveRestaurantId', () => ({
  getActiveRestaurantId: vi.fn(),
}));

vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: vi.fn(),
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: vi.fn(),
}));

vi.mock('@/server/queue/email', () => ({
  enqueueEmailJob: vi.fn(),
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: vi.fn(),
}));

vi.mock('@/server/security/request', () => ({
  anonymizeIp: vi.fn(() => '127.0.0.0/24'),
  extractClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/server/supabase', () => ({
  getDefaultRestaurantId: vi.fn(async () => '11111111-1111-4111-8111-111111111111'),
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
  getTenantServiceSupabaseClient: vi.fn(() => ({ kind: 'tenant-client' })),
  MissingRestaurantContextError: class MissingRestaurantContextError extends Error {},
}));

vi.mock('@reserve/shared/validation', () => ({
  CUSTOMER_PHONE_LENGTH_MAX: 20,
  CUSTOMER_PHONE_LENGTH_MIN: 10,
  isUKPhone: vi.fn(() => true),
}));

import { GET } from '@/src/app/api/bookings/route';

const USER = {
  id: 'guest-user-1',
  email: 'Guest@Example.com',
};
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: RESTAURANT_ID,
    booking_date: '2026-07-01',
    start_time: '19:00',
    end_time: '20:30',
    start_at: '2026-07-01T18:00:00.000Z',
    end_at: '2026-07-01T19:30:00.000Z',
    party_size: 2,
    status: 'confirmed',
    notes: 'Window seat',
    restaurants: {
      id: RESTAURANT_ID,
      name: 'The Bell',
      slug: 'the-bell',
      timezone: 'Europe/London',
      reservation_interval_minutes: 15,
    },
    ...overrides,
  };
}

function createBookingQuery(response: {
  count?: number | null;
  data: ReturnType<typeof makeBooking>[];
  error?: { message: string } | null;
}) {
  const query = {
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    lt: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => ({
      count: response.count ?? response.data.length,
      data: response.data,
      error: response.error ?? null,
    })),
    select: vi.fn(() => query),
  };
  return query;
}

function request(search = '?me=1') {
  return new NextRequest(`https://www.nabatable.com/api/bookings${search}`);
}

describe('guest booking list route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: USER },
      error: null,
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
    });
  });

  it('requires an authenticated guest @p0 @api @security', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('lists only bookings bound to the authenticated guest account @p0 @api @security', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { ...USER, email_confirmed_at: '2026-01-01T00:00:00.000Z' } },
      error: null,
    });
    const query = createBookingQuery({ data: [makeBooking()], count: 1 });
    fromMock.mockReturnValue(query);
    getServiceSupabaseClientMock.mockReturnValue({ from: fromMock });

    const response = await GET(
      request(`?me=1&status=confirmed&page=2&pageSize=1&sort=desc&restaurantId=${RESTAURANT_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith('bookings');
    expect(query.eq).toHaveBeenCalledWith('auth_user_id', 'guest-user-1');
    // Email matching is gated off (SESSION_EMAIL_MATCH_ENABLED=false), even for a
    // confirmed email: an email-matched row is not listed.
    expect(query.eq).not.toHaveBeenCalledWith('customer_email', expect.anything());
    expect(query.or).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('restaurant_id', RESTAURANT_ID);
    expect(query.eq).toHaveBeenCalledWith('status', 'confirmed');
    expect(query.order).toHaveBeenCalledWith('booking_date', { ascending: false });
    expect(query.order).toHaveBeenCalledWith('start_time', { ascending: false });
    expect(query.range).toHaveBeenCalledWith(1, 1);
    expect(body).toEqual({
      items: [
        expect.objectContaining({
          customerEmail: null,
          customerName: null,
          id: 'booking-1',
          partySize: 2,
          restaurantName: 'The Bell',
          restaurantSlug: 'the-bell',
          status: 'confirmed',
        }),
      ],
      pageInfo: {
        hasNext: false,
        page: 2,
        pageSize: 1,
        total: 1,
      },
    });
  });

  it('answers the removed contact lookup with 410 and no query @p0 @api @security', async () => {
    const response = await GET(
      request(`?email=guest%40example.com&phone=07700900123&restaurantId=${RESTAURANT_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.code).toBe('CONTACT_LOOKUP_REMOVED');
    expect(body).not.toHaveProperty('bookings');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('rejects invalid booking list query params before service queries @p0 @api @contract', async () => {
    const response = await GET(request('?me=1&pageSize=999'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });
});
