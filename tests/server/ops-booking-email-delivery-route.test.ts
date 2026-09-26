import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSessionMock = vi.hoisted(() => vi.fn());
const requireRestaurantMemberMock = vi.hoisted(() => vi.fn());
const listEmailDeliveryEventsForBookingMock = vi.hoisted(() => vi.fn());
const bookingLookupMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', async () => {
  const actual = await vi.importActual<typeof GuardsModule>('@/server/auth/guards');
  return {
    ...actual,
    requireSession: requireSessionMock,
    requireRestaurantMember: requireRestaurantMemberMock,
  };
});

vi.mock('@/server/emails/email-delivery-log', async () => {
  const actual = await vi.importActual<typeof DeliveryLogModule>(
    '@/server/emails/email-delivery-log',
  );
  return {
    EmailDeliveryLogUnavailableError: actual.EmailDeliveryLogUnavailableError,
    listEmailDeliveryEventsForBooking: listEmailDeliveryEventsForBookingMock,
  };
});

import { GuardError } from '@/server/auth/guards';
import { EmailDeliveryLogUnavailableError } from '@/server/emails/email-delivery-log';
import { GET } from '@/src/app/api/ops/bookings/[id]/email-delivery/route';

import type * as GuardsModule from '@/server/auth/guards';
import type * as DeliveryLogModule from '@/server/emails/email-delivery-log';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';

function request(query = '') {
  return new NextRequest(
    `https://www.nabatable.com/api/ops/bookings/${BOOKING_ID}/email-delivery${query}`,
  );
}

function context(id = BOOKING_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/ops/bookings/[id]/email-delivery', () => {
  beforeEach(() => {
    bookingLookupMock
      .mockReset()
      .mockResolvedValue({ data: { id: BOOKING_ID, restaurant_id: 'rest-1' }, error: null });
    requireSessionMock.mockReset().mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: bookingLookupMock }) }) }),
      },
    });
    requireRestaurantMemberMock.mockReset().mockResolvedValue(undefined);
    listEmailDeliveryEventsForBookingMock.mockReset().mockResolvedValue([]);
  });

  it('returns the booking events', async () => {
    const response = await GET(request('?limit=5'), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, bookingId: BOOKING_ID, events: [] });
    expect(listEmailDeliveryEventsForBookingMock).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      limit: 5,
    });
  });

  it('rejects an invalid booking id with a C1 body', async () => {
    const response = await GET(request(), context('nope'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_BOOKING_ID' });
  });

  it('returns 404 BOOKING_NOT_FOUND for an unknown booking', async () => {
    bookingLookupMock.mockResolvedValue({ data: null, error: null });

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'BOOKING_NOT_FOUND' });
  });

  it('returns 403 for a non-member', async () => {
    requireRestaurantMemberMock.mockRejectedValue(
      new GuardError({ status: 403, code: 'FORBIDDEN', message: 'Forbidden' }),
    );

    const response = await GET(request(), context());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns a retryable 503 while the delivery log is unavailable', async () => {
    listEmailDeliveryEventsForBookingMock.mockRejectedValue(new EmailDeliveryLogUnavailableError());

    const response = await GET(request(), context());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'DELIVERY_LOG_UNAVAILABLE',
      retryable: true,
    });
  });

  it('never returns raw database text', async () => {
    bookingLookupMock.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation "bookings_secret" does not exist' },
    });

    const response = await GET(request(), context());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(payload)).not.toContain('bookings_secret');
  });
});
