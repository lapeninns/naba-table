import { beforeEach, describe, expect, it, vi } from 'vitest';

const findLatestEmailDeliveryByMessageIdMock = vi.hoisted(() => vi.fn());
const recordEmailDeliveryLogMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const resendVerifyMock = vi.hoisted(() => vi.fn());
const suppressProfilesByEmailMock = vi.hoisted(() => vi.fn());
const addEmailToSuppressionListMock = vi.hoisted(() => vi.fn());
const recordReviewRequestEventMock = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: vi.fn(function ResendMock() {
    return {
      webhooks: {
        verify: resendVerifyMock,
      },
    };
  }),
}));

vi.mock('@/server/emails/email-delivery-log', () => ({
  findLatestEmailDeliveryByMessageId: findLatestEmailDeliveryByMessageIdMock,
  recordEmailDeliveryLog: recordEmailDeliveryLogMock,
}));

vi.mock('@/server/emails/recipient-suppression', () => ({
  suppressProfilesByEmail: suppressProfilesByEmailMock,
}));

vi.mock('@/server/emails/email-suppression-list', () => ({
  addEmailToSuppressionList: addEmailToSuppressionListMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/reviews/journeys', () => ({
  recordReviewRequestEvent: recordReviewRequestEventMock,
}));

process.env.RESEND_WEBHOOK_SECRET = 'webhook-secret';

import { POST } from '@/src/app/api/webhook/resend/route';

function buildRequest(headers: HeadersInit = {}, payload = '{}') {
  return {
    headers: new Headers(headers),
    text: vi.fn().mockResolvedValue(payload),
  };
}

