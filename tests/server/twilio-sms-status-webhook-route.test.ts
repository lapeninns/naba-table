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

function buildUnreadableBodyRequest(headers: HeadersInit) {
  const body = new ReadableStream({
    pull() {
      throw new Error('body should not be read');
    },
  });

  return new NextRequest('https://app.nabatable.com/api/webhook/twilio/sms-status', {
    method: 'POST',
    headers,
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
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

  it('uses signed query context when delivery-log lookup cannot link the callback', async () => {
    findLatestSmsDeliveryByMessageSidMock.mockResolvedValue(null);

    const query =
      '?bookingId=11111111-1111-4111-8111-111111111111&restaurantId=22222222-2222-4222-8222-222222222222&smsType=booking_update';
    const response = await POST(
      buildSignedRequest({
        requestUrl: `https://app.nabatable.com/api/webhook/twilio/sms-status${query}`,
        signedUrl: `https://app.nabatable.com/api/webhook/twilio/sms-status${query}`,
      }),
    );

    expect(response.status).toBe(200);
    expect(recordSmsDeliveryLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: '11111111-1111-4111-8111-111111111111',
        restaurantId: '22222222-2222-4222-8222-222222222222',
        smsType: 'booking_update',
      }),
    );
  });

  it('keeps delivery-log linkage authoritative over signed query context', async () => {
    const query =
      '?bookingId=11111111-1111-4111-8111-111111111111&restaurantId=22222222-2222-4222-8222-222222222222&smsType=booking_update';
    const response = await POST(
      buildSignedRequest({
        requestUrl: `https://app.nabatable.com/api/webhook/twilio/sms-status${query}`,
        signedUrl: `https://app.nabatable.com/api/webhook/twilio/sms-status${query}`,
      }),
    );

    expect(response.status).toBe(200);
    expect(recordSmsDeliveryLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        smsType: 'booking_confirmation',
      }),
    );
  });

  it('ignores invalid signed query context when lookup cannot link the callback', async () => {
    findLatestSmsDeliveryByMessageSidMock.mockResolvedValue(null);

    const query =
      '?bookingId=not-a-uuid&restaurantId=22222222-2222-4222-8222-222222222222&smsType=booking_update';
    const response = await POST(
      buildSignedRequest({
        requestUrl: `https://app.nabatable.com/api/webhook/twilio/sms-status${query}`,
        signedUrl: `https://app.nabatable.com/api/webhook/twilio/sms-status${query}`,
      }),
    );

    expect(response.status).toBe(200);
    expect(recordSmsDeliveryLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: null,
        restaurantId: null,
        smsType: null,
      }),
    );
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

  it('rejects missing signatures before parsing the body', async () => {
    const response = await POST(
      buildUnreadableBodyRequest({
        'content-type': 'application/x-www-form-urlencoded',
      }),
    );

    expect(response.status).toBe(401);
    expect(recordSmsDeliveryLogMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported content types before signature validation work', async () => {
    const response = await POST(
      buildUnreadableBodyRequest({
        'content-type': 'application/json',
        'x-twilio-signature': 'present-but-not-used',
      }),
    );

    expect(response.status).toBe(415);
    expect(recordSmsDeliveryLogMock).not.toHaveBeenCalled();
  });

  it('rejects oversized content-length before reading the body', async () => {
    const response = await POST(
      buildUnreadableBodyRequest({
        'content-length': String(16 * 1024 + 1),
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'present-but-not-used',
      }),
    );

    expect(response.status).toBe(413);
    expect(recordSmsDeliveryLogMock).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies when content-length is unavailable', async () => {
    const oversizedBody = `MessageSid=SM123&To=%2B447700900123&MessageStatus=delivered&Blob=${'x'.repeat(
      16 * 1024,
    )}`;

    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/webhook/twilio/sms-status', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'present-but-not-used',
        },
        body: oversizedBody,
      }),
    );

    expect(response.status).toBe(413);
    expect(recordSmsDeliveryLogMock).not.toHaveBeenCalled();
  });

  it('rejects excessive webhook parameter counts before signature validation work', async () => {
    const params = new URLSearchParams({
      MessageSid: 'SM123',
      MessageStatus: 'delivered',
      To: '+447700900123',
    });
    for (let index = 0; index < 65; index += 1) {
      params.set(`Extra${index}`, String(index));
    }

    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/webhook/twilio/sms-status', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'present-but-not-used',
        },
        body: params.toString(),
      }),
    );

    expect(response.status).toBe(400);
    expect(recordSmsDeliveryLogMock).not.toHaveBeenCalled();
  });
});
