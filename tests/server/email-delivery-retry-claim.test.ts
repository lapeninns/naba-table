import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({ rpc: rpcMock }),
}));
vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import { EmailRecipientSuppressedError } from '@/libs/resend';
import {
  EmailDeliveryRetryError,
  retryEmailDeliveryLogEntry,
  type EmailDeliveryLogEntry,
} from '@/server/emails/email-delivery-log';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const DELIVERY_LOG_ID = '22222222-2222-4222-8222-222222222222';

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
  bookingId: 'booking-1',
  emailType: 'created',
  templateType: 'confirmation',
};

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
    const [, , , options] = resend.mock.calls[0];
    expect(resend).toHaveBeenCalledWith('booking-1', 'created', 'confirmation', {
      idempotencyKey: expect.any(String),
    });
    const key = (options as { idempotencyKey: string }).idempotencyKey;
    expect(key.startsWith('booking-email-retry:')).toBe(true);
    expect(Buffer.from(key.split(':')[1], 'base64url').toString()).toBe(`${DELIVERY_LOG_ID}|2`);
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

  it('reports a provider failure as SEND_FAILED and frees the claim for another try', async () => {
    mockClaim(claimed);
    const resend = vi
      .fn()
      .mockRejectedValue(new Error('Resend API error (application_error): upstream down'));

    const error = await retryEmailDeliveryLogEntry({
      deliveryLogId: DELIVERY_LOG_ID,
      restaurantId: RESTAURANT_ID,
      resendBookingEmail: resend,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmailDeliveryRetryError);
    expect(error).toMatchObject({ code: 'SEND_FAILED' });
    expect((error as Error).message).not.toContain('upstream');
    expect(completeCall()).toMatchObject({ p_outcome: 'failed' });
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
