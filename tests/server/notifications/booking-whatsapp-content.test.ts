import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBookingManageShortUrlMock = vi.hoisted(() => vi.fn());
const createReviewShortUrlMock = vi.hoisted(() => vi.fn());
const dispatchMobileNotificationMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const reviewTemplate = vi.hoisted(() => ({ value: 'HX-review-v1' as string | null }));

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
          get reviewRequest() {
            return reviewTemplate.value;
          },
          managerSummary: null,
        },
      },
    },
  },
}));

vi.mock('@/server/bookings/short-link', () => ({
  createBookingManageShortUrl: createBookingManageShortUrlMock,
  createReviewShortUrl: createReviewShortUrlMock,
}));

vi.mock('@/server/notifications/mobile', () => ({
  completeClaimedSmsAttempt: vi.fn(),
  dispatchMobileNotification: dispatchMobileNotificationMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { dispatchBookingReviewWhatsApp } from '@/server/notifications/booking-whatsapp-content';
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
  whatsapp_consent_actor_id: null,
  whatsapp_consent_phone: '+447700900123',
  whatsapp_consent_source: 'guest_reserve',
  whatsapp_consent_version: 'booking-plus-review-v2',
  whatsapp_opt_in: true,
} as const;

const reviewBooking = {
  ...booking,
  status: 'completed',
} as const;

function mockVenue(overrides: Readonly<Record<string, unknown>> = {}): void {
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
              email_send_review_request: true,
              google_review_url: 'https://g.page/r/example/review',
              ...overrides,
            },
            error: null,
          }),
        })),
      })),
    })),
  });
}

