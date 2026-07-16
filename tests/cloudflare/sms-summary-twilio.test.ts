import { describe, expect, it, vi } from 'vitest';

import {
  RetryableDispatchError,
  TerminalDispatchError,
  buildTwilioSmsRequest,
  sendTwilioSmsMessage,
} from '@/cloudflare/sms-summary-gateway/src/twilio';
import { sendDailySummaryViaWhatsApp } from '@/cloudflare/sms-summary-gateway/src/job';

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

  it('registers the manager WhatsApp status callback with Twilio @worker @contract', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ sid: 'MM123', status: 'accepted' }), { status: 201 }),
      );

    await sendDailySummaryViaWhatsApp({
      env: {
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_API_KEY_SID: 'SK123',
        TWILIO_API_KEY_SECRET: 'secret',
        TWILIO_WHATSAPP_SENDER: '+14155238886',
        TWILIO_WHATSAPP_MANAGER_SUMMARY_CONTENT_SID: 'HX123',
        SMS_SUMMARY_GATEWAY_PUBLIC_URL: 'https://summary.example',
      },
      restaurantId: '11111111-1111-4111-8111-111111111111',
      localDate: '2026-07-17',
      callbackToken: '22222222-2222-4222-8222-222222222222',
      recipient: '+447700900000',
      message: 'Today 2 bookings and 6 covers.',
      fetchImpl,
    });

    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const body = request.body as URLSearchParams;
    expect(body.get('StatusCallback')).toBe(
      'https://summary.example/webhook/twilio/manager-whatsapp-status' +
        '?restaurantId=11111111-1111-4111-8111-111111111111&localDate=2026-07-17' +
        '&callbackToken=22222222-2222-4222-8222-222222222222',
    );
  });
});
