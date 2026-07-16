import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import { hasRecentSmsDelivery, listSmsDeliveryEventsForBooking, recordSmsDeliveryLog } from '@/server/sms/delivery-log';

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
});
