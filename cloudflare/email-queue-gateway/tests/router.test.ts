import { describe, expect, it, vi } from 'vitest';

import { routeGatewayRequest } from '../src/gateway-router';

describe('email queue gateway contract', () => {
  it('serves a public health response without touching durable objects', async () => {
    const binding = {
      get: vi.fn(),
      idFromName: vi.fn(),
    };
    const response = await routeGatewayRequest(new Request('https://gateway.test/health'), {
      CAPACITY_VERSION_STATE: binding,
      EMAIL_QUEUE_STATE: binding,
      GATEWAY_TOKEN: 'test-token',
      RATE_LIMIT_STATE: binding,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'email-queue-gateway',
    });
    expect(binding.get).not.toHaveBeenCalled();
  });
});
