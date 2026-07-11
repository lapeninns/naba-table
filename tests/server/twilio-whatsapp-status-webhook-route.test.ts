import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const processCallback = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    app: { url: 'https://app.nabatable.com' },
    twilio: { authToken: 'auth-token' },
  },
}));

vi.mock('@/server/notifications/whatsapp-status', () => ({
  processWhatsAppStatusCallback: processCallback,
}));

import { POST } from '@/src/app/api/webhook/twilio/whatsapp-status/route';

function request(signatureOverride?: string) {
  const url = 'https://app.nabatable.com/api/webhook/twilio/whatsapp-status';
  const form = new URLSearchParams({
    ErrorCode: '63016',
    MessageSid: 'MM123',
    MessageStatus: 'undelivered',
    To: 'whatsapp:+447123456789',
  });
  let signedPayload = url;
  for (const [key, value] of Array.from(form.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    signedPayload += key + value;
  }
  const signature =
    signatureOverride ??
    createHmac('sha1', 'auth-token').update(signedPayload, 'utf8').digest('base64');
  return new NextRequest(url, {
    body: form.toString(),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': signature,
    },
    method: 'POST',
  });
}

describe('POST /api/webhook/twilio/whatsapp-status', () => {
  beforeEach(() => {
    processCallback.mockReset();
    processCallback.mockResolvedValue({ fallbackSent: true, ignored: false });
  });

  it('processes a signed terminal failure that can claim SMS fallback', async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(processCallback).toHaveBeenCalledWith({
      errorCode: '63016',
      messageSid: 'MM123',
      providerStatus: 'undelivered',
      recipientPhone: 'whatsapp:+447123456789',
    });
    await expect(response.json()).resolves.toEqual({
      fallbackSent: true,
      ignored: false,
      ok: true,
    });
  });

  it('rejects an invalid signature without writing state', async () => {
    const response = await POST(request('invalid'));

    expect(response.status).toBe(401);
    expect(processCallback).not.toHaveBeenCalled();
  });
});
