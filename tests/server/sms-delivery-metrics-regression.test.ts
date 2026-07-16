import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import {
  getSmsDeliveryAttemptsSummary,
  listSmsDeliveryAttemptsForRestaurant,
} from '@/server/sms/delivery-log';

type QueryResult = {
  readonly data: readonly Record<string, unknown>[];
  readonly error: null;
};

function createReadBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function createBookingsBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    in: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function createClient(input: {
  readonly mobileRows: readonly Record<string, unknown>[];
  readonly smsRows: readonly Record<string, unknown>[];
}) {
  const smsBuilder = createReadBuilder({ data: input.smsRows, error: null });
  const mobileBuilder = createReadBuilder({ data: input.mobileRows, error: null });
  const bookingsBuilder = createBookingsBuilder({
    data: [
      {
        booking_date: '2026-07-16',
        customer_name: 'Guest',
        end_time: '20:30:00',
        id: 'booking-1',
        party_size: 2,
        reference: 'REF123',
        start_time: '19:00:00',
      },
    ],
    error: null,
  });

  return {
    from: vi.fn((table: string) => {
      if (table === 'sms_delivery_log') return smsBuilder;
      if (table === 'mobile_notification_attempts') return mobileBuilder;
      if (table === 'bookings') return bookingsBuilder;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

const deliveredSmsRow = {
  booking_id: 'booking-1',
  error: null,
  id: 'sms-delivered',
  message_sid: 'SM-DUPLICATE',
  metadata: null,
  occurred_at: '2026-07-16T10:00:00.000Z',
  provider: 'twilio',
  provider_event_id: null,
  recipient_phone: '447700900001',
  restaurant_id: 'restaurant-1',
  sms_type: 'booking_confirmation',
  status: 'delivered',
};

const staleMobileSmsRow = {
  channel: 'sms',
  fallback_for_attempt_id: 'attempt-whatsapp',
  id: 'attempt-sms',
  mobile_notifications: {
    booking_id: 'booking-1',
    id: 'notification-1',
    notification_type: 'booking_confirmation',
    restaurant_id: 'restaurant-1',
  },
  occurred_at: '2026-07-16T09:00:00.000Z',
  provider: 'twilio',
  provider_message_id: 'SM-DUPLICATE',
  recipient_phone: '+447700900001',
  status: 'accepted',
  updated_at: '2026-07-16T09:00:00.000Z',
};

describe('SMS delivery dashboard metrics regression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));
    getServiceSupabaseClientMock.mockReset();
  });

  it('counts a dual-ledger SMS as one delivered physical attempt', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      createClient({
        mobileRows: [staleMobileSmsRow],
        smsRows: [deliveredSmsRow],
      }),
    );

    const summary = await getSmsDeliveryAttemptsSummary({
      range: '7d',
      restaurantId: 'restaurant-1',
    });

    expect(summary).toMatchObject({
      delivered: 1,
      deliveredRate: 1,
      fallbackCount: 1,
      queued: 0,
      smsCount: 1,
      total: 1,
    });
  });

  it('excludes genuinely in-flight attempts from the delivery-rate denominator', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      createClient({
        mobileRows: [
          {
            ...staleMobileSmsRow,
            channel: 'whatsapp',
            fallback_for_attempt_id: null,
            id: 'attempt-whatsapp-current',
            provider_message_id: 'WA-CURRENT',
            status: 'queued',
          },
        ],
        smsRows: [deliveredSmsRow],
      }),
    );

    const summary = await getSmsDeliveryAttemptsSummary({
      range: '7d',
      restaurantId: 'restaurant-1',
    });

    expect(summary).toMatchObject({
      delivered: 1,
      deliveredRate: 1,
      queued: 1,
      total: 2,
    });
  });

  it('keeps fallback lineage on the canonical delivered attempt', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      createClient({
        mobileRows: [staleMobileSmsRow],
        smsRows: [deliveredSmsRow],
      }),
    );

    const result = await listSmsDeliveryAttemptsForRestaurant({
      range: '7d',
      restaurantId: 'restaurant-1',
    });

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      currentStatus: 'delivered',
      fallbackForAttemptId: 'attempt-whatsapp',
      logicalNotificationId: 'notification-1',
      messageSid: 'SM-DUPLICATE',
    });
  });
});
