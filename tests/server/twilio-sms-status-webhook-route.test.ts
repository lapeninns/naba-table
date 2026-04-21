import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findLatestSmsDeliveryByMessageSidMock = vi.hoisted(() => vi.fn());
const recordSmsDeliveryLogMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    twilio: {
      authToken: 'auth-token',
    },
    app: {
      url: 'https://app.nabatable.com',
    },
  },
}));

vi.mock('@/server/sms/delivery-log', () => ({
  findLatestSmsDeliveryByMessageSid: findLatestSmsDeliveryByMessageSidMock,
  recordSmsDeliveryLog: recordSmsDeliveryLogMock,
}));

import { POST } from '@/src/app/api/webhook/twilio/sms-status/route';

function buildSignedRequest(params: {
  requestUrl: string;
  signedUrl: string;
  forwardedHost?: string;
  forwardedProto?: string;
  form?: URLSearchParams;
}) {
  const form =
    params.form ??
    new URLSearchParams({
      MessageSid: 'SM123',
      MessageStatus: 'delivered',
      To: '+447700900123',
      From: '+447700900456',
    });

  const sortedPairs = Array.from(form.entries()).sort(([a], [b]) => a.localeCompare(b));
  let signaturePayload = params.signedUrl;
  for (const [key, value] of sortedPairs) {
    signaturePayload += key + value;
  }

  const signature = createHmac('sha1', 'auth-token')
    .update(signaturePayload, 'utf8')
    .digest('base64');

  const headers = new Headers({
    'content-type': 'application/x-www-form-urlencoded',
    'x-twilio-signature': signature,
  });

  if (params.forwardedHost) {
    headers.set('x-forwarded-host', params.forwardedHost);
  }
  if (params.forwardedProto) {
    headers.set('x-forwarded-proto', params.forwardedProto);
  }

  return new NextRequest(params.requestUrl, {
    method: 'POST',
    headers,
    body: form.toString(),
  });
}

describe('POST /api/webhook/twilio/sms-status', () => {
  beforeEach(() => {
    findLatestSmsDeliveryByMessageSidMock.mockReset();
    recordSmsDeliveryLogMock.mockReset();
    findLatestSmsDeliveryByMessageSidMock.mockResolvedValue({
      bookingId: 'booking-1',
      restaurantId: 'restaurant-1',
      smsType: 'booking_confirmation',
    });
    recordSmsDeliveryLogMock.mockResolvedValue({ id: 'log-1' });
  });

  it('accepts a valid signature based on the forwarded public host', async () => {
    const response = await POST(
      buildSignedRequest({
        requestUrl: 'http://internal-host/api/webhook/twilio/sms-status',
        signedUrl: 'https://app.nabatable.com/api/webhook/twilio/sms-status',
        forwardedHost: 'app.nabatable.com',
        forwardedProto: 'https',
      }),
    );

    expect(response.status).toBe(200);
    expect(findLatestSmsDeliveryByMessageSidMock).toHaveBeenCalledWith({
      messageSid: 'SM123',
      recipientPhone: '+447700900123',
    });
    expect(recordSmsDeliveryLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        smsType: 'booking_confirmation',
        messageSid: 'SM123',
        recipientPhone: '+447700900123',
        status: 'delivered',
        provider: 'twilio',
      }),
    );
  });

  it('falls back to the configured app url when the request url is internal', async () => {
    const response = await POST(
      buildSignedRequest({
        requestUrl: 'http://internal-host/api/webhook/twilio/sms-status',
        signedUrl: 'https://app.nabatable.com/api/webhook/twilio/sms-status',
      }),
    );

    expect(response.status).toBe(200);
    expect(recordSmsDeliveryLogMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid signatures', async () => {
    const request = new NextRequest('https://app.nabatable.com/api/webhook/twilio/sms-status', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'not-valid',
      },
      body: new URLSearchParams({
        MessageSid: 'SM123',
        MessageStatus: 'delivered',
        To: '+447700900123',
      }).toString(),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(recordSmsDeliveryLogMock).not.toHaveBeenCalled();
  });
});
