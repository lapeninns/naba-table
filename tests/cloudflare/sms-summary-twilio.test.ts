import { describe, expect, it, vi } from 'vitest';

import {
  RetryableDispatchError,
  TerminalDispatchError,
  buildTwilioSmsRequest,
  sendTwilioSmsMessage,
} from '@/cloudflare/sms-summary-gateway/src/twilio';

describe('twilio sms delivery', () => {
  it('builds the expected Twilio SMS payload @worker @contract', () => {
    const { url, init } = buildTwilioSmsRequest({
      accountSid: 'AC123',
      apiKeySid: 'SK123',
      apiKeySecret: 'secret',
      messagingServiceSid: 'MG123',
      to: '+449876543210',
      body: 'Old Crown Girton: Today 10 bkgs, 140 covers. Lunch 4/52. Dinner 6/88. app.nabatable.com',
    });

    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/x-www-form-urlencoded;charset=UTF-8',
    );

    const params = new URLSearchParams(init.body as string);
    expect(params.get('To')).toBe('+449876543210');
    expect(params.get('Body')).toBe(
      'Old Crown Girton: Today 10 bkgs, 140 covers. Lunch 4/52. Dinner 6/88. app.nabatable.com',
    );
    expect(params.get('MessagingServiceSid')).toBe('MG123');
  });

  it('treats 429 and 5xx responses as retryable and hard 4xx errors as terminal @worker @external-mock', async () => {
    await expect(
      sendTwilioSmsMessage({
        accountSid: 'AC123',
        apiKeySid: 'SK123',
        apiKeySecret: 'secret',
        messagingServiceSid: 'MG123',
        to: '+449876543210',
        body: 'hello',
        fetchImpl: vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ message: 'slow down' }), { status: 429 }),
          ),
      }),
    ).rejects.toBeInstanceOf(RetryableDispatchError);

    await expect(
      sendTwilioSmsMessage({
        accountSid: 'AC123',
        apiKeySid: 'SK123',
        apiKeySecret: 'secret',
        messagingServiceSid: 'MG123',
        to: '+449876543210',
        body: 'hello',
        fetchImpl: vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ message: 'bad sender' }), { status: 400 }),
          ),
      }),
    ).rejects.toBeInstanceOf(TerminalDispatchError);
  });
});
