import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import {
  getSmsDeliveryAttemptsSummary,
  hasRecentSmsDelivery,
  listSmsDeliveryAttemptsForRestaurant,
  listSmsDeliveryEventsForBooking,
  recordSmsDeliveryLog,
} from '@/server/sms/delivery-log';

function createRecentDeliveryQuery(result: {
  data: Array<{ id: string }> | null;
  error: { message: string } | null;
}) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: vi.fn((onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected)),
  };
  const from = vi.fn(() => builder);

  return { client: { from }, spies: { from, ...builder } };
}

describe('hasRecentSmsDelivery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T09:00:00.000Z'));
    getServiceSupabaseClientMock.mockReset();
    recordObservabilityEventMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('checks recent confirmation delivery rows using normalized recipient phone', async () => {
    const { client, spies } = createRecentDeliveryQuery({
      data: [{ id: 'sms-log-1' }],
      error: null,
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    await expect(
      hasRecentSmsDelivery({
        bookingId: 'booking-1',
        smsType: 'booking_confirmation',
        recipientPhone: '+44 7700 900000',
        withinMs: 365 * 24 * 60 * 60 * 1000,
      }),
    ).resolves.toBe(true);

    expect(spies.from).toHaveBeenCalledWith('sms_delivery_log');
    expect(spies.select).toHaveBeenCalledWith('id');
    expect(spies.eq).toHaveBeenCalledWith('booking_id', 'booking-1');
    expect(spies.eq).toHaveBeenCalledWith('sms_type', 'booking_confirmation');
    expect(spies.eq).toHaveBeenCalledWith('recipient_phone', '447700900000');
    expect(spies.in).toHaveBeenCalledWith('status', ['queued', 'sent', 'delivered']);
    expect(spies.gte).toHaveBeenCalledWith('occurred_at', '2025-05-10T09:00:00.000Z');
    expect(spies.limit).toHaveBeenCalledWith(1);
  });

  it('returns false without querying when an explicit recipient phone is invalid', async () => {
    await expect(
      hasRecentSmsDelivery({
        bookingId: 'booking-1',
        smsType: 'booking_confirmation',
        recipientPhone: '   ',
      }),
    ).resolves.toBe(false);

    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('fails open when the recent delivery lookup errors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client } = createRecentDeliveryQuery({
      data: null,
      error: { message: 'database unavailable' },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    await expect(
      hasRecentSmsDelivery({
        bookingId: 'booking-1',
        smsType: 'booking_confirmation',
      }),
    ).resolves.toBe(false);

    expect(warnSpy).toHaveBeenCalledWith('[sms][delivery-log] recent-check failed', {
      message: 'database unavailable',
    });
  });
});

function createUpsertThenReadbackClient(params: {
  upsertResult: {
    data: Record<string, unknown> | null;
    error: { code?: string; message: string } | null;
  };
  existingRow?: Record<string, unknown> | null;
  readbackError?: { message: string } | null;
}) {
  const upsertMaybeSingle = vi.fn().mockResolvedValue(params.upsertResult);
  const upsertBuilder = {
    upsert: vi.fn(() => upsertBuilder),
    select: vi.fn(() => ({ maybeSingle: upsertMaybeSingle })),
  };

  const readbackBuilder = {
    select: vi.fn(() => readbackBuilder),
    eq: vi.fn(() => readbackBuilder),
    order: vi.fn(() => readbackBuilder),
    limit: vi.fn(() => readbackBuilder),
    maybeSingle: vi.fn().mockResolvedValue({
      data: params.existingRow ?? null,
      error: params.readbackError ?? null,
    }),
  };

  const from = vi.fn().mockReturnValueOnce(upsertBuilder).mockReturnValueOnce(readbackBuilder);

  return { client: { from }, spies: { from, upsertBuilder, upsertMaybeSingle, readbackBuilder } };
}

const SAMPLE_SMS_ROW = {
  id: 'evt-1',
  booking_id: 'booking-1',
  restaurant_id: 'restaurant-1',
  sms_type: 'booking_confirmation',
  recipient_phone: '447700900000',
  message_sid: 'SM123',
  status: 'sent',
  provider: 'twilio',
  provider_event_id: null,
  occurred_at: '2026-05-10T09:00:00.000Z',
  error: null,
  metadata: { source: 'twilio_status_webhook' },
};

describe('recordSmsDeliveryLog', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    recordObservabilityEventMock.mockReset();
    recordObservabilityEventMock.mockResolvedValue(undefined);
  });

  it('records a new delivery event via idempotent upsert', async () => {
    const { client, spies } = createUpsertThenReadbackClient({
      upsertResult: { data: SAMPLE_SMS_ROW, error: null },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    await expect(
      recordSmsDeliveryLog({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        smsType: 'booking_confirmation',
        recipientPhone: '+44 7700 900000',
        messageSid: 'SM123',
        status: 'sent',
        provider: 'twilio',
      }),
    ).resolves.toMatchObject({ id: 'evt-1', messageSid: 'SM123', status: 'sent' });

    expect(spies.upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ message_sid: 'SM123', recipient_phone: '447700900000' }),
      { onConflict: 'message_sid,recipient_phone,status', ignoreDuplicates: true },
    );
    // A successful insert returns the row directly — no readback query.
    expect(spies.from).toHaveBeenCalledTimes(1);
    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
  });

  it('treats duplicate message/recipient/status rows as idempotent replay', async () => {
    const { client, spies } = createUpsertThenReadbackClient({
      // ON CONFLICT DO NOTHING skips the insert: no row, no error.
      upsertResult: { data: null, error: null },
      existingRow: SAMPLE_SMS_ROW,
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    await expect(
      recordSmsDeliveryLog({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        smsType: 'booking_confirmation',
        recipientPhone: '+44 7700 900000',
        messageSid: 'SM123',
        status: 'sent',
        provider: 'twilio',
      }),
    ).resolves.toMatchObject({
      id: 'evt-1',
      recipientPhone: '447700900000',
      messageSid: 'SM123',
      status: 'sent',
    });

    expect(spies.readbackBuilder.eq).toHaveBeenCalledWith('message_sid', 'SM123');
    expect(spies.readbackBuilder.eq).toHaveBeenCalledWith('recipient_phone', '447700900000');
    expect(spies.readbackBuilder.eq).toHaveBeenCalledWith('status', 'sent');
    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
  });

  it('@observability still records warnings for non-duplicate upsert failures', async () => {
    const upsertMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST500', message: 'database unavailable' },
    });
    const upsertBuilder = {
      upsert: vi.fn(() => upsertBuilder),
      select: vi.fn(() => ({ maybeSingle: upsertMaybeSingle })),
    };
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => upsertBuilder),
    });

    await expect(
      recordSmsDeliveryLog({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        smsType: 'booking_confirmation',
        recipientPhone: '+44 7700 900000',
        messageSid: 'SM123',
        status: 'sent',
        provider: 'twilio',
      }),
    ).resolves.toBeNull();

    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'sms.delivery_log',
        eventType: 'insert_failed',
        severity: 'warning',
        context: expect.objectContaining({
          status: 'sent',
          provider: 'twilio',
          bookingId: 'booking-1',
          restaurantId: 'restaurant-1',
          error: 'database unavailable',
        }),
      }),
    );
  });
});