describe('resend webhook route', () => {
  beforeEach(() => {
    findLatestEmailDeliveryByMessageIdMock.mockReset();
    recordEmailDeliveryLogMock.mockReset();
    recordObservabilityEventMock.mockReset();
    resendVerifyMock.mockReset();
    suppressProfilesByEmailMock.mockReset();
    recordReviewRequestEventMock.mockReset();
    process.env.RESEND_WEBHOOK_SECRET = 'webhook-secret';
    findLatestEmailDeliveryByMessageIdMock.mockResolvedValue({
      bookingId: 'booking-1',
      restaurantId: 'restaurant-1',
      emailType: 'created',
      templateType: 'booking_confirmation',
      reviewRequestId: null,
    });
    recordEmailDeliveryLogMock.mockResolvedValue({ id: 'delivery-log-1' });
    recordObservabilityEventMock.mockResolvedValue(undefined);
    suppressProfilesByEmailMock.mockResolvedValue({
      matchedProfiles: 1,
      updatedProfiles: 1,
    });
    addEmailToSuppressionListMock.mockReset();
    addEmailToSuppressionListMock.mockResolvedValue({ suppressed: true });
  });

  it('records review open events against the linked journey', async () => {
    findLatestEmailDeliveryByMessageIdMock.mockResolvedValue({
      bookingId: 'booking-1',
      restaurantId: 'restaurant-1',
      reviewRequestId: 'review-request-1',
      emailType: 'review_request',
      templateType: 'review_request',
    });
    recordReviewRequestEventMock.mockResolvedValue(true);
    resendVerifyMock.mockReturnValue({
      type: 'email.opened',
      created_at: '2026-09-05T10:05:00.000Z',
      data: { email_id: 'resend-message-1', to: ['guest@example.com'] },
    });
    const payload = '{"type":"email.opened"}';

    const response = await POST(
      buildRequest(
        {
          'svix-id': 'event-open-1',
          'svix-timestamp': '1710000000',
          'svix-signature': 'v1,sig',
          'content-length': String(payload.length),
        },
        payload,
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(recordReviewRequestEventMock).toHaveBeenCalledWith({
      channel: 'email',
      eventType: 'opened',
      idempotencyKey: 'resend:event-open-1:review-request-1',
      occurredAt: '2026-09-05T10:05:00.000Z',
      provider: 'resend',
      providerEventId: 'resend-message-1',
      restaurantId: 'restaurant-1',
      reviewRequestId: 'review-request-1',
    });
  });

  it('rejects missing verification headers before reading the body', async () => {
    const request = buildRequest();

    const response = await POST(request as never);

    expect(response.status).toBe(401);
    expect(request.text).not.toHaveBeenCalled();
  });

  it('rejects oversized signed webhook bodies before reading the body', async () => {
    const request = buildRequest({
      'svix-id': 'msg_1',
      'svix-timestamp': '1710000000',
      'svix-signature': 'v1,sig',
      'content-length': String(300 * 1024),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(413);
    expect(request.text).not.toHaveBeenCalled();
  });

  it('rejects signed webhook bodies without content length before reading the body', async () => {
    const request = buildRequest({
      'svix-id': 'msg_1',
      'svix-timestamp': '1710000000',
      'svix-signature': 'v1,sig',
    });

    const response = await POST(request as never);

    expect(response.status).toBe(411);
    expect(request.text).not.toHaveBeenCalled();
  });

  it('rejects streamed webhook bodies that exceed an understated content length', async () => {
    const response = await POST(
      new Request('https://www.nabatable.com/api/webhook/resend', {
        method: 'POST',
        headers: {
          'svix-id': 'msg_1',
          'svix-timestamp': '1710000000',
          'svix-signature': 'v1,sig',
          'content-length': '1',
        },
        body: 'x'.repeat(300 * 1024),
      }) as never,
    );

    expect(response.status).toBe(413);
    expect(resendVerifyMock).not.toHaveBeenCalled();
  });

  it('records signed delivery events for every recipient without leaking recipient metadata', async () => {
    resendVerifyMock.mockReturnValue({
      type: 'email.bounced',
      created_at: '2026-05-16T12:00:00.000Z',
      data: {
        email_id: 'resend-message-1',
        to: ['guest@example.com', 'second@example.com'],
        bounce: { type: 'hard', message: 'Mailbox unavailable' },
      },
    });

    const request = buildRequest(
      {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,sig',
        'content-length': String('{"type":"email.bounced"}'.length),
      },
      '{"type":"email.bounced"}',
    );

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(resendVerifyMock).toHaveBeenCalledWith({
      payload: '{"type":"email.bounced"}',
      headers: {
        id: 'msg_1',
        timestamp: '1710000000',
        signature: 'v1,sig',
      },
      webhookSecret: 'webhook-secret',
    });
    expect(recordEmailDeliveryLogMock).toHaveBeenCalledTimes(2);
    expect(recordEmailDeliveryLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        emailType: 'created',
        templateType: 'booking_confirmation',
        recipientEmail: 'guest@example.com',
        messageId: 'resend-message-1',
        status: 'bounced',
        provider: 'resend',
        error: 'Mailbox unavailable',
        metadata: { eventType: 'email.bounced' },
      }),
    );
    expect(recordEmailDeliveryLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'second@example.com',
        metadata: { eventType: 'email.bounced' },
      }),
    );
    expect(suppressProfilesByEmailMock).toHaveBeenCalledWith('guest@example.com');
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'webhook.resend',
        eventType: 'email_suppression.added',
        severity: 'warning',
        context: {
          reason: 'email.bounced',
          matchedProfiles: 1,
          updatedProfiles: 1,
        },
      }),
    );
  });

  it('rejects invalid signatures after reading the signed body and before side effects', async () => {
    const error = new Error('invalid signature');
    error.name = 'WebhookVerificationError';
    resendVerifyMock.mockImplementation(() => {
      throw error;
    });
    const request = buildRequest(
      {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,bad',
        'content-length': String('{"type":"email.delivered"}'.length),
      },
      '{"type":"email.delivered"}',
    );

    const response = await POST(request as never);

    expect(response.status).toBe(401);
    expect(request.text).toHaveBeenCalledOnce();
    expect(recordEmailDeliveryLogMock).not.toHaveBeenCalled();
    expect(suppressProfilesByEmailMock).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
  });
});