describe('booking WhatsApp content', () => {
  beforeEach(() => {
    createBookingManageShortUrlMock.mockReset();
    createReviewShortUrlMock.mockReset();
    dispatchMobileNotificationMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    dispatchMobileNotificationMock.mockResolvedValue({ kind: 'whatsapp_accepted' });
    reviewTemplate.value = 'HX-review-v1';
    createReviewShortUrlMock.mockResolvedValue('https://go.nabatable.com/r/review-token');
    mockVenue();
  });

  it('passes only the trusted short-link suffix to the confirmation native action @contract', async () => {
    // Given
    createBookingManageShortUrlMock.mockResolvedValue('https://go.nabatable.com/m/secure-token');

    // When
    await sendGuestBookingConfirmationSms(booking as never);

    // Then
    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappTemplateId: 'HX-confirmation-v3',
        whatsappVariables: expect.objectContaining({
          '4': 'https://go.nabatable.com/m/secure-token',
          '5': 'm/secure-token',
        }),
      }),
      expect.any(Object),
    );
  });

  it('passes only the trusted short-link suffix to the update native action @contract', async () => {
    // Given
    createBookingManageShortUrlMock.mockResolvedValue('https://go.nabatable.com/m/update-token');

    // When
    await sendGuestBookingUpdateSms(booking as never);

    // Then
    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappTemplateId: 'HX-update-v4',
        whatsappVariables: expect.objectContaining({
          '4': 'https://go.nabatable.com/m/update-token',
          '5': 'm/update-token',
        }),
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
  ])('uses SMS when the native action is not canonical: %s', async (manageUrl) => {
    // Given
    createBookingManageShortUrlMock.mockResolvedValue(manageUrl);

    // When
    await sendGuestBookingConfirmationSms(booking as never);

    // Then
    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappTemplateId: null }),
      expect.any(Object),
    );
  });

  it('dispatches the review template with the purpose-scoped native action @contract', async () => {
    // Given
    dispatchMobileNotificationMock.mockResolvedValue({ kind: 'whatsapp_accepted' });

    // When
    const result = await dispatchBookingReviewWhatsApp(
      reviewBooking as never,
      reviewBooking.restaurant_id,
    );

    // Then
    expect(result).toEqual({ kind: 'whatsapp_accepted' });
    expect(createReviewShortUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: reviewBooking.id,
        restaurantId: reviewBooking.restaurant_id,
        destinationUrl: 'https://g.page/r/example/review',
      }),
    );
    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      {
        bookingId: reviewBooking.id,
        logicalKey: `${reviewBooking.id}:booking_review_request`,
        notificationType: 'booking_review_request',
        recipientPhone: reviewBooking.customer_phone,
        restaurantId: reviewBooking.restaurant_id,
        whatsappEligible: true,
        whatsappTemplateId: 'HX-review-v1',
        whatsappVariables: {
          '1': 'The Old Crown Girton',
          '2': 'r/review-token',
        },
      },
      expect.objectContaining({ sendSms: expect.any(Function) }),
    );
  });

  it.each([
    { label: 'version 1 consent', patch: { whatsapp_consent_version: 'booking-transactional-v1' } },
    { label: 'phone mismatch', patch: { whatsapp_consent_phone: '+447700900999' } },
    { label: 'not completed', patch: { status: 'confirmed' } },
    { label: 'tenant mismatch', patch: { restaurant_id: '33333333-3333-4333-8333-333333333333' } },
  ])('fails closed for $label', async ({ patch }) => {
    // Given
    const candidate = { ...reviewBooking, ...patch };

    // When
    const result = await dispatchBookingReviewWhatsApp(
      candidate as never,
      reviewBooking.restaurant_id,
    );

    // Then
    expect(result).toEqual({ kind: 'ineligible' });
    expect(dispatchMobileNotificationMock).not.toHaveBeenCalled();
  });

  it('skips both channels when the venue review preference is disabled @contract', async () => {
    // Given
    mockVenue({ email_send_review_request: false });

    // When
    const result = await dispatchBookingReviewWhatsApp(
      reviewBooking as never,
      reviewBooking.restaurant_id,
    );

    // Then
    expect(result).toEqual({ kind: 'ineligible' });
    expect(createReviewShortUrlMock).not.toHaveBeenCalled();
    expect(dispatchMobileNotificationMock).not.toHaveBeenCalled();
  });

  it('does not create a review link when the approved review template is absent @contract', async () => {
    // Given
    reviewTemplate.value = null;

    // When
    const result = await dispatchBookingReviewWhatsApp(
      reviewBooking as never,
      reviewBooking.restaurant_id,
    );

    // Then
    expect(result).toEqual({ kind: 'ineligible' });
    expect(createReviewShortUrlMock).not.toHaveBeenCalled();
    expect(dispatchMobileNotificationMock).not.toHaveBeenCalled();
  });

  it('reuses one logical key when the durable worker retries @contract', async () => {
    // Given
    dispatchMobileNotificationMock.mockResolvedValue({ kind: 'duplicate' });

    // When
    const first = await dispatchBookingReviewWhatsApp(
      reviewBooking as never,
      reviewBooking.restaurant_id,
    );
    const retry = await dispatchBookingReviewWhatsApp(
      reviewBooking as never,
      reviewBooking.restaurant_id,
    );

    // Then
    expect([first, retry]).toEqual([{ kind: 'duplicate' }, { kind: 'duplicate' }]);
    expect(dispatchMobileNotificationMock).toHaveBeenCalledTimes(2);
    expect(dispatchMobileNotificationMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ logicalKey: `${reviewBooking.id}:booking_review_request` }),
    );
    expect(dispatchMobileNotificationMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ logicalKey: `${reviewBooking.id}:booking_review_request` }),
    );
  });

  it.each([
    'https://go.nabatable.com/m/booking-token',
    'https://go.nabatable.com.evil.example/r/review-token',
    'https://go.nabatable.com/r/review-token?source=whatsapp',
  ])('retries an invalid short-link service response: %s', async (shortUrl) => {
    // Given
    createReviewShortUrlMock.mockResolvedValue(shortUrl);

    // When
    await expect(
      dispatchBookingReviewWhatsApp(reviewBooking as never, reviewBooking.restaurant_id),
    ).rejects.toThrow('Review short-link infrastructure is unavailable.');
    expect(dispatchMobileNotificationMock).not.toHaveBeenCalled();
  });

  it('surfaces short-link transport failure for durable retry before provider attempt @contract', async () => {
    // Given
    createReviewShortUrlMock.mockResolvedValue(null);

    await expect(
      dispatchBookingReviewWhatsApp(reviewBooking as never, reviewBooking.restaurant_id),
    ).rejects.toThrow('Review short-link infrastructure is unavailable.');
    expect(dispatchMobileNotificationMock).not.toHaveBeenCalled();
  });

  it('skips an unsafe venue review destination without retrying infrastructure @contract', async () => {
    // Given
    mockVenue({ google_review_url: 'https://evil.example/review' });

    // When
    const result = await dispatchBookingReviewWhatsApp(
      reviewBooking as never,
      reviewBooking.restaurant_id,
    );

    // Then
    expect(result).toEqual({ kind: 'ineligible' });
    expect(createReviewShortUrlMock).not.toHaveBeenCalled();
  });

  it('uses the exact attributed consent predicate for lifecycle WhatsApp @contract', async () => {
    // Given
    createBookingManageShortUrlMock.mockResolvedValue('https://go.nabatable.com/m/secure-token');
    const forgedConsent = {
      ...booking,
      whatsapp_consent_source: 'forged_source',
    };

    // When
    await sendGuestBookingConfirmationSms(forgedConsent as never);

    // Then
    expect(dispatchMobileNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappEligible: false }),
      expect.any(Object),
    );
  });
});