function createBookingDeliveryListClient(params: {
  smsResult: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  };
  mobileResult: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  };
}) {
  function createListBuilder(result: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  }) {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve(result)),
    };
    return builder;
  }

  const smsBuilder = createListBuilder(params.smsResult);
  const mobileBuilder = createListBuilder(params.mobileResult);
  const from = vi.fn((table: string) => {
    if (table === 'sms_delivery_log') return smsBuilder;
    if (table === 'mobile_notification_attempts') return mobileBuilder;
    throw new Error(`Unexpected table ${table}`);
  });

  return { client: { from }, spies: { from, smsBuilder, mobileBuilder } };
}

describe('listSmsDeliveryEventsForBooking', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  it('merges WhatsApp mobile attempts with SMS log events and sorts newest first', async () => {
    const { client, spies } = createBookingDeliveryListClient({
      smsResult: {
        data: [
          {
            ...SAMPLE_SMS_ROW,
            id: 'sms-evt-1',
            message_sid: 'SM-SMS',
            occurred_at: '2026-05-10T09:00:00.000Z',
            status: 'delivered',
          },
        ],
        error: null,
      },
      mobileResult: {
        data: [
          {
            id: 'attempt-wa-1',
            channel: 'whatsapp',
            fallback_for_attempt_id: null,
            provider: 'twilio',
            provider_message_id: 'MM-WA',
            recipient_phone: '447700900000',
            status: 'delivered',
            updated_at: '2026-05-10T10:00:00.000Z',
            mobile_notifications: {
              id: 'notif-1',
              booking_id: 'booking-1',
              notification_type: 'booking_confirmation',
              restaurant_id: 'restaurant-1',
            },
          },
        ],
        error: null,
      },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    const events = await listSmsDeliveryEventsForBooking({ bookingId: 'booking-1', limit: 20 });

    expect(spies.from).toHaveBeenCalledWith('sms_delivery_log');
    expect(spies.from).toHaveBeenCalledWith('mobile_notification_attempts');
    expect(spies.mobileBuilder.eq).toHaveBeenCalledWith(
      'mobile_notifications.booking_id',
      'booking-1',
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 'attempt-wa-1',
      channel: 'whatsapp',
      messageSid: 'MM-WA',
      logicalNotificationId: 'notif-1',
    });
    expect(events[1]).toMatchObject({
      id: 'sms-evt-1',
      channel: 'sms',
      messageSid: 'SM-SMS',
    });
  });

  it('keeps SMS log events when the mobile ledger query fails', async () => {
    const { client } = createBookingDeliveryListClient({
      smsResult: {
        data: [SAMPLE_SMS_ROW],
        error: null,
      },
      mobileResult: {
        data: null,
        error: { message: 'relation does not exist' },
      },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    const events = await listSmsDeliveryEventsForBooking({ bookingId: 'booking-1' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 'evt-1', channel: 'sms', messageSid: 'SM123' });
  });

  it('throws SmsDeliveryLogUnavailableError when the SMS delivery log is missing', async () => {
    const { client } = createBookingDeliveryListClient({
      smsResult: {
        data: null,
        error: { code: '42P01', message: 'relation "sms_delivery_log" does not exist' },
      },
      mobileResult: { data: [], error: null },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    await expect(listSmsDeliveryEventsForBooking({ bookingId: 'booking-1' })).rejects.toMatchObject(
      { name: 'SmsDeliveryLogUnavailableError' },
    );
  });

  it('preserves WhatsApp providerStatus and synthesizes a claimed→current timeline', async () => {
    const { client } = createBookingDeliveryListClient({
      smsResult: { data: [], error: null },
      mobileResult: {
        data: [
          {
            id: 'attempt-wa-read',
            channel: 'whatsapp',
            fallback_for_attempt_id: null,
            provider: 'twilio',
            provider_message_id: 'MM-READ',
            recipient_phone: '447700900000',
            status: 'read',
            occurred_at: '2026-05-10T09:00:00.000Z',
            updated_at: '2026-05-10T10:00:00.000Z',
            mobile_notifications: {
              id: 'notif-read',
              booking_id: 'booking-1',
              notification_type: 'booking_confirmation',
              restaurant_id: 'restaurant-1',
            },
          },
        ],
        error: null,
      },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    const events = await listSmsDeliveryEventsForBooking({ bookingId: 'booking-1' });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 'attempt-wa-read',
      status: 'delivered',
      providerStatus: 'read',
      occurredAt: '2026-05-10T10:00:00.000Z',
    });
    expect(events[1]).toMatchObject({
      id: 'attempt-wa-read:claimed',
      status: 'queued',
      providerStatus: 'claimed',
      occurredAt: '2026-05-10T09:00:00.000Z',
    });
  });
});

function createRestaurantFeedClient(params: {
  smsResult: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  };
  mobileResult: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  };
  bookingsResult?: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  };
}) {
  function createSmsBuilder(result: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  }) {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve(result)),
    };
    return builder;
  }

  function createMobileBuilder(result: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  }) {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve(result)),
    };
    return builder;
  }

  function createBookingsBuilder(result: {
    data: Array<Record<string, unknown>> | null;
    error: { code?: string; message: string } | null;
  }) {
    const builder = {
      select: vi.fn(() => builder),
      in: vi.fn(() => Promise.resolve(result)),
    };
    return builder;
  }

  const smsBuilder = createSmsBuilder(params.smsResult);
  const mobileBuilder = createMobileBuilder(params.mobileResult);
  const bookingsBuilder = createBookingsBuilder(
    params.bookingsResult ?? { data: [], error: null },
  );
  const from = vi.fn((table: string) => {
    if (table === 'sms_delivery_log') return smsBuilder;
    if (table === 'mobile_notification_attempts') return mobileBuilder;
    if (table === 'bookings') return bookingsBuilder;
    throw new Error(`Unexpected table ${table}`);
  });

  return { client: { from }, spies: { from, smsBuilder, mobileBuilder, bookingsBuilder } };
}

