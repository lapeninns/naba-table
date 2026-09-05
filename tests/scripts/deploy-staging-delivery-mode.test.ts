import { describe, expect, it, vi } from 'vitest';

import {
  sendDailySummaryViaTwilio,
  sendDailySummaryViaWhatsApp,
} from '@/cloudflare/sms-summary-gateway/src/job';

const smsEnv = {
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_API_KEY_SID: 'SK123',
  TWILIO_API_KEY_SECRET: 'secret',
  TWILIO_MESSAGING_SERVICE_SID: 'MG123',
};

const whatsappEnv = {
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_API_KEY_SID: 'SK123',
  TWILIO_API_KEY_SECRET: 'secret',
  TWILIO_WHATSAPP_SENDER: '+14155238886',
  TWILIO_WHATSAPP_MANAGER_SUMMARY_CONTENT_SID: 'HX123',
  SMS_SUMMARY_GATEWAY_PUBLIC_URL: 'https://summary.example',
};

describe('staging delivery kill switch (DELIVERY_MODE=sink)', () => {
  it('never calls Twilio for SMS when DELIVERY_MODE is sink @worker @staging', async () => {
    const fetchImpl = vi.fn();
    const result = await sendDailySummaryViaTwilio({
      env: { ...smsEnv, DELIVERY_MODE: 'sink' },
      recipient: '+447700900000',
      message: 'Today 2 bookings.',
      fetchImpl,
    });
    expect(result).toEqual({ messageSid: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never calls Twilio for WhatsApp when DELIVERY_MODE is sink @worker @staging', async () => {
    const fetchImpl = vi.fn();
    const result = await sendDailySummaryViaWhatsApp({
      env: { ...whatsappEnv, DELIVERY_MODE: 'sink' },
      restaurantId: '11111111-1111-4111-8111-111111111111',
      localDate: '2026-09-05',
      callbackToken: '22222222-2222-4222-8222-222222222222',
      recipient: '+447700900000',
      message: 'Today 2 bookings.',
      fetchImpl,
    });
    expect(result).toEqual({ messageSid: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('delivers normally when DELIVERY_MODE is unset or any other value @worker', async () => {
    for (const mode of [undefined, 'live', 'SINK']) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ sid: 'SM123' }), { status: 201 }));
      const result = await sendDailySummaryViaTwilio({
        env: { ...smsEnv, ...(mode === undefined ? {} : { DELIVERY_MODE: mode }) },
        recipient: '+447700900000',
        message: 'Today 2 bookings.',
        fetchImpl,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(result.messageSid).toBe('SM123');
    }
  });

  it('is pinned to sink in the staging wrangler environment only @staging @contract', async () => {
    const { readFileSync } = await import('node:fs');
    const { stripJsonComments } = await import('@/scripts/deploy/wrangler-config');
    const config = JSON.parse(
      stripJsonComments(readFileSync('cloudflare/sms-summary-gateway/wrangler.jsonc', 'utf8')),
    ) as { vars?: Record<string, string>; env?: { staging?: { vars?: Record<string, string> } } };
    expect(config.env?.staging?.vars?.DELIVERY_MODE).toBe('sink');
    expect(config.vars?.DELIVERY_MODE).toBeUndefined();
  });
});
