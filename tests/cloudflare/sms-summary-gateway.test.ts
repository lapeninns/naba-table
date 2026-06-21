import { describe, expect, it, vi } from 'vitest';

import { processDailySummaryDispatch } from '@/cloudflare/sms-summary-gateway/src/job';
import {
  resolveDueDispatch,
  selectDueDispatches,
} from '@/cloudflare/sms-summary-gateway/src/scheduling';
import {
  RetryableDispatchError,
  TerminalDispatchError,
  buildTwilioSmsRequest,
  sendTwilioSmsMessage,
} from '@/cloudflare/sms-summary-gateway/src/twilio';

describe('sms summary scheduling', () => {
  it('detects the local 10:00 window in summer and winter time', () => {
    expect(
      resolveDueDispatch({
        now: '2026-06-15T09:05:00.000Z',
        timezone: 'Europe/London',
      }),
    ).toMatchObject({
      dueNow: true,
      localDate: '2026-06-15',
    });

    expect(
      resolveDueDispatch({
        now: '2026-12-15T10:05:00.000Z',
        timezone: 'Europe/London',
      }),
    ).toMatchObject({
      dueNow: true,
      localDate: '2026-12-15',
    });
  });

  it('returns only enabled restaurants that are due in the current window', () => {
    const due = selectDueDispatches(
      [
        {
          restaurantId: 'restaurant-1',
          timezone: 'Europe/London',
          enabled: true,
          recipient: '+447700900000',
        },
        {
          restaurantId: 'restaurant-2',
          timezone: 'Europe/London',
          enabled: false,
          recipient: '+447700900001',
        },
        {
          restaurantId: 'restaurant-3',
          timezone: 'America/New_York',
          enabled: true,
          recipient: '+15551234567',
        },
      ],
      '2026-06-15T09:05:00.000Z',
    );

    expect(due).toHaveLength(1);
    expect(due[0]?.restaurantId).toBe('restaurant-1');
    expect(due[0]?.localDate).toBe('2026-06-15');
  });
});

describe('twilio sms delivery', () => {
  it('builds the expected Twilio SMS payload', () => {
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

  it('treats 429 and 5xx responses as retryable and hard 4xx errors as terminal', async () => {
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

describe('daily summary queue consumer', () => {
  const preview = {
    date: '2026-04-11',
    timezone: 'Europe/London',
    restaurantId: 'restaurant-1',
    summary: {
      serviceBreakdown: {
        activeBookings: 2,
        activeCovers: 6,
        periods: [
          { key: 'lunch', bookings: 1, covers: 2 },
          { key: 'dinner', bookings: 1, covers: 4 },
        ],
      },
    },
    message: 'Old Crown Girton: Today 2 bkgs, 6 covers. Lunch 1/2. Dinner 1/4. app.nabatable.com',
  };

  it('marks successful sends and skips duplicates', async () => {
    const idempotency = {
      claim: vi.fn().mockResolvedValue({ status: 'claimed' }),
      markSent: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };

    const sent = await processDailySummaryDispatch({
      payload: {
        restaurantId: 'restaurant-1',
        localDate: '2026-04-11',
        recipient: '+447700900000',
        timezone: 'Europe/London',
        dryRun: false,
      },
      idempotency,
      loadPreview: vi.fn().mockResolvedValue(preview),
      sendSms: vi.fn().mockResolvedValue({ messageSid: 'SM123' }),
    });

    expect(sent).toMatchObject({ status: 'sent', messageSid: 'SM123' });
    expect(idempotency.markSent).toHaveBeenCalledWith('SM123');
    expect(idempotency.release).not.toHaveBeenCalled();

    const duplicate = await processDailySummaryDispatch({
      payload: {
        restaurantId: 'restaurant-1',
        localDate: '2026-04-11',
        recipient: '+447700900000',
        timezone: 'Europe/London',
        dryRun: false,
      },
      idempotency: {
        claim: vi.fn().mockResolvedValue({
          status: 'already_sent',
          providerMessageId: 'SM123',
          sentAt: '2026-04-11T09:00:00.000Z',
        }),
        markSent: vi.fn(),
        release: vi.fn(),
      },
      loadPreview: vi.fn(),
      sendSms: vi.fn(),
    });

    expect(duplicate).toEqual({
      status: 'duplicate',
      providerMessageId: 'SM123',
      sentAt: '2026-04-11T09:00:00.000Z',
    });
  });

  it('releases the lock on transient send failures and leaves hard send state untouched after success', async () => {
    const transientIdempotency = {
      claim: vi.fn().mockResolvedValue({ status: 'claimed' }),
      markSent: vi.fn(),
      release: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      processDailySummaryDispatch({
        payload: {
          restaurantId: 'restaurant-1',
          localDate: '2026-04-11',
          recipient: '+447700900000',
          timezone: 'Europe/London',
          dryRun: false,
        },
        idempotency: transientIdempotency,
        loadPreview: vi.fn().mockResolvedValue(preview),
        sendSms: vi.fn().mockRejectedValue(new RetryableDispatchError('try again')),
      }),
    ).rejects.toBeInstanceOf(RetryableDispatchError);

    expect(transientIdempotency.release).toHaveBeenCalledTimes(1);
    expect(transientIdempotency.markSent).not.toHaveBeenCalled();

    const postSendIdempotency = {
      claim: vi.fn().mockResolvedValue({ status: 'claimed' }),
      markSent: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      release: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      processDailySummaryDispatch({
        payload: {
          restaurantId: 'restaurant-1',
          localDate: '2026-04-11',
          recipient: '+447700900000',
          timezone: 'Europe/London',
          dryRun: false,
        },
        idempotency: postSendIdempotency,
        loadPreview: vi.fn().mockResolvedValue(preview),
        sendSms: vi.fn().mockResolvedValue({ messageSid: 'SM123' }),
      }),
    ).rejects.toBeInstanceOf(TerminalDispatchError);

    expect(postSendIdempotency.release).not.toHaveBeenCalled();
  });
});
