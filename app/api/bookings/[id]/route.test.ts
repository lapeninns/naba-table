import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PUT } from './route';
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

function createTenantSupabase() {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: existingBooking, error: null });
  const selectMock = vi.fn(() => ({
    eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
  }));

  return {
    from: vi.fn(() => ({ select: selectMock })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { email: existingBooking.customer_email } }, error: null }),
    },
  };
}

function createServiceSupabase() {
  return {};
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

describe('/api/bookings/[id] PUT', () => {
  afterEach(() => {
    vi.clearAllMocks();
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
