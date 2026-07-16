import { describe, expect, it, vi } from 'vitest';

import { DailyBookingSummaryState } from '@/cloudflare/sms-summary-gateway/src/daily-booking-summary-state';
import { handleManagerWhatsAppStatus } from '@/cloudflare/sms-summary-gateway/src/manager-whatsapp-status';

const validCallbackToken = '22222222-2222-4222-8222-222222222222';

function callbackRequest(callbackToken = validCallbackToken): Request {
  const url = new URL('https://summary.example/webhook/twilio/manager-whatsapp-status');
  url.searchParams.set('restaurantId', '11111111-1111-4111-8111-111111111111');
  url.searchParams.set('localDate', '2026-07-17');
  url.searchParams.set('callbackToken', callbackToken);
  const form = new URLSearchParams({
    ErrorCode: '63024',
    MessageSid: 'MM123',
    MessageStatus: 'undelivered',
    To: 'whatsapp:+447700900000',
  });
  return new Request(url, {
    body: form.toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
}

function fakeDurableObjectState(): DurableObjectState {
  const values = new Map<string, unknown>();
  return {
    storage: {
      deleteAll: vi.fn(async () => values.clear()),
      get: vi.fn(async (key: string) => values.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        values.set(key, value);
      }),
      setAlarm: vi.fn(async () => undefined),
    },
  } as unknown as DurableObjectState;
}

describe('manager WhatsApp status fallback', () => {
  it('sends exactly one SMS for duplicate provider-confirmed failures @worker @api', async () => {
    const claimFallback = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'claimed' as const,
        message: 'Today 2 bookings and 6 covers.',
      })
      .mockResolvedValueOnce({ status: 'already_sent' as const });
    const sendSms = vi.fn().mockResolvedValue({ messageSid: 'SM123' });
    const completeFallback = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      claimFallback,
      completeFallback,
      releaseFallback: vi.fn(),
      sendSms,
      verifyProviderFailure: vi.fn().mockResolvedValue(true),
    };

    const first = await handleManagerWhatsAppStatus(callbackRequest(), {}, dependencies);
    const duplicate = await handleManagerWhatsAppStatus(callbackRequest(), {}, dependencies);

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      fallbackSent: true,
      ignored: false,
      ok: true,
    });
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toEqual({
      fallbackSent: false,
      ignored: true,
      ok: true,
    });
    expect(sendSms).toHaveBeenCalledOnce();
    expect(completeFallback).toHaveBeenCalledWith({
      smsMessageSid: 'SM123',
      whatsappMessageSid: 'MM123',
    });
  });

  it('rejects an invalid callback token without provider readback or fallback @worker @security', async () => {
    const dependencies = {
      claimFallback: vi.fn().mockResolvedValue({ status: 'not_found' }),
      completeFallback: vi.fn(),
      releaseFallback: vi.fn(),
      sendSms: vi.fn(),
      verifyProviderFailure: vi.fn(),
    };

    const response = await handleManagerWhatsAppStatus(
      callbackRequest('33333333-3333-4333-8333-333333333333'),
      {},
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(dependencies.claimFallback).toHaveBeenCalled();
    expect(dependencies.verifyProviderFailure).not.toHaveBeenCalled();
    expect(dependencies.sendSms).not.toHaveBeenCalled();
  });

  it('releases the claim when Twilio readback does not confirm terminal failure @worker', async () => {
    const releaseFallback = vi.fn().mockResolvedValue(undefined);
    const sendSms = vi.fn();
    const response = await handleManagerWhatsAppStatus(
      callbackRequest(),
      {},
      {
        claimFallback: vi.fn().mockResolvedValue({
          status: 'claimed',
          message: 'Today 2 bookings and 6 covers.',
        }),
        completeFallback: vi.fn(),
        releaseFallback,
        sendSms,
        verifyProviderFailure: vi.fn().mockResolvedValue(false),
      },
    );

    expect(response.status).toBe(503);
    expect(releaseFallback).toHaveBeenCalledWith({ whatsappMessageSid: 'MM123' });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('releases a retryable claim only when the SMS send itself fails @worker', async () => {
    const releaseFallback = vi.fn().mockResolvedValue(undefined);
    const response = await handleManagerWhatsAppStatus(
      callbackRequest(),
      {},
      {
        claimFallback: vi.fn().mockResolvedValue({
          status: 'claimed',
          message: 'Today 2 bookings and 6 covers.',
        }),
        completeFallback: vi.fn(),
        releaseFallback,
        sendSms: vi.fn().mockRejectedValue(new Error('Twilio unavailable')),
        verifyProviderFailure: vi.fn().mockResolvedValue(true),
      },
    );

    expect(response.status).toBe(503);
    expect(releaseFallback).toHaveBeenCalledWith({ whatsappMessageSid: 'MM123' });
  });

  it('does not release an accepted SMS when state finalization needs reconciliation @worker', async () => {
    const releaseFallback = vi.fn();
    const response = await handleManagerWhatsAppStatus(
      callbackRequest(),
      {},
      {
        claimFallback: vi.fn().mockResolvedValue({
          status: 'claimed',
          message: 'Today 2 bookings and 6 covers.',
        }),
        completeFallback: vi.fn().mockRejectedValue(new Error('state unavailable')),
        releaseFallback,
        sendSms: vi.fn().mockResolvedValue({ messageSid: 'SM123' }),
        verifyProviderFailure: vi.fn().mockResolvedValue(true),
      },
    );

    expect(response.status).toBe(503);
    expect(releaseFallback).not.toHaveBeenCalled();
  });

  it('atomically claims a matching callback token once @worker', async () => {
    const state = new DailyBookingSummaryState(fakeDurableObjectState());
    await state.fetch(
      new Request('https://state/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          callbackToken: validCallbackToken,
          channel: 'whatsapp',
          message: 'Today 2 bookings and 6 covers.',
          providerMessageId: 'MM123',
          recipient: '+447700900000',
        }),
      }),
    );

    const claimRequest = () =>
      new Request('https://state/claim-fallback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          callbackToken: validCallbackToken,
          providerMessageId: 'MM123',
          recipient: '+447700900000',
        }),
      });
    const first = await state.fetch(claimRequest());
    const duplicate = await state.fetch(claimRequest());
    await state.fetch(
      new Request('https://state/complete-fallback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          smsMessageSid: 'SM123',
          whatsappMessageSid: 'MM123',
        }),
      }),
    );
    const completedDuplicate = await state.fetch(claimRequest());

    await expect(first.json()).resolves.toMatchObject({
      message: 'Today 2 bookings and 6 covers.',
      status: 'claimed',
    });
    await expect(duplicate.json()).resolves.toMatchObject({ status: 'locked' });
    await expect(completedDuplicate.json()).resolves.toMatchObject({
      providerMessageId: 'SM123',
      status: 'already_sent',
    });
  });
});
