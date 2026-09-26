import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({ rpc: rpcMock }),
}));
vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import { EmailRecipientSuppressedError, ResendSendError } from '@/libs/resend';
import {
  buildEmailDeliveryRetryIdempotencyKey,
  EmailDeliveryRetryError,
  retryEmailDeliveryLogEntry,
  type EmailDeliveryLogEntry,
} from '@/server/emails/email-delivery-log';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const DELIVERY_LOG_ID = '22222222-2222-4222-8222-222222222222';
const SIBLING_LOG_ID = '33333333-3333-4333-8333-333333333333';
const MESSAGE_ID = 'message-1';

const sentEntry: EmailDeliveryLogEntry = {
  id: 'log-new',
  bookingId: 'booking-1',
  restaurantId: RESTAURANT_ID,
  reviewRequestId: null,
  emailType: 'created',
  templateType: 'confirmation',
  recipientEmail: 'guest@example.com',
  messageId: 'message-2',
  status: 'sent',
  provider: 'resend',
  occurredAt: '2026-09-26T10:00:00.000Z',
  error: null,
  metadata: null,
};

function mockClaim(claim: Record<string, unknown>) {
  rpcMock.mockImplementation(async (name: string) => {
    if (name === 'claim_email_delivery_retry_v1') return { data: claim, error: null };
    if (name === 'complete_email_delivery_retry_v1') return { data: true, error: null };
    throw new Error(`unexpected rpc ${name}`);
  });
}

function completeCall() {
  const call = rpcMock.mock.calls.find(([name]) => name === 'complete_email_delivery_retry_v1');
  return call?.[1] as Record<string, unknown> | undefined;
}

const claimed = {
  outcome: 'claimed',
  retryAttempt: 2,
  deliveryLogId: DELIVERY_LOG_ID,
  messageId: MESSAGE_ID,
  bookingId: 'booking-1',
  emailType: 'created',
  templateType: 'confirmation',
};

function sentKey(resend: ReturnType<typeof vi.fn>, call = 0): string {
  return (resend.mock.calls[call][3] as { idempotencyKey: string }).idempotencyKey;
}

