process.env.BASE_URL ??= 'http://localhost:3000';

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const getRouteHandlerSupabaseClientMock = vi.fn();
const getServiceSupabaseClientMock = vi.fn();
const fetchUserMembershipsMock = vi.fn();
const getEmailQueueMock = vi.fn();

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
  getServiceSupabaseClient: () => getServiceSupabaseClientMock(),
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: (...args: unknown[]) => fetchUserMembershipsMock(...args),
}));

vi.mock('@/server/queue/email', () => ({
  EMAIL_JOB_TYPES: [
    'request_received',
    'confirmation',
    'updated',
    'cancelled',
    'reminder_24h',
    'reminder_short',
    'review_request',
    'booking_rejected',
    'restaurant_cancellation',
  ],
  getEmailJobIdCandidates: (type: string, bookingId: string) => [`${type}-${bookingId}`],
  getEmailQueue: () => getEmailQueueMock(),
}));

const RESTAURANT_ID = '123e4567-e89b-12d3-a456-426614174000';

type BookingRow = {
  id: string;
  restaurant_id: string;
  start_at: string;
  end_at: string | null;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  restaurants?: { name: string | null } | null;
};

type DeliveryRow = {
  id: string;
  booking_id: string | null;
  restaurant_id: string | null;
  email_type: string | null;
  template_type: string | null;
  recipient_email: string;
  message_id: string;
  status: string;
  occurred_at: string | null;
  provider: string | null;
  error: string | null;
  bookings?: { start_at: string | null; status: string | null; customer_name: string | null } | null;
  restaurants?: { name: string | null } | null;
};

function createRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

function createRouteSupabaseStub(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null }, error: null }),
    },
  };
}

function createServiceSupabaseStub(params: {
  bookings?: BookingRow[];
  bookingsTotal?: number;
  deliveries?: DeliveryRow[];
  deliveriesTotal?: number;
}) {
  const bookings = params.bookings ?? [];
  const bookingsTotal = params.bookingsTotal ?? bookings.length;
  const deliveries = params.deliveries ?? [];
  const deliveriesTotal = params.deliveriesTotal ?? deliveries.length;

  const deliveryQuery = {
    eq: () => deliveryQuery,
    gte: () => deliveryQuery,
    lte: () => deliveryQuery,
    order: () => deliveryQuery,
    range: () => Promise.resolve({ data: deliveries, error: null, count: deliveriesTotal }),
  };

  return {
    from: (table: string) => {
      if (table === 'bookings') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => ({
                      range: () => Promise.resolve({ data: bookings, error: null, count: bookingsTotal }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'email_delivery_log') {
        return {
          select: () => deliveryQuery,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

beforeEach(() => {
  getRouteHandlerSupabaseClientMock.mockReset();
  getServiceSupabaseClientMock.mockReset();
  fetchUserMembershipsMock.mockReset();
  getEmailQueueMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('/api/ops/email-status', () => {
  it('returns 401 when unauthenticated', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(createRouteSupabaseStub(null));

    const response = await GET(createRequest('/api/ops/email-status'));

    expect(response.status).toBe(401);
  });

  it('returns empty when no memberships', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(createRouteSupabaseStub('user-1'));
    fetchUserMembershipsMock.mockResolvedValue([]);

    const response = await GET(createRequest('/api/ops/email-status'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toEqual([]);
    expect(body.pageInfo.total).toBe(0);
  });

  it('returns email status rows', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(createRouteSupabaseStub('user-1'));
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID }]);

    const bookings: BookingRow[] = [
      {
        id: 'booking-1',
        restaurant_id: RESTAURANT_ID,
        start_at: new Date().toISOString(),
        end_at: null,
        status: 'confirmed',
        customer_name: 'Jamie',
        customer_email: 'jamie@example.com',
        customer_phone: null,
        restaurants: { name: 'Test Restaurant' },
      },
    ];

    getServiceSupabaseClientMock.mockReturnValue(createServiceSupabaseStub({ bookings, bookingsTotal: 1 }));

    const job = {
      id: 'job-1',
      opts: { delay: 0 },
      timestamp: Date.now(),
      failedReason: null,
      getState: vi.fn().mockResolvedValue('waiting'),
    };

    getEmailQueueMock.mockReturnValue({
      getJob: vi.fn().mockResolvedValue(job),
    });

    const response = await GET(
      createRequest(`/api/ops/email-status?restaurantId=${RESTAURANT_ID}&type=confirmation`),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].entries).toHaveLength(1);
    expect(body.items[0].entries[0]).toMatchObject({
      type: 'confirmation',
      state: 'waiting',
      jobId: 'job-1',
    });
  });

  it('returns delivery events', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(createRouteSupabaseStub('user-1'));
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID }]);

    const deliveries: DeliveryRow[] = [
      {
        id: 'log-1',
        booking_id: 'booking-1',
        restaurant_id: RESTAURANT_ID,
        email_type: 'confirmation',
        template_type: 'created',
        recipient_email: 'jamie@example.com',
        message_id: 'msg-1',
        status: 'delivered',
        occurred_at: new Date().toISOString(),
        provider: 'resend',
        error: null,
        bookings: { start_at: new Date().toISOString(), status: 'confirmed', customer_name: 'Jamie' },
        restaurants: { name: 'Test Restaurant' },
      },
    ];

    getServiceSupabaseClientMock.mockReturnValue(
      createServiceSupabaseStub({ deliveries, deliveriesTotal: 1 }),
    );

    const response = await GET(
      createRequest(`/api/ops/email-status?restaurantId=${RESTAURANT_ID}&view=delivery`),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.view).toBe('delivery');
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      bookingId: 'booking-1',
      restaurantId: RESTAURANT_ID,
      emailType: 'confirmation',
      status: 'delivered',
      messageId: 'msg-1',
    });
  });
});
