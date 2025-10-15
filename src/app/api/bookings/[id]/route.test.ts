import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, PUT } from './route';
import { GuardError } from '@/server/auth/guards';
import { OperatingHoursError } from '@/server/bookings/timeValidation';

const assertBookingWithinOperatingWindowMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getDefaultRestaurantIdMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const fetchBookingsForContactMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const buildBookingAuditSnapshotMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const enqueueBookingUpdatedSideEffectsMock = vi.hoisted(() => vi.fn());
const requireSessionMock = vi.hoisted(() => vi.fn());
const listUserRestaurantMembershipsMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/server/auth/guards', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/guards')>('@/server/auth/guards');
  return {
    ...actual,
    requireSession: (...args: unknown[]) => requireSessionMock(...args),
    listUserRestaurantMemberships: (...args: unknown[]) => listUserRestaurantMembershipsMock(...args),
  };
});

vi.mock('@/server/bookings', async () => {
  const actual = await vi.importActual<typeof import('@/server/bookings')>('@/server/bookings');
  return {
    ...actual,
    fetchBookingsForContact: (...args: unknown[]) => fetchBookingsForContactMock(...args),
    updateBookingRecord: (...args: unknown[]) => updateBookingRecordMock(...args),
    buildBookingAuditSnapshot: (...args: unknown[]) => buildBookingAuditSnapshotMock(...args),
    logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args),
  };
});

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingUpdatedSideEffects: (...args: unknown[]) => enqueueBookingUpdatedSideEffectsMock(...args),
  enqueueBookingCreatedSideEffects: vi.fn(),
  enqueueBookingCancelledSideEffects: vi.fn(),
  safeBookingPayload: (payload: unknown) => payload,
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: (...args: unknown[]) => recordObservabilityEventMock(...args),
}));

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

const existingBooking = {
  id: 'booking-1',
  restaurant_id: RESTAURANT_ID,
  booking_date: '2025-10-10',
  start_time: '19:00',
  end_time: '21:00',
  party_size: 2,
  booking_type: 'dinner',
  seating_preference: 'any',
  status: 'confirmed',
  customer_name: 'Test User',
  customer_email: 'test@example.com',
  customer_phone: '1234567890',
  notes: null,
  marketing_opt_in: false,
  loyalty_points_awarded: 0,
  source: 'api',
  customer_id: 'customer-1',
  auth_user_id: null,
  client_request_id: 'req-1',
  pending_ref: null,
  idempotency_key: null,
  details: null,
  created_at: '2025-10-01T10:00:00Z',
  updated_at: '2025-10-01T10:05:00Z',
  slot: null,
};

function createTenantSupabase(booking: typeof existingBooking | null = existingBooking) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: booking, error: null });
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    from: fromMock,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: (booking ?? existingBooking).customer_email } },
        error: null,
      }),
    },
    __mocks: {
      maybeSingleMock,
      selectMock,
      eqMock,
    },
  };
}

function createServiceSupabase(options: { booking?: typeof existingBooking | null } = {}) {
  const booking = 'booking' in options ? options.booking : existingBooking;
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: booking, error: null });
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    from: fromMock,
    __mocks: {
      maybeSingleMock,
      selectMock,
      eqMock,
    },
  };
}