describe('retryEmailDeliveryLogEntry', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    recordObservabilityEventMock.mockReset().mockResolvedValue(undefined);
  });

  it('claims the entry, sends with a per-attempt idempotency key and records the outcome', async () => {
    mockClaim(claimed);
    const resend = vi.fn().mockResolvedValue(sentEntry);

    const result = await retryEmailDeliveryLogEntry({
      deliveryLogId: DELIVERY_LOG_ID,
      restaurantId: RESTAURANT_ID,
      resendBookingEmail: resend,
    });

    expect(rpcMock).toHaveBeenCalledWith('claim_email_delivery_retry_v1', {
      p_delivery_log_id: DELIVERY_LOG_ID,
      p_restaurant_id: RESTAURANT_ID,
    });
    expect(resend).toHaveBeenCalledWith('booking-1', 'created', 'confirmation', {
      idempotencyKey: expect.any(String),
    });
    const key = sentKey(resend);
    expect(key).toMatch(/^booking-email-retry:[A-Za-z0-9_-]{43}$/);
    expect(key).toBe(
      buildEmailDeliveryRetryIdempotencyKey({
        restaurantId: RESTAURANT_ID,
        messageId: MESSAGE_ID,
        retryAttempt: 2,
      }),
    );
    expect(completeCall()).toEqual({
      p_delivery_log_id: DELIVERY_LOG_ID,
      p_restaurant_id: RESTAURANT_ID,
      p_retry_attempt: 2,
      p_outcome: 'sent',
      p_retry_delivery_log_id: 'log-new',
    });
    expect(result).toEqual({ status: 'sent', retryAttempt: 2, deliveryLogEntry: sentEntry });
  });

  it.each([
    ['not_found', 'NOT_FOUND'],
    ['not_retryable', 'NOT_RETRYABLE'],
    ['missing_booking', 'MISSING_BOOKING'],
    ['in_progress', 'RETRY_IN_PROGRESS'],
    ['already_retried', 'ALREADY_RETRIED'],
  ])('maps claim outcome %s to %s without sending', async (outcome, code) => {
    mockClaim({ outcome });
    const resend = vi.fn();

    await expect(
      retryEmailDeliveryLogEntry({
        deliveryLogId: DELIVERY_LOG_ID,
        restaurantId: RESTAURANT_ID,
        resendBookingEmail: resend,
      }),
    ).rejects.toMatchObject({ name: 'EmailDeliveryRetryError', code });
    expect(resend).not.toHaveBeenCalled();
  });

  it('releases the claim as failed and reports a suppressed recipient', async () => {
    mockClaim(claimed);
    const resend = vi.fn().mockRejectedValue(new EmailRecipientSuppressedError(['x@example.com']));

    await expect(
      retryEmailDeliveryLogEntry({
        deliveryLogId: DELIVERY_LOG_ID,
        restaurantId: RESTAURANT_ID,
        resendBookingEmail: resend,
      }),
    ).rejects.toMatchObject({ code: 'RECIPIENT_SUPPRESSED' });
    expect(completeCall()).toMatchObject({ p_outcome: 'failed', p_retry_attempt: 2 });
  });

  it('reports a definitive provider rejection as SEND_FAILED and frees the claim for a new key', async () => {
    mockClaim(claimed);
    const resend = vi
      .fn()
      .mockRejectedValue(
        new ResendSendError({ name: 'rate_limit_exceeded', message: 'slow down', statusCode: 429 }),
      );

    const error = await retryEmailDeliveryLogEntry({
      deliveryLogId: DELIVERY_LOG_ID,
      restaurantId: RESTAURANT_ID,
      resendBookingEmail: resend,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmailDeliveryRetryError);
    expect(error).toMatchObject({ code: 'SEND_FAILED' });
    expect((error as Error).message).not.toContain('slow down');
    expect(completeCall()).toMatchObject({ p_outcome: 'failed' });
  });

  it.each([
    [
      'network failure or timeout',
      new ResendSendError({
        name: 'application_error',
        message: 'Unable to fetch data.',
        statusCode: null,
      }),
    ],
    [
      'provider 5xx',
      new ResendSendError({
        name: 'internal_server_error',
        message: 'upstream down',
        statusCode: 500,
      }),
    ],
    ['thrown non-provider error', new Error('socket hang up')],
  ])(
    'records an ambiguous %s as unknown and reuses the same provider key on the next retry',
    async (_label, failure) => {
      // The DB claim hands back the same attempt after an 'unknown' completion (tests/db regression).
      mockClaim(claimed);
      const resend = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(sentEntry);

      const first = await retryEmailDeliveryLogEntry({
        deliveryLogId: DELIVERY_LOG_ID,
        restaurantId: RESTAURANT_ID,
        resendBookingEmail: resend,
      }).catch((caught: unknown) => caught);

      expect(first).toMatchObject({ name: 'EmailDeliveryRetryError', code: 'SEND_UNCONFIRMED' });
      expect((first as Error).message).not.toContain('upstream');
      expect(completeCall()).toMatchObject({ p_outcome: 'unknown', p_retry_attempt: 2 });

      await retryEmailDeliveryLogEntry({
        deliveryLogId: DELIVERY_LOG_ID,
        restaurantId: RESTAURANT_ID,
        resendBookingEmail: resend,
      });

      expect(resend).toHaveBeenCalledTimes(2);
      expect(sentKey(resend, 1)).toBe(sentKey(resend, 0));
    },
  );

  it('treats a provider 409 idempotency conflict on a taken-over attempt as already sent, not another unknown', async () => {
    // Attempt 2 timed out (unknown). The takeover reuses attempt 2 and its key, but the email is
    // rendered again (fresh manage-link token), so Resend answers 409 invalid_idempotent_request:
    // it already holds a request under this key. That must end the loop, not record unknown again.
    mockClaim(claimed);
    const resend = vi
      .fn()
      .mockRejectedValueOnce(
        new ResendSendError({ name: 'application_error', message: 'timeout', statusCode: null }),
      )
      .mockRejectedValueOnce(
        new ResendSendError({
          name: 'invalid_idempotent_request',
          message: 'Same idempotency key used with a different request payload.',
          statusCode: 409,
        }),
      );

    await retryEmailDeliveryLogEntry({
      deliveryLogId: DELIVERY_LOG_ID,
      restaurantId: RESTAURANT_ID,
      resendBookingEmail: resend,
    }).catch(() => undefined);
    rpcMock.mockClear();

    const second = await retryEmailDeliveryLogEntry({
      deliveryLogId: DELIVERY_LOG_ID,
      restaurantId: RESTAURANT_ID,
      resendBookingEmail: resend,
    });

    expect(sentKey(resend, 1)).toBe(sentKey(resend, 0));
    expect(second).toEqual({
      status: 'sent',
      retryAttempt: 2,
      deliveryLogEntry: null,
      providerDeduplicated: true,
    });
    expect(completeCall()).toMatchObject({
      p_outcome: 'sent',
      p_retry_attempt: 2,
      p_retry_delivery_log_id: null,
    });
  });

  it('keeps a concurrent idempotent request (original still in flight) as unknown', async () => {
    mockClaim(claimed);
    const resend = vi.fn().mockRejectedValue(
      new ResendSendError({
        name: 'concurrent_idempotent_requests',
        message: 'in progress',
        statusCode: 409,
      }),
    );

    await expect(
      retryEmailDeliveryLogEntry({
        deliveryLogId: DELIVERY_LOG_ID,
        restaurantId: RESTAURANT_ID,
        resendBookingEmail: resend,
      }),
    ).rejects.toMatchObject({ code: 'SEND_UNCONFIRMED' });
    expect(completeCall()).toMatchObject({ p_outcome: 'unknown' });
  });

  it('completes the claim on the row the DB returned when a sibling event holds it', async () => {
    mockClaim({ ...claimed, deliveryLogId: SIBLING_LOG_ID });
    const resend = vi.fn().mockResolvedValue(sentEntry);

    await retryEmailDeliveryLogEntry({
      deliveryLogId: DELIVERY_LOG_ID,
      restaurantId: RESTAURANT_ID,
      resendBookingEmail: resend,
    });

    expect(completeCall()).toMatchObject({ p_delivery_log_id: SIBLING_LOG_ID, p_outcome: 'sent' });
    // The key is per message, so clicking either event row yields the same key for one attempt.
    expect(sentKey(resend)).toBe(
      buildEmailDeliveryRetryIdempotencyKey({
        restaurantId: RESTAURANT_ID,
        messageId: MESSAGE_ID,
        retryAttempt: 2,
      }),
    );
  });

  it('scopes the provider key by tenant and never truncates it', () => {
    const base = { messageId: 'x'.repeat(400), retryAttempt: 1 };
    const a = buildEmailDeliveryRetryIdempotencyKey({ restaurantId: RESTAURANT_ID, ...base });
    const b = buildEmailDeliveryRetryIdempotencyKey({ restaurantId: SIBLING_LOG_ID, ...base });
    const c = buildEmailDeliveryRetryIdempotencyKey({
      restaurantId: RESTAURANT_ID,
      ...base,
      retryAttempt: 2,
    });
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a.length).toBeLessThan(100);
  });

  it('keeps an explicit booking error code from the send callback', async () => {
    mockClaim(claimed);
    const resend = vi
      .fn()
      .mockRejectedValue(new EmailDeliveryRetryError('MISSING_BOOKING', 'Booking missing.'));

    await expect(
      retryEmailDeliveryLogEntry({
        deliveryLogId: DELIVERY_LOG_ID,
        restaurantId: RESTAURANT_ID,
        resendBookingEmail: resend,
      }),
    ).rejects.toMatchObject({ code: 'MISSING_BOOKING' });
  });
});
