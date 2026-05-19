import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSessionMock = vi.hoisted(() => vi.fn());
const listUserRestaurantMembershipsMock = vi.hoisted(() => vi.fn());
const requireRestaurantMemberMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const retryEmailDeliveryLogEntryMock = vi.hoisted(() => vi.fn());
const resendBookingEmailFromDeliveryLogMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', async () => {
  const actual =
    await vi.importActual<typeof import('@/server/auth/guards')>('@/server/auth/guards');
  return {
    ...actual,
    requireSession: requireSessionMock,
    listUserRestaurantMemberships: listUserRestaurantMembershipsMock,
    requireRestaurantMember: requireRestaurantMemberMock,
  };
});

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/emails/email-delivery-log', async () => {
  const actual = await vi.importActual<typeof import('@/server/emails/email-delivery-log')>(
    '@/server/emails/email-delivery-log',
  );
  return {
    ...actual,
    retryEmailDeliveryLogEntry: retryEmailDeliveryLogEntryMock,
  };
});

vi.mock('@/server/emails/bookings', () => ({
  resendBookingEmailFromDeliveryLog: resendBookingEmailFromDeliveryLogMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

import { GuardError } from '@/server/auth/guards';
import {
  EmailDeliveryLogUnavailableError,
  EmailDeliveryRetryError,
} from '@/server/emails/email-delivery-log';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { POST } from '@/src/app/api/ops/email-delivery/retry/route';

const CSRF_TOKEN = 'email-retry-csrf-token';

function buildRequest(body: unknown) {
  return new NextRequest('https://www.nabatable.com/api/ops/email-delivery/retry', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [CSRF_HEADER_NAME]: CSRF_TOKEN,
      cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

const FIXTURE_DELIVERY_LOG_ID = '11111111-1111-4111-8111-111111111111';

describe('POST /api/ops/email-delivery/retry', () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    listUserRestaurantMembershipsMock.mockReset();
    requireRestaurantMemberMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    retryEmailDeliveryLogEntryMock.mockReset();
    resendBookingEmailFromDeliveryLogMock.mockReset();
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);

    requireSessionMock.mockResolvedValue({
      supabase: { mock: true },
      user: { id: 'user-1' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([
      { restaurant_id: '11111111-1111-1111-1111-111111111111' },
    ]);
    requireRestaurantMemberMock.mockResolvedValue(undefined);
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await POST(buildRequest({ deliveryLogId: 'not-a-uuid' }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(retryEmailDeliveryLogEntryMock).not.toHaveBeenCalled();
  });

  it('returns 401 when booking membership verification fails during retry', async () => {
    requireRestaurantMemberMock.mockRejectedValue(
      new GuardError({ status: 401, code: 'UNAUTHENTICATED', message: 'Sign in required' }),
    );
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'booking-unauth', restaurant_id: '66666666-6666-4666-8666-666666666666' },
              error: null,
            }),
          }),
        }),
      }),
    });
    retryEmailDeliveryLogEntryMock.mockImplementation(async ({ resendBookingEmail }) =>
      resendBookingEmail('booking-unauth', 'created', 'booking_confirmation'),
    );

    const response = await POST(
      buildRequest({ deliveryLogId: '22222222-2222-4222-8222-222222222222' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' });
  });

  it('returns 400 when the delivery log is not retryable', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(
      new EmailDeliveryRetryError('NOT_RETRYABLE', 'Only failed or bounced emails can be retried.'),
    );

    const response = await POST(
      buildRequest({ deliveryLogId: '33333333-3333-4333-8333-333333333333' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, code: 'NOT_RETRYABLE' });
  });

  it('returns a new delivery log entry on success and enforces restaurant membership via booking context', async () => {
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'booking-1', restaurant_id: '44444444-4444-4444-8444-444444444444' },
              error: null,
            }),
          }),
        }),
      }),
    });
    resendBookingEmailFromDeliveryLogMock.mockResolvedValue({
      id: 'log-2',
      bookingId: 'booking-1',
      restaurantId: '44444444-4444-4444-8444-444444444444',
      emailType: 'created',
      templateType: 'booking_confirmation',
      recipientEmail: 'guest@example.com',
      messageId: 'message-2',
      status: 'sent',
      provider: 'mock',
      occurredAt: '2026-03-24T00:00:00.000Z',
      error: null,
      metadata: { subject: 'Booking Confirmed - Test Venue' },
    });
    retryEmailDeliveryLogEntryMock.mockImplementation(async ({ resendBookingEmail }) =>
      resendBookingEmail('booking-1', 'created', 'booking_confirmation'),
    );

    const response = await POST(
      buildRequest({ deliveryLogId: '44444444-4444-4444-8444-444444444444' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      deliveryLogEntry: expect.objectContaining({
        id: 'log-2',
        bookingId: 'booking-1',
        restaurantId: '44444444-4444-4444-8444-444444444444',
      }),
    });
    expect(requireRestaurantMemberMock).toHaveBeenCalledWith({
      supabase: { mock: true },
      userId: 'user-1',
      restaurantId: '44444444-4444-4444-8444-444444444444',
    });
    expect(resendBookingEmailFromDeliveryLogMock).toHaveBeenCalledWith({
      booking: expect.objectContaining({ id: 'booking-1' }),
      emailType: 'created',
      templateType: 'booking_confirmation',
    });
  });

  it('returns 503 when the delivery log is unavailable', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(new EmailDeliveryLogUnavailableError());

    const response = await POST(
      buildRequest({ deliveryLogId: '55555555-5555-4555-8555-555555555555' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ ok: false, code: 'DELIVERY_LOG_UNAVAILABLE' });
  });

  it('returns a deterministic simulated error when requested in dev/test validation flows', async () => {
    const response = await POST(
      buildRequest({
        deliveryLogId: '66666666-6666-4666-8666-666666666666',
        simulateError: true,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      ok: false,
      code: 'SIMULATED_RETRY_ERROR',
      error: 'Forced retry mutation error for dev/test validation.',
    });
    expect(retryEmailDeliveryLogEntryMock).not.toHaveBeenCalled();
  });

  it('returns 200 for retry-actions fixture ids even when the booking lookup falls back to fixture metadata', async () => {
    process.env.APP_ENV = 'test';
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    });
    resendBookingEmailFromDeliveryLogMock.mockResolvedValue({
      id: 'log-fixture-success-fallback',
      bookingId: 'booking-fixture-failed',
      restaurantId: '11111111-1111-1111-1111-111111111111',
      emailType: 'created',
      templateType: 'booking_confirmation',
      recipientEmail: 'retry.failed@example.com',
      messageId: 'message-fixture-success-fallback',
      status: 'sent',
      provider: 'mock',
      occurredAt: '2026-03-24T10:03:00.000Z',
      error: null,
      metadata: { subject: 'Fixture failed retry candidate' },
    });

    const response = await POST(buildRequest({ deliveryLogId: FIXTURE_DELIVERY_LOG_ID }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      deliveryLogEntry: expect.objectContaining({
        id: FIXTURE_DELIVERY_LOG_ID,
        bookingId: 'booking-fixture-failed',
        status: 'sent',
      }),
    });
    expect(retryEmailDeliveryLogEntryMock).not.toHaveBeenCalled();
    expect(requireRestaurantMemberMock).toHaveBeenCalledWith({
      supabase: { mock: true },
      userId: 'user-1',
      restaurantId: '11111111-1111-1111-1111-111111111111',
    });
    expect(resendBookingEmailFromDeliveryLogMock).not.toHaveBeenCalled();
  });

  it('allows retry-actions fixture delivery log ids to succeed without querying the backing table', async () => {
    process.env.APP_ENV = 'test';
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'booking-fixture-failed',
                restaurant_id: '11111111-1111-1111-1111-111111111111',
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    resendBookingEmailFromDeliveryLogMock.mockResolvedValue({
      id: 'log-fixture-success',
      bookingId: 'booking-fixture-failed',
      restaurantId: '11111111-1111-1111-1111-111111111111',
      emailType: 'created',
      templateType: 'booking_confirmation',
      recipientEmail: 'retry.failed@example.com',
      messageId: 'message-fixture-success',
      status: 'sent',
      provider: 'mock',
      occurredAt: '2026-03-24T10:03:00.000Z',
      error: null,
      metadata: { subject: 'Fixture failed retry candidate' },
    });

    const response = await POST(buildRequest({ deliveryLogId: FIXTURE_DELIVERY_LOG_ID }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      deliveryLogEntry: expect.objectContaining({
        id: FIXTURE_DELIVERY_LOG_ID,
        bookingId: 'booking-fixture-failed',
        status: 'sent',
      }),
    });
    expect(retryEmailDeliveryLogEntryMock).not.toHaveBeenCalled();
    expect(resendBookingEmailFromDeliveryLogMock).not.toHaveBeenCalled();
  });

  it('maps retry-actions fixture retries to a deterministic sent delivery-log entry for live refetches', async () => {
    process.env.APP_ENV = 'test';
    const response = await POST(buildRequest({ deliveryLogId: FIXTURE_DELIVERY_LOG_ID }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      deliveryLogEntry: expect.objectContaining({
        id: FIXTURE_DELIVERY_LOG_ID,
        status: 'sent',
        recipientEmail: 'retry.failed@example.com',
        messageId: `${FIXTURE_DELIVERY_LOG_ID}:fixture-retry-success`,
        provider: 'fixture',
        metadata: expect.objectContaining({
          fixtureRetryRefetched: true,
          fixtureSyntheticSuccess: true,
        }),
      }),
    });
    expect(resendBookingEmailFromDeliveryLogMock).not.toHaveBeenCalled();
  });
});