function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/bookings/booking-1', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('/api/bookings/[id] GET', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    const request = new NextRequest('http://localhost/api/bookings/booking-1', { method: 'GET' });
    const params = { params: Promise.resolve({ id: 'booking-1' }) } as const;

    const tenantSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(tenantSupabase);

    const response = await GET(request, params);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Authentication required');
    expect(json.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 when user email is missing', async () => {
    const request = new NextRequest('http://localhost/api/bookings/booking-1', { method: 'GET' });
    const params = { params: Promise.resolve({ id: 'booking-1' }) } as const;

    const tenantSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: null } },
          error: null,
        }),
      },
    };

    getRouteHandlerSupabaseClientMock.mockResolvedValue(tenantSupabase);

    const response = await GET(request, params);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 when user does not own the booking', async () => {
    const request = new NextRequest('http://localhost/api/bookings/booking-1', { method: 'GET' });
    const params = { params: Promise.resolve({ id: 'booking-1' }) } as const;

    const tenantSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'other@example.com' } },
          error: null,
        }),
      },
    };

    const serviceSupabase = createServiceSupabase({ booking: existingBooking });

    getRouteHandlerSupabaseClientMock.mockResolvedValue(tenantSupabase);
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);

    const response = await GET(request, params);

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe('You can only view your own bookings');
    expect(json.code).toBe('FORBIDDEN');

    // Verify observability event was logged
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking_details.access_denied',
      severity: 'warning',
      context: {
        booking_id: 'booking-1',
        user_email: 'other@example.com',
        booking_email: 'test@example.com',
      },
    });
  });

  it('returns 200 with booking data when user owns the booking', async () => {
    const request = new NextRequest('http://localhost/api/bookings/booking-1', { method: 'GET' });
    const params = { params: Promise.resolve({ id: 'booking-1' }) } as const;

    const tenantSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        }),
      },
    };

    const serviceSupabase = createServiceSupabase({ booking: existingBooking });

    getRouteHandlerSupabaseClientMock.mockResolvedValue(tenantSupabase);
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);

    const response = await GET(request, params);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.booking).toBeDefined();
    expect(json.booking.id).toBe('booking-1');
    expect(json.booking.customer_email).toBe('test@example.com');

    // Verify no access denied event was logged
    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
  });

  it('returns 404 when booking is not found', async () => {
    const request = new NextRequest('http://localhost/api/bookings/nonexistent', { method: 'GET' });
    const params = { params: Promise.resolve({ id: 'nonexistent' }) } as const;

    const tenantSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        }),
      },
    };

    const serviceSupabase = createServiceSupabase({ booking: null });

    getRouteHandlerSupabaseClientMock.mockResolvedValue(tenantSupabase);
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);

    const response = await GET(request, params);

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Booking not found');
  });

  it('normalizes email for comparison (case-insensitive)', async () => {
    const request = new NextRequest('http://localhost/api/bookings/booking-1', { method: 'GET' });
    const params = { params: Promise.resolve({ id: 'booking-1' }) } as const;

    const tenantSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'TEST@EXAMPLE.COM' } },
          error: null,
        }),
      },
    };

    const serviceSupabase = createServiceSupabase({ booking: existingBooking });

    getRouteHandlerSupabaseClientMock.mockResolvedValue(tenantSupabase);
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);

    const response = await GET(request, params);

    // Should succeed because normalizeEmail makes comparison case-insensitive
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.booking.id).toBe('booking-1');
  });
});

