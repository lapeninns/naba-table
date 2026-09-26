import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: fetchJsonMock,
}));

import {
  emailDeliveryTransportFromService,
  httpEmailDeliveryTransport,
} from '@/src/services/ops/email-delivery';

describe('email delivery transport', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset().mockResolvedValue({ ok: true });
  });

  it('posts a resend with the restaurant and delivery log ids', async () => {
    await httpEmailDeliveryTransport.retryEmailDelivery({
      restaurantId: 'r1',
      deliveryLogId: 'log-1',
    });

    const [url, init] = fetchJsonMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ops/email-delivery/retry');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ restaurantId: 'r1', deliveryLogId: 'log-1' });
  });

  it('encodes the job id for queue cancel and requeue', async () => {
    await httpEmailDeliveryTransport.cancelEmailQueueJob({ restaurantId: 'r1', jobId: 'a/b' });
    await httpEmailDeliveryTransport.requeueEmailQueueJob({ restaurantId: 'r1', jobId: 'a/b' });

    expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/ops/email-queue/a%2Fb/cancel',
      '/api/ops/email-queue/a%2Fb/requeue',
    ]);
  });

  it('adapts an injected BookingService to the sent contract', async () => {
    const service = {
      retryEmailDelivery: vi.fn().mockResolvedValue({ ok: true, deliveryLogEntry: { id: 'x' } }),
      cancelEmailQueueJob: vi.fn(),
      requeueEmailQueueJob: vi.fn(),
    };

    await expect(
      emailDeliveryTransportFromService(service).retryEmailDelivery({
        restaurantId: 'r1',
        deliveryLogId: 'log-1',
      }),
    ).resolves.toEqual({ ok: true, status: 'sent', retryAttempt: 1, deliveryLogEntry: { id: 'x' } });
  });
});
