import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSessionMock = vi.hoisted(() => vi.fn());
const requireRestaurantMemberMock = vi.hoisted(() => vi.fn());
const listSmsDeliveryEventsForBookingMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', () => {
  class GuardError extends Error {
    code: string;
    status: number;

    constructor(params?: { status?: number; code?: string; message?: string }) {
      super(params?.message ?? 'Guard error');
      this.code = params?.code ?? 'INTERNAL';
      this.status = params?.status ?? 500;
    }
  }

  return {
    GuardError,
    requireSession: requireSessionMock,
    requireRestaurantMember: requireRestaurantMemberMock,
  };
});

vi.mock('@/server/sms/delivery-log', () => {
  class SmsDeliveryLogUnavailableError extends Error {}

  return {
    SmsDeliveryLogUnavailableError,
    listSmsDeliveryEventsForBooking: listSmsDeliveryEventsForBookingMock,
  };
});

import { GET } from '@/src/app/api/ops/bookings/[id]/sms-delivery/route';

const bookingId = '11111111-1111-4111-8111-111111111111';
const restaurantId = '22222222-2222-4222-8222-222222222222';

describe('GET /api/ops/bookings/[id]/sms-delivery', () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    requireRestaurantMemberMock.mockReset();
    listSmsDeliveryEventsForBookingMock.mockReset();

    requireSessionMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: bookingId, restaurant_id: restaurantId },
                error: null,
              }),
            })),
          })),
        })),
      },
    });
    requireRestaurantMemberMock.mockResolvedValue(undefined);
    listSmsDeliveryEventsForBookingMock.mockResolvedValue([
      {
        id: 'evt-1',
        bookingId,
        restaurantId,
        smsType: 'booking_confirmation',
        recipientPhone: '+447700900123',
        messageSid: 'SM123',
        status: 'failed',
        provider: 'twilio',
        occurredAt: '2026-05-10T09:00:00.000Z',
        error: 'Carrier detail',
        metadata: {
          accountSid: 'AC123',
          from: '+447700900456',
        },
      },
    ]);
  });

  it('sanitizes booking-level SMS delivery events before returning them', async () => {
    const response = await GET(
      new NextRequest(`https://app.nabatable.com/api/ops/bookings/${bookingId}/sms-delivery`),
      { params: Promise.resolve({ id: bookingId }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      bookingId,
      events: [
        {
          id: 'evt-1',
          recipientPhone: '+********0123',
          error: null,
          metadata: null,
        },
      ],
    });
    expect(requireRestaurantMemberMock).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: 'user-1',
      restaurantId,
    });
    expect(listSmsDeliveryEventsForBookingMock).toHaveBeenCalledWith({
      bookingId,
      limit: 50,
    });
  });
});