describe('/api/bookings/[id] PUT', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when session is missing for dashboard updates', async () => {
    const payload = {
      startIso: '2025-10-10T19:00:00.000Z',
      endIso: '2025-10-10T21:00:00.000Z',
      partySize: 2,
    };

    const request = createRequest(payload);
    const params = { params: Promise.resolve({ id: existingBooking.id }) } as const;

    requireSessionMock.mockRejectedValue(
      new GuardError({ status: 401, code: 'UNAUTHENTICATED', message: 'Authentication required' }),
    );

    const response = await PUT(request, params);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 when staff has no memberships for dashboard updates', async () => {
    const payload = {
      startIso: '2025-10-10T19:00:00.000Z',
      endIso: '2025-10-10T21:00:00.000Z',
      partySize: 2,
    };

    const request = createRequest(payload);
    const params = { params: Promise.resolve({ id: existingBooking.id }) } as const;

    const tenantSupabase = createTenantSupabase(null);
    requireSessionMock.mockResolvedValue({
      supabase: tenantSupabase,
      user: { id: 'user-1', email: 'ops@example.com' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([]);

    const response = await PUT(request, params);

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.code).toBe('FORBIDDEN');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('returns 403 when staff is not a member of the booking restaurant', async () => {
    const payload = {
      startIso: '2025-10-10T19:00:00.000Z',
      endIso: '2025-10-10T21:00:00.000Z',
      partySize: 2,
    };

    const request = createRequest(payload);
    const params = { params: Promise.resolve({ id: existingBooking.id }) } as const;

    const tenantSupabase = createTenantSupabase(null);
    requireSessionMock.mockResolvedValue({
      supabase: tenantSupabase,
      user: { id: 'user-1', email: 'ops@example.com' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([
      { restaurant_id: 'some-other-id', role: 'server', created_at: '', restaurants: null },
    ]);

    const serviceSupabase = createServiceSupabase({ booking: existingBooking });
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);

    const response = await PUT(request, params);

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.code).toBe('FORBIDDEN');
  });

  it('updates booking through dashboard path for authorized staff', async () => {
    const payload = {
      startIso: '2025-10-10T19:00:00.000Z',
      endIso: '2025-10-10T21:00:00.000Z',
      partySize: 4,
      notes: 'Table near window',
    };

    const request = createRequest(payload);
    const params = { params: Promise.resolve({ id: existingBooking.id }) } as const;

    const tenantSupabase = createTenantSupabase(existingBooking);
    requireSessionMock.mockResolvedValue({
      supabase: tenantSupabase,
      user: { id: 'user-1', email: 'ops@example.com' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([
      { restaurant_id: existingBooking.restaurant_id, role: 'manager', created_at: '', restaurants: null },
    ]);

    const updatedBooking = {
      ...existingBooking,
      party_size: 4,
      notes: 'Table near window',
      start_at: '2025-10-10T19:00:00.000Z',
      end_at: '2025-10-10T21:00:00.000Z',
    };

    updateBookingRecordMock.mockResolvedValue(updatedBooking);
    buildBookingAuditSnapshotMock.mockReturnValue({ diff: 'changed' });
    logAuditEventMock.mockResolvedValue(undefined);
    enqueueBookingUpdatedSideEffectsMock.mockResolvedValue(undefined);

    const serviceSupabase = createServiceSupabase({ booking: existingBooking });
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);

    const response = await PUT(request, params);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe(updatedBooking.id);
    expect(json.partySize).toBe(4);
    expect(updateBookingRecordMock).toHaveBeenCalledWith(expect.any(Object), existingBooking.id, expect.objectContaining({
      party_size: 4,
      notes: 'Table near window',
    }));
    expect(logAuditEventMock).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      metadata: expect.objectContaining({
        actor_user_id: 'user-1',
        restaurant_id: existingBooking.restaurant_id,
      }),
    }));
  });

  it('returns 400 when booking time is outside operating hours', async () => {
    const payload = {
      date: '2025-10-10',
      time: '22:30',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    const request = createRequest(payload);
    const params = { params: Promise.resolve({ id: 'booking-1' }) } as const;

    getDefaultRestaurantIdMock.mockResolvedValue('rest-default');
    getRouteHandlerSupabaseClientMock.mockResolvedValue(createTenantSupabase());
    getServiceSupabaseClientMock.mockReturnValue(createServiceSupabase());
    getRestaurantScheduleMock.mockResolvedValue({
      isClosed: false,
      window: { opensAt: '10:00', closesAt: '22:00' },
      slots: [],
    });
    assertBookingWithinOperatingWindowMock.mockImplementation(() => {
      throw new OperatingHoursError('OUTSIDE_WINDOW', 'Selected time is outside operating hours.');
    });

    const response = await PUT(request, params);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Selected time is outside operating hours.');
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
  });

  it('updates booking when validation passes', async () => {
    const payload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '20:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'any',
      notes: null,
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
    };

    const request = createRequest(payload);
    const params = { params: Promise.resolve({ id: 'booking-1' }) } as const;

    const tenantSupabase = createTenantSupabase();
    const serviceSupabase = createServiceSupabase();

    getDefaultRestaurantIdMock.mockResolvedValue('rest-default');
    getRouteHandlerSupabaseClientMock.mockResolvedValue(tenantSupabase);
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);
    getRestaurantScheduleMock.mockResolvedValue({
      isClosed: false,
      window: { opensAt: '10:00', closesAt: '22:00' },
      slots: [
        {
          value: '20:00',
          display: '8:00 PM',
          periodId: null,
          periodName: 'Dinner',
          bookingOption: 'dinner',
          defaultBookingOption: 'dinner',
          availability: {
            services: { lunch: 'disabled', dinner: 'enabled', drinks: 'enabled' },
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
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '20:00' });
    updateBookingRecordMock.mockResolvedValue({ ...existingBooking, start_time: '20:00', end_time: '22:00' });
    fetchBookingsForContactMock.mockResolvedValue([existingBooking]);
    buildBookingAuditSnapshotMock.mockReturnValue({ previous: null, current: null, changes: [] });
    logAuditEventMock.mockResolvedValue(undefined);
    enqueueBookingUpdatedSideEffectsMock.mockResolvedValue(undefined);

    const response = await PUT(request, params);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(assertBookingWithinOperatingWindowMock).toHaveBeenCalledWith({
      schedule: expect.any(Object),
      requestedTime: '20:00',
      bookingType: 'dinner',
    });
    expect(updateBookingRecordMock).toHaveBeenCalledWith(serviceSupabase, 'booking-1', expect.objectContaining({
      start_time: '20:00',
    }));
    expect(json.booking.start_time).toBe('20:00');
  });
});
