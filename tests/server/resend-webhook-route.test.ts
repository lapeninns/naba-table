import { beforeEach, describe, expect, it, vi } from 'vitest';

const findLatestEmailDeliveryByMessageIdMock = vi.hoisted(() => vi.fn());
const recordEmailDeliveryLogMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const resendVerifyMock = vi.hoisted(() => vi.fn());
const suppressProfilesByEmailMock = vi.hoisted(() => vi.fn());
const addEmailToSuppressionListMock = vi.hoisted(() => vi.fn());
const recordReviewRequestEventMock = vi.hoisted(() => vi.fn());

vi.mock('svix', () => ({
  Webhook: vi.fn(function WebhookMock() {
    return { verify: resendVerifyMock };
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
    expect(resendVerifyMock).toHaveBeenCalledWith('{"type":"email.bounced"}', {
      'svix-id': 'msg_1',
      'svix-timestamp': '1710000000',
      'svix-signature': 'v1,sig',
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
    expect(suppressProfilesByEmailMock).toHaveBeenCalledWith('second@example.com');
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'webhook.resend',
        eventType: 'email_suppression.added',
        severity: 'warning',
        context: {
          reason: 'email.bounced',
          recipientCount: 2,
          matchedProfiles: 2,
          updatedProfiles: 2,
        },
      }),
    );
  });

  function signedRequest(payload: string) {
    return buildRequest(
      {
        'svix-id': 'msg_2',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,sig',
        'content-length': String(payload.length),
      },
      payload,
    );
  }

  it.each(['Permanent', 'permanent', 'hard'])(
    'suppresses every recipient of a %s bounce in both stores',
    async (bounceType) => {
      resendVerifyMock.mockReturnValue({
        type: 'email.bounced',
        created_at: '2026-05-16T12:00:00.000Z',
        data: {
          email_id: 'resend-message-2',
          to: ['one@example.com', 'two@example.com'],
          bounce: { type: bounceType, message: 'Mailbox does not exist' },
        },
      });

      const response = await POST(signedRequest('{"type":"email.bounced"}') as never);

      expect(response.status).toBe(200);
      for (const recipient of ['one@example.com', 'two@example.com']) {
        expect(suppressProfilesByEmailMock).toHaveBeenCalledWith(recipient);
        expect(addEmailToSuppressionListMock).toHaveBeenCalledWith(recipient, 'bounce', {
          via: 'resend-webhook',
          eventType: 'email.bounced',
        });
      }
    },
  );

  it.each(['Transient', 'Undetermined', undefined])(
    'records a %s bounce without suppressing the address',
    async (bounceType) => {
      resendVerifyMock.mockReturnValue({
        type: 'email.bounced',
        created_at: '2026-05-16T12:00:00.000Z',
        data: {
          email_id: 'resend-message-3',
          to: ['guest@example.com'],
          ...(bounceType ? { bounce: { type: bounceType, message: 'Mailbox full' } } : {}),
        },
      });

      const response = await POST(signedRequest('{"type":"email.bounced"}') as never);

      expect(response.status).toBe(200);
      expect(recordEmailDeliveryLogMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'bounced', recipientEmail: 'guest@example.com' }),
      );
      expect(suppressProfilesByEmailMock).not.toHaveBeenCalled();
      expect(addEmailToSuppressionListMock).not.toHaveBeenCalled();
      expect(recordObservabilityEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'email_suppression.skipped_non_permanent_bounce' }),
      );
    },
  );

  it('suppresses every recipient of a complaint', async () => {
    resendVerifyMock.mockReturnValue({
      type: 'email.complained',
      created_at: '2026-05-16T12:00:00.000Z',
      data: { email_id: 'resend-message-4', to: ['one@example.com', 'two@example.com'] },
    });

    const response = await POST(signedRequest('{"type":"email.complained"}') as never);

    expect(response.status).toBe(200);
    expect(addEmailToSuppressionListMock).toHaveBeenCalledWith('one@example.com', 'complaint', {
      via: 'resend-webhook',
      eventType: 'email.complained',
    });
    expect(addEmailToSuppressionListMock).toHaveBeenCalledWith('two@example.com', 'complaint', {
      via: 'resend-webhook',
      eventType: 'email.complained',
    });
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
