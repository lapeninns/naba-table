import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';
import { OperatingHoursError } from '@/server/bookings/timeValidation';

const assertBookingWithinOperatingWindowMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getDefaultRestaurantIdMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn(() => ({})));
const upsertCustomerMock = vi.hoisted(() => vi.fn());
const insertBookingRecordMock = vi.hoisted(() => vi.fn());
const fetchBookingsForContactMock = vi.hoisted(() => vi.fn());
const buildBookingAuditSnapshotMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const generateUniqueBookingReferenceMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const enqueueBookingCreatedSideEffectsMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const getActiveLoyaltyProgramMock = vi.hoisted(() => vi.fn());
const calculateLoyaltyAwardMock = vi.hoisted(() => vi.fn());
const applyLoyaltyAwardMock = vi.hoisted(() => vi.fn());

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
  getRouteHandlerSupabaseClient: vi.fn(),
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

vi.mock('@/server/bookings', async () => {
  const actual = await vi.importActual<typeof import('@/server/bookings')>('@/server/bookings');
  return {
    ...actual,
    generateUniqueBookingReference: (...args: unknown[]) => generateUniqueBookingReferenceMock(...args),
    insertBookingRecord: (...args: unknown[]) => insertBookingRecordMock(...args),
    fetchBookingsForContact: (...args: unknown[]) => fetchBookingsForContactMock(...args),
    buildBookingAuditSnapshot: (...args: unknown[]) => buildBookingAuditSnapshotMock(...args),
    logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args),
    updateBookingRecord: (...args: unknown[]) => updateBookingRecordMock(...args),
  };
});

function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

describe('/api/bookings POST', () => {
  beforeEach(() => {
    getDefaultRestaurantIdMock.mockResolvedValue('rest-default');
    getServiceSupabaseClientMock.mockReturnValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
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
      isClosed: false,
      window: { opensAt: '10:00', closesAt: '22:00' },
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
    expect(insertBookingRecordMock).not.toHaveBeenCalled();
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
      isClosed: false,
      window: { opensAt: '10:00', closesAt: '22:00' },
      slots: [
        {
          value: '19:00',
          display: '7:00 PM',
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
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: '19:00' });
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    generateUniqueBookingReferenceMock.mockResolvedValueOnce('REF123');
    insertBookingRecordMock.mockResolvedValueOnce({ ...bookingRecord, client_request_id: 'req-1' });
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
    expect(insertBookingRecordMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      start_time: '19:00',
    }));
    expect(json.booking.reference).toBe('REF123');
  });
});
