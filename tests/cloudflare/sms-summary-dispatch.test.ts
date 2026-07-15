import { describe, expect, it, vi } from 'vitest';

import { processDailySummaryDispatch } from '@/cloudflare/sms-summary-gateway/src/job';
import {
  RetryableDispatchError,
  TerminalDispatchError,
} from '@/cloudflare/sms-summary-gateway/src/twilio';

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

describe('daily summary queue consumer', () => {
  it('uses WhatsApp first and only falls back to SMS when provider acceptance fails @worker', async () => {
    const idempotency = {
      claim: vi.fn().mockResolvedValue({ status: 'claimed' }),
      markSent: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const sendWhatsApp = vi.fn().mockResolvedValue({ messageSid: 'MM123' });
    const sendSms = vi.fn();

    const sent = await processDailySummaryDispatch({
      payload: {
        restaurantId: 'restaurant-1',
        localDate: '2026-04-11',
        recipient: '+447700900000',
        timezone: 'Europe/London',
        dryRun: false,
        whatsappFirst: true,
      },
      idempotency,
      loadPreview: vi.fn().mockResolvedValue(preview),
      sendSms,
      sendWhatsApp,
    });

    expect(sent).toMatchObject({ channel: 'whatsapp', messageSid: 'MM123', status: 'sent' });
    expect(sendSms).not.toHaveBeenCalled();

    idempotency.claim.mockResolvedValueOnce({ status: 'claimed' });
    sendWhatsApp.mockRejectedValueOnce(new Error('WhatsApp unavailable'));
    sendSms.mockResolvedValueOnce({ messageSid: 'SM123' });
    const fallback = await processDailySummaryDispatch({
      payload: {
        restaurantId: 'restaurant-1',
        localDate: '2026-04-12',
        recipient: '+447700900000',
        timezone: 'Europe/London',
        dryRun: false,
        whatsappFirst: true,
      },
      idempotency,
      loadPreview: vi.fn().mockResolvedValue(preview),
      sendSms,
      sendWhatsApp,
    });

    expect(fallback).toMatchObject({ channel: 'sms', messageSid: 'SM123', status: 'sent' });
    expect(sendSms).toHaveBeenCalledOnce();
  });

  it('marks successful sends and skips duplicates @worker', async () => {
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

  it('releases the lock on transient send failures and leaves hard send state untouched after success @worker', async () => {
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
