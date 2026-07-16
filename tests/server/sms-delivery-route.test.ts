import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSessionMock = vi.hoisted(() => vi.fn());
const listUserRestaurantMembershipsMock = vi.hoisted(() => vi.fn());
const requireRestaurantMemberMock = vi.hoisted(() => vi.fn());
const listSmsDeliveryAttemptsForRestaurantMock = vi.hoisted(() => vi.fn());
const getSmsDeliveryAttemptsSummaryMock = vi.hoisted(() => vi.fn());

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
    listUserRestaurantMemberships: listUserRestaurantMembershipsMock,
    requireRestaurantMember: requireRestaurantMemberMock,
  };
});

vi.mock('@/server/sms/delivery-log', () => {
  class SmsDeliveryLogUnavailableError extends Error {}

  return {
    SmsDeliveryLogUnavailableError,
    listSmsDeliveryAttemptsForRestaurant: listSmsDeliveryAttemptsForRestaurantMock,
    getSmsDeliveryAttemptsSummary: getSmsDeliveryAttemptsSummaryMock,
  };
});

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { GuardError } from '@/server/auth/guards';
import { GET } from '@/src/app/api/ops/sms-delivery/route';

const restaurantId = '11111111-1111-4111-8111-111111111111';

describe('GET /api/ops/sms-delivery', () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    listUserRestaurantMembershipsMock.mockReset();
    requireRestaurantMemberMock.mockReset();
    listSmsDeliveryAttemptsForRestaurantMock.mockReset();
    getSmsDeliveryAttemptsSummaryMock.mockReset();

    requireSessionMock.mockResolvedValue({
      supabase: { mock: true },
      user: { id: 'user-1' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([{ restaurant_id: restaurantId }]);
    requireRestaurantMemberMock.mockResolvedValue(undefined);
    listSmsDeliveryAttemptsForRestaurantMock.mockResolvedValue({
      page: 1,
      pageSize: 50,
      hasNext: false,
      attempts: [
        {
          messageSid: 'SM123',
          recipientPhone: '+447700900123',
          bookingId: 'booking-1',
          smsType: 'booking_confirmation',
          provider: 'twilio',
          currentStatus: 'delivered',
          currentOccurredAt: '2026-05-10T09:00:00.000Z',
          booking: null,
          events: [
            {
              id: 'evt-1',
              bookingId: 'booking-1',
              restaurantId,
              smsType: 'booking_confirmation',
              recipientPhone: '+447700900123',
              messageSid: 'SM123',
              status: 'delivered',
              provider: 'twilio',
              occurredAt: '2026-05-10T09:00:00.000Z',
              error: 'Carrier detail',
              metadata: {
                accountSid: 'AC123',
                from: '+447700900456',
              },
            },
          ],
        },
      ],
    });
    getSmsDeliveryAttemptsSummaryMock.mockResolvedValue({
      total: 1,
      queued: 0,
      sent: 0,
      delivered: 1,
      undelivered: 0,
      failed: 0,
      deliveredRate: 1,
      failureRate: 0,
      uniqueRecipients: 1,
      uniqueBookings: 1,
      stuckInFlight: 0,
    });
  });

  it('sanitizes provider diagnostics from restaurant feed events', async () => {
    const response = await GET(
      new NextRequest(`https://app.nabatable.com/api/ops/sms-delivery?restaurantId=${restaurantId}`),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.attempts[0].events[0]).toMatchObject({
      id: 'evt-1',
      status: 'delivered',
      recipientPhone: '+********0123',
      error: null,
      metadata: null,
    });
    expect(payload.attempts[0].recipientPhone).toBe('+********0123');
    expect(requireRestaurantMemberMock).toHaveBeenCalledWith({
      supabase: { mock: true },
      userId: 'user-1',
      restaurantId,
      allowedRoles: RESTAURANT_ADMIN_ROLES,
    });
  });

  it('rejects non-admin restaurant roles before loading delivery data', async () => {
    requireRestaurantMemberMock.mockRejectedValue(
      new GuardError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have sufficient permissions for this restaurant',
      }),
    );

    const response = await GET(
      new NextRequest(`https://app.nabatable.com/api/ops/sms-delivery?restaurantId=${restaurantId}`),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
      error: 'You do not have sufficient permissions for this restaurant',
    });
    expect(listSmsDeliveryAttemptsForRestaurantMock).not.toHaveBeenCalled();
    expect(getSmsDeliveryAttemptsSummaryMock).not.toHaveBeenCalled();
  });

  it('forwards channel=whatsapp to list and summary loaders', async () => {
    const response = await GET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/sms-delivery?restaurantId=${restaurantId}&channel=whatsapp`,
      ),
    );

    expect(response.status).toBe(200);
    expect(listSmsDeliveryAttemptsForRestaurantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId,
        channel: 'whatsapp',
      }),
    );
    expect(getSmsDeliveryAttemptsSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId,
        channel: 'whatsapp',
      }),
    );
  });

  it('rejects an invalid channel filter', async () => {
    const response = await GET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/sms-delivery?restaurantId=${restaurantId}&channel=telegram`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: 'Invalid query' });
    expect(listSmsDeliveryAttemptsForRestaurantMock).not.toHaveBeenCalled();
  });

  it('defaults channel to all when omitted', async () => {
    const response = await GET(
      new NextRequest(`https://app.nabatable.com/api/ops/sms-delivery?restaurantId=${restaurantId}`),
    );

    expect(response.status).toBe(200);
    expect(listSmsDeliveryAttemptsForRestaurantMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'all' }),
    );
  });
});
