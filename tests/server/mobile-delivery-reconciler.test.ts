import { describe, expect, it, vi } from 'vitest';

import { reconcileMobileDeliveryCandidatesWithDependencies } from '@/server/observability/mobile-delivery-reconciler';

const candidates = [
  {
    channel: 'sms' as const,
    id: 'attempt-sms',
    providerMessageId: 'SM123',
    status: 'accepted',
    updatedAt: '2026-07-16T09:00:00.000Z',
  },
  {
    channel: 'whatsapp' as const,
    id: 'attempt-whatsapp',
    providerMessageId: 'WA123',
    status: 'queued',
    updatedAt: '2026-07-16T09:05:00.000Z',
  },
];

describe('reconcileMobileDeliveryCandidatesWithDependencies', () => {
  it('heals terminal SMS and WhatsApp provider states in one bounded pass', async () => {
    const finalizeSms = vi.fn().mockResolvedValue('delivered');
    const processWhatsApp = vi.fn().mockResolvedValue({
      fallbackSent: false,
      ignored: false,
    });

    const report = await reconcileMobileDeliveryCandidatesWithDependencies(candidates, {
      fetchMessage: vi
        .fn()
        .mockResolvedValueOnce({
          errorCode: null,
          sid: 'SM123',
          status: 'delivered',
          to: '+447700900001',
        })
        .mockResolvedValueOnce({
          errorCode: null,
          sid: 'WA123',
          status: 'read',
          to: 'whatsapp:+447700900002',
        }),
      finalizeSms,
      processWhatsApp,
    });

    expect(finalizeSms).toHaveBeenCalledWith({
      attemptId: 'attempt-sms',
      errorCode: null,
      providerMessageId: 'SM123',
      status: 'delivered',
    });
    expect(processWhatsApp).toHaveBeenCalledWith({
      attemptId: 'attempt-whatsapp',
      errorCode: null,
      messageSid: 'WA123',
      providerStatus: 'read',
      recipientPhone: 'whatsapp:+447700900002',
    });
    expect(report).toEqual({
      fetchErrors: 0,
      fetched: 2,
      resolvedSms: 1,
      resolvedWhatsApp: 1,
      stuck: 0,
      unpollable: 0,
      whatsappFallbacksSent: 0,
    });
  });

  it('continues after a provider read failure and reports the unresolved attempt', async () => {
    const fetchMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce({
        errorCode: null,
        sid: 'WA123',
        status: 'delivered',
        to: 'whatsapp:+447700900002',
      });

    const report = await reconcileMobileDeliveryCandidatesWithDependencies(candidates, {
      fetchMessage,
      finalizeSms: vi.fn(),
      processWhatsApp: vi.fn().mockResolvedValue({
        fallbackSent: false,
        ignored: false,
      }),
    });

    expect(fetchMessage).toHaveBeenCalledTimes(2);
    expect(report).toMatchObject({
      fetchErrors: 1,
      fetched: 2,
      resolvedWhatsApp: 1,
      stuck: 1,
    });
  });
});