describe('listSmsDeliveryAttemptsForRestaurant + summary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
    getServiceSupabaseClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mobileWhatsAppRow = {
    id: 'attempt-wa-1',
    channel: 'whatsapp',
    fallback_for_attempt_id: null,
    provider: 'twilio',
    provider_message_id: 'MM-WA',
    recipient_phone: '+447700900001',
    status: 'read',
    occurred_at: '2026-05-10T09:00:00.000Z',
    updated_at: '2026-05-10T10:00:00.000Z',
    mobile_notifications: {
      id: 'notif-1',
      booking_id: 'booking-wa',
      notification_type: 'booking_confirmation',
      restaurant_id: 'restaurant-1',
    },
  };

  const mobileFallbackRow = {
    id: 'attempt-sms-fallback',
    channel: 'sms',
    fallback_for_attempt_id: 'attempt-wa-failed',
    provider: 'twilio',
    provider_message_id: 'SM-FALLBACK',
    recipient_phone: '+447700900002',
    status: 'delivered',
    occurred_at: '2026-05-10T09:30:00.000Z',
    updated_at: '2026-05-10T09:45:00.000Z',
    mobile_notifications: {
      id: 'notif-2',
      booking_id: 'booking-fb',
      notification_type: 'booking_confirmation',
      restaurant_id: 'restaurant-1',
    },
  };

  it('populates mobile timeline events and exposes providerStatus for WhatsApp read', async () => {
    const { client } = createRestaurantFeedClient({
      smsResult: { data: [], error: null },
      mobileResult: { data: [mobileWhatsAppRow], error: null },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    const result = await listSmsDeliveryAttemptsForRestaurant({
      restaurantId: 'restaurant-1',
      range: '7d',
    });

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      channel: 'whatsapp',
      currentStatus: 'delivered',
      currentProviderStatus: 'read',
      messageSid: 'MM-WA',
    });
    expect(result.attempts[0]?.events).toHaveLength(2);
    expect(result.attempts[0]?.events.map((event) => event.providerStatus)).toEqual([
      'claimed',
      'read',
    ]);
  });

  it('filters restaurant feed by channel=whatsapp', async () => {
    const { client } = createRestaurantFeedClient({
      smsResult: {
        data: [
          {
            ...SAMPLE_SMS_ROW,
            id: 'sms-1',
            message_sid: 'SM-PLAIN',
            recipient_phone: '+447700900099',
            status: 'delivered',
            occurred_at: '2026-05-10T11:00:00.000Z',
          },
        ],
        error: null,
      },
      mobileResult: { data: [mobileWhatsAppRow, mobileFallbackRow], error: null },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    const result = await listSmsDeliveryAttemptsForRestaurant({
      restaurantId: 'restaurant-1',
      range: '7d',
      channel: 'whatsapp',
    });

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.channel).toBe('whatsapp');
  });

  it('splits summary counts across WhatsApp, SMS, and fallbacks', async () => {
    const { client } = createRestaurantFeedClient({
      smsResult: {
        data: [
          {
            ...SAMPLE_SMS_ROW,
            id: 'sms-1',
            message_sid: 'SM-PLAIN',
            recipient_phone: '+447700900099',
            status: 'sent',
            occurred_at: '2026-05-10T11:00:00.000Z',
          },
        ],
        error: null,
      },
      mobileResult: { data: [mobileWhatsAppRow, mobileFallbackRow], error: null },
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    const summary = await getSmsDeliveryAttemptsSummary({
      restaurantId: 'restaurant-1',
      range: '7d',
    });

    expect(summary).toMatchObject({
      total: 3,
      whatsappCount: 1,
      smsCount: 2,
      fallbackCount: 1,
      delivered: 2,
      sent: 1,
    });
  });
});
