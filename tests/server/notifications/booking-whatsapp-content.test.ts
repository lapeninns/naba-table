import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBookingManageShortUrlMock = vi.hoisted(() => vi.fn());
const dispatchMobileNotificationMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    app: { url: 'https://app.nabatable.com' },
    security: {
      sessionRecoveryAccessTokenSecret: 'test-secret',
      sessionRecoveryAccessTokenTtlSeconds: 900,
    },
    twilio: {
      accountSid: 'AC123',
      apiKeySid: 'SK123',
      apiKeySecret: 'secret',
      authToken: 'auth-token',
      configured: true,
      messagingServiceSid: 'MG123',
      shortenUrls: false,
      whatsapp: {
        configured: true,
        sender: '+447700900000',
        templates: {
          bookingConfirmation: 'HX-confirmation-v3',
          bookingUpdate: 'HX-update-v4',
          bookingCancellation: 'HX-cancellation-v2',
          restaurantCancellation: 'HX-restaurant-cancellation-v2',
          managerSummary: null,
        },
      },
    },
  },
}));

vi.mock('@/server/bookings/short-link', () => ({
  createBookingManageShortUrl: createBookingManageShortUrlMock,
}));

vi.mock('@/server/notifications/mobile', () => ({
  completeClaimedSmsAttempt: vi.fn(),
  dispatchMobileNotification: dispatchMobileNotificationMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { sendGuestBookingConfirmationSms, sendGuestBookingUpdateSms } from '@/server/sms/bookings';

const booking = {
  id: '11111111-1111-4111-8111-111111111111',
  restaurant_id: '22222222-2222-4222-8222-222222222222',
  booking_date: '2026-07-18',
  start_time: '19:00:00',
  party_size: 4,
  customer_email: 'guest@example.com',
  customer_phone: '+447700900123',
  reference: 'NBT-1234',
  start_at: '2026-07-18T18:00:00.000Z',
  updated_at: '2026-07-12T17:00:00.000Z',
  status: 'confirmed',
  whatsapp_consent_phone: '+447700900123',
  whatsapp_opt_in: true,
} as const;

describe('booking WhatsApp content', () => {
  beforeEach(() => {
    createBookingManageShortUrlMock.mockReset();
    dispatchMobileNotificationMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    dispatchMobileNotificationMock.mockResolvedValue('whatsapp');
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

  it('passes only the trusted short-link suffix to the WhatsApp URL action', async () => {
    createBookingManageShortUrlMock.mockResolvedValue('https://go.nabatable.com/m/secure-token');

    await sendGuestBookingConfirmationSms(booking as never);

    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappTemplateId: 'HX-confirmation-v3',
        whatsappVariables: {
          '1': 'The Old Crown Girton',
          '2': 'Sat, 18 Jul 2026 at 19:00 | 4 guests',
          '3': 'Reference: NBT-1234',
          '4': 'https://go.nabatable.com/m/secure-token',
          '5': 'm/secure-token',
        },
      }),
      expect.any(Object),
    );
  });

  it('uses the same native booking action contract for booking updates', async () => {
    createBookingManageShortUrlMock.mockResolvedValue('https://go.nabatable.com/m/update-token');

    await sendGuestBookingUpdateSms(booking as never);

    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappTemplateId: 'HX-update-v4',
        whatsappVariables: {
          '1': 'The Old Crown Girton',
          '2': 'Sat, 18 Jul 2026 at 19:00 | 4 guests',
          '3': 'Reference: NBT-1234',
          '4': 'https://go.nabatable.com/m/update-token',
          '5': 'm/update-token',
        },
      }),
      expect.any(Object),
    );
  });

  it('uses SMS when the secure short-link action is unavailable', async () => {
    createBookingManageShortUrlMock.mockResolvedValue(
      'https://nabatable.com/bookings/recover?access_token=long-token',
    );

    await sendGuestBookingConfirmationSms(booking as never);

    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappTemplateId: null,
      }),
      expect.any(Object),
    );
  });

  it.each([
    'http://go.nabatable.com/m/token',
    'https://go.nabatable.com.evil.example/m/token',
    'https://user@go.nabatable.com/m/token',
    'https://go.nabatable.com/m/token?source=whatsapp',
    'https://go.nabatable.com/',
    'not-a-url',
  ])('rejects a non-canonical WhatsApp booking action: %s', async (manageUrl) => {
    createBookingManageShortUrlMock.mockResolvedValue(manageUrl);

    await sendGuestBookingConfirmationSms(booking as never);

    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappTemplateId: null }),
      expect.any(Object),
    );
  });
});
