import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendTwilioSmsMessageMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const recordSmsDeliveryLogMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    raw: {
      NEXT_PUBLIC_SITE_URL: 'https://nabatable.com',
      SITE_URL: 'https://nabatable.com',
      BASE_URL: 'https://nabatable.com',
    },
    app: { url: 'https://app.nabatable.com' },
    twilio: {
      accountSid: 'AC123',
      apiKeySid: 'SK123',
      apiKeySecret: 'secret',
      authToken: 'auth-token',
      messagingServiceSid: 'MG123',
      shortenUrls: false,
      configured: true,
    },
  },
}));

vi.mock('@/lib/twilio/sms', () => {
  return {
    mapTwilioMessageStatusToDeliveryStatus: (status: string | null | undefined) => {
      if (status === 'sent') return 'sent';
      if (status === 'delivered') return 'delivered';
      if (status === 'undelivered') return 'undelivered';
      if (status === 'failed') return 'failed';
      if (status === 'queued' || status === 'accepted' || status === 'sending') return 'queued';
      return null;
    },
    sendTwilioSmsMessage: sendTwilioSmsMessageMock,
  };
});

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/sms/delivery-log', () => ({
  recordSmsDeliveryLog: recordSmsDeliveryLogMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { sendGuestBookingCancellationSms } from '@/server/sms/bookings';

const booking = {
  id: '11111111-1111-4111-8111-111111111111',
  restaurant_id: '22222222-2222-4222-8222-222222222222',
  booking_date: '2026-05-10',
  start_time: '19:00:00',
  party_size: 2,
  customer_name: 'Guest Booker',
  customer_email: 'guest@example.com',
  customer_phone: '+44 7700 900123',
  reference: 'ABC12345',
  start_at: '2026-05-10T18:00:00.000Z',
} as const;

describe('sendGuestBookingCancellationSms observability', () => {
  beforeEach(() => {
    sendTwilioSmsMessageMock.mockReset();
    recordObservabilityEventMock.mockReset();
    recordSmsDeliveryLogMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    sendTwilioSmsMessageMock.mockResolvedValue({
      messageSid: 'SM123',
      status: 'sent',
    });
    recordObservabilityEventMock.mockResolvedValue(undefined);
    recordSmsDeliveryLogMock.mockResolvedValue({ id: 'log-1' });
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: booking.restaurant_id,
                name: 'The Old Crown Girton',
                timezone: 'Europe/London',
                contact_phone: '+441223277217',
              },
              error: null,
            }),
          })),
        })),
      })),
    });
  });

  it('redacts the recipient phone in observability but keeps the full send and log values', async () => {
    await sendGuestBookingCancellationSms(booking as never, {
      cancelledBy: 'customer',
      fetchImpl: vi.fn() as never,
    });

    expect(sendTwilioSmsMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '447700900123',
      }),
    );
    expect(recordSmsDeliveryLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientPhone: '447700900123',
      }),
    );
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'booking.cancellation_sms',
        eventType: 'sent',
        context: expect.objectContaining({
          messageSid: 'SM123',
          status: 'sent',
          to: '********0123',
        }),
      }),
    );
  });
});
