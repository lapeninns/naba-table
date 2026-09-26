import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { GuardError } from '@/server/auth/guards';
import {
  EmailDeliveryLogUnavailableError,
  EmailDeliveryRetryError,
} from '@/server/emails/email-delivery-log';
import { POST } from '@/src/app/api/ops/email-delivery/retry/route';

import type * as GuardsModule from '@/server/auth/guards';
import type * as DeliveryLogModule from '@/server/emails/email-delivery-log';

const requireSessionMock = vi.hoisted(() => vi.fn());
const requireRestaurantMemberMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const retryEmailDeliveryLogEntryMock = vi.hoisted(() => vi.fn());
const resendBookingEmailFromDeliveryLogMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', async () => {
  const actual = await vi.importActual<typeof GuardsModule>('@/server/auth/guards');
  return {
    ...actual,
    requireSession: requireSessionMock,
    requireRestaurantMember: requireRestaurantMemberMock,
  };
});

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/emails/email-delivery-log', async () => {
  const actual = await vi.importActual<typeof DeliveryLogModule>(
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

const CSRF_TOKEN = 'email-retry-csrf-token';
const RESTAURANT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const FIXTURE_DELIVERY_LOG_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_DELIVERY_LOG_ID = '22222222-2222-4222-8222-222222222222';
const DELIVERED_DELIVERY_LOG_ID = '33333333-3333-4333-8333-333333333333';
const SUCCESS_DELIVERY_LOG_ID = '44444444-4444-4444-8444-444444444444';
const UNAVAILABLE_DELIVERY_LOG_ID = '55555555-5555-4555-8555-555555555555';
const SIMULATE_DELIVERY_LOG_ID = '66666666-6666-4666-8666-666666666666';

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

describe('POST /api/ops/email-delivery/retry', () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    requireRestaurantMemberMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    retryEmailDeliveryLogEntryMock.mockReset();
    resendBookingEmailFromDeliveryLogMock.mockReset();
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);

    requireSessionMock.mockResolvedValue({
      supabase: { mock: true },
      user: { id: 'user-1' },
    });
    requireRestaurantMemberMock.mockResolvedValue(undefined);
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await POST(buildRequest({ deliveryLogId: 'not-a-uuid' }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(retryEmailDeliveryLogEntryMock).not.toHaveBeenCalled();
  });

  it('returns 400 when restaurantId is missing', async () => {
    const response = await POST(
      buildRequest({ deliveryLogId: '22222222-2222-4222-8222-222222222222' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('returns uniform 404 when membership verification fails', async () => {
    requireRestaurantMemberMock.mockRejectedValue(
      new GuardError({ status: 403, code: 'FORBIDDEN', message: 'Forbidden' }),
    );

    const response = await POST(
      buildRequest({
        restaurantId: RESTAURANT_ID,
        deliveryLogId: OTHER_DELIVERY_LOG_ID,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ code: 'NOT_FOUND' });
    expect(retryEmailDeliveryLogEntryMock).not.toHaveBeenCalled();
  });

  it('returns 401 when session is missing during membership check', async () => {
    requireRestaurantMemberMock.mockRejectedValue(
      new GuardError({ status: 401, code: 'UNAUTHENTICATED', message: 'Sign in required' }),
    );

    const response = await POST(
      buildRequest({
        restaurantId: RESTAURANT_ID,
        deliveryLogId: OTHER_DELIVERY_LOG_ID,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('returns 409 when the delivery log is not retryable', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(
      new EmailDeliveryRetryError('NOT_RETRYABLE', 'Only failed or bounced emails can be retried.'),
    );

    const response = await POST(
      buildRequest({
        restaurantId: RESTAURANT_ID,
        deliveryLogId: DELIVERED_DELIVERY_LOG_ID,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ code: 'NOT_RETRYABLE' });
  });

  it('returns 404 when the delivery log is not found for the restaurant', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(
      new EmailDeliveryRetryError('NOT_FOUND', 'Email delivery log entry not found.'),
    );

    const response = await POST(
      buildRequest({
        restaurantId: RESTAURANT_ID,
        deliveryLogId: DELIVERED_DELIVERY_LOG_ID,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns a new delivery log entry on success and scopes lookup by restaurant', async () => {
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'booking-1', restaurant_id: RESTAURANT_ID },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    resendBookingEmailFromDeliveryLogMock.mockResolvedValue({
      id: 'log-2',
      bookingId: 'booking-1',
      restaurantId: RESTAURANT_ID,
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
    retryEmailDeliveryLogEntryMock.mockImplementation(async ({ resendBookingEmail }) => ({
      status: 'sent',
      retryAttempt: 3,
      deliveryLogEntry: await resendBookingEmail('booking-1', 'created', 'booking_confirmation', {
        idempotencyKey: 'booking-email-retry:key-3',
      }),
    }));

    const response = await POST(
      buildRequest({
        restaurantId: RESTAURANT_ID,
        deliveryLogId: SUCCESS_DELIVERY_LOG_ID,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      status: 'sent',
      retryAttempt: 3,
      deliveryLogEntry: expect.objectContaining({
        id: 'log-2',
        bookingId: 'booking-1',
        restaurantId: RESTAURANT_ID,
      }),
    });
    expect(requireRestaurantMemberMock).toHaveBeenCalledWith({
      supabase: { mock: true },
      userId: 'user-1',
      restaurantId: RESTAURANT_ID,
    });
    expect(retryEmailDeliveryLogEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryLogId: SUCCESS_DELIVERY_LOG_ID,
        restaurantId: RESTAURANT_ID,
      }),
    );
    expect(resendBookingEmailFromDeliveryLogMock).toHaveBeenCalledWith({
      booking: expect.objectContaining({ id: 'booking-1' }),
      emailType: 'created',
      templateType: 'booking_confirmation',
      idempotencyKey: 'booking-email-retry:key-3',
    });
  });

  it('returns 503 when the delivery log is unavailable', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(new EmailDeliveryLogUnavailableError());

    const response = await POST(
      buildRequest({
        restaurantId: RESTAURANT_ID,
        deliveryLogId: UNAVAILABLE_DELIVERY_LOG_ID,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ code: 'DELIVERY_LOG_UNAVAILABLE', retryable: true });
  });

  it('returns a deterministic simulated error when requested in dev/test validation flows', async () => {
    const response = await POST(
      buildRequest({
        restaurantId: RESTAURANT_ID,
        deliveryLogId: SIMULATE_DELIVERY_LOG_ID,
        simulateError: true,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      code: 'SIMULATED_RETRY_ERROR',
      error: 'Forced retry mutation error for dev/test validation.',
    });
    expect(retryEmailDeliveryLogEntryMock).not.toHaveBeenCalled();
  });

  it('returns 200 for retry-actions fixture ids without querying the delivery log', async () => {
    process.env.APP_ENV = 'test';

    const response = await POST(
      buildRequest({ restaurantId: RESTAURANT_ID, deliveryLogId: FIXTURE_DELIVERY_LOG_ID }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      deliveryLogEntry: expect.objectContaining({
        id: FIXTURE_DELIVERY_LOG_ID,
        bookingId: 'booking-fixture-failed',
        restaurantId: RESTAURANT_ID,
        status: 'sent',
        messageId: `${FIXTURE_DELIVERY_LOG_ID}:fixture-retry-success`,
        provider: 'fixture',
        metadata: expect.objectContaining({
          fixtureRetryRefetched: true,
          fixtureSyntheticSuccess: true,
        }),
      }),
    });
    expect(retryEmailDeliveryLogEntryMock).not.toHaveBeenCalled();
    expect(resendBookingEmailFromDeliveryLogMock).not.toHaveBeenCalled();
    expect(requireRestaurantMemberMock).toHaveBeenCalledWith({
      supabase: { mock: true },
      userId: 'user-1',
      restaurantId: RESTAURANT_ID,
    });
  });

  it('returns 409 RETRY_IN_PROGRESS when another resend already holds the claim', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(
      new EmailDeliveryRetryError('RETRY_IN_PROGRESS', 'This email is already being resent.'),
    );

    const response = await POST(
      buildRequest({ restaurantId: RESTAURANT_ID, deliveryLogId: DELIVERED_DELIVERY_LOG_ID }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'RETRY_IN_PROGRESS' });
  });

  it('returns 409 ALREADY_RETRIED for an email that was already resent', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(
      new EmailDeliveryRetryError('ALREADY_RETRIED', 'This email was already resent.'),
    );

    const response = await POST(
      buildRequest({ restaurantId: RESTAURANT_ID, deliveryLogId: DELIVERED_DELIVERY_LOG_ID }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'ALREADY_RETRIED' });
  });

  it('returns a retryable 502 SEND_FAILED without provider text when the send fails', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(
      new EmailDeliveryRetryError('SEND_FAILED', 'The email could not be sent.', {
        cause: new Error('Resend API error (application_error): secret upstream detail'),
      }),
    );

    const response = await POST(
      buildRequest({ restaurantId: RESTAURANT_ID, deliveryLogId: DELIVERED_DELIVERY_LOG_ID }),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({ code: 'SEND_FAILED', retryable: true });
    expect(JSON.stringify(payload)).not.toContain('upstream');
  });

  it('returns a generic 500 without raw error text for unexpected failures', async () => {
    retryEmailDeliveryLogEntryMock.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "email_delivery_log_pkey"'),
    );

    const response = await POST(
      buildRequest({ restaurantId: RESTAURANT_ID, deliveryLogId: DELIVERED_DELIVERY_LOG_ID }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(payload)).not.toContain('email_delivery_log');
  });
});
