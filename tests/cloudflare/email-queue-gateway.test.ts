import { describe, expect, it, vi } from 'vitest';

import { routeGatewayRequest } from '@/cloudflare/email-queue-gateway/src/gateway-router';

type DurableObjectStub = {
  fetch: (request: Request) => Promise<Response>;
};

type DurableObjectBinding = {
  get: (id: string) => DurableObjectStub;
  idFromName: (name: string) => string;
};

type EmailQueueGatewayEnv = {
  CAPACITY_VERSION_STATE: DurableObjectBinding;
  EMAIL_QUEUE_STATE: DurableObjectBinding;
  GATEWAY_TOKEN: string;
  RATE_LIMIT_STATE: DurableObjectBinding;
};

function createBinding(fetchMock: ReturnType<typeof vi.fn>): DurableObjectBinding {
  return {
    idFromName: vi.fn((name: string) => `id:${name}`),
    get: vi.fn(() => ({
      fetch: fetchMock,
    })),
  };
}

function createEnv(overrides: Partial<EmailQueueGatewayEnv> = {}): EmailQueueGatewayEnv {
  return {
    GATEWAY_TOKEN: 'gateway-token',
    EMAIL_QUEUE_STATE: createBinding(vi.fn()),
    RATE_LIMIT_STATE: createBinding(vi.fn()),
    CAPACITY_VERSION_STATE: createBinding(vi.fn()),
    ...overrides,
  };
}

function authedRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('authorization', 'Bearer gateway-token');
  return new Request(`https://email-queue-gateway.example.test${path}`, {
    ...init,
    headers,
  });
}

describe('email queue gateway worker', () => {
  it('@p1 @worker @security allows health checks without a bearer token', async () => {
    const response = await routeGatewayRequest(
      new Request('https://email-queue-gateway.example.test/health'),
      createEnv(),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'email-queue-gateway',
    });
    expect(response.status).toBe(200);
  });

  it('@p1 @worker @security rejects protected worker requests without the configured bearer token', async () => {
    const queueFetch = vi.fn();
    const env = createEnv({
      EMAIL_QUEUE_STATE: createBinding(queueFetch),
    });

    const missingToken = await routeGatewayRequest(
      new Request('https://email-queue-gateway.example.test/status'),
      env,
    );
    const wrongToken = await routeGatewayRequest(
      new Request('https://email-queue-gateway.example.test/status', {
        headers: { authorization: 'Bearer wrong-token' },
      }),
      env,
    );

    expect(missingToken.status).toBe(401);
    expect(wrongToken.status).toBe(401);
    expect(queueFetch).not.toHaveBeenCalled();
  });

  it('@p1 @worker @contract routes authorized queue requests to the queue durable object', async () => {
    const queueFetch = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        source: 'queue-state',
      }),
    );
    const queueBinding = createBinding(queueFetch);

    const response = await routeGatewayRequest(
      authedRequest('/status?includeJobs=true'),
      createEnv({
        EMAIL_QUEUE_STATE: queueBinding,
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      source: 'queue-state',
    });
    expect(queueBinding.idFromName).toHaveBeenCalledWith('primary');
    expect(queueBinding.get).toHaveBeenCalledWith('id:primary');
    expect(queueFetch).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
  });

  it('@p1 @worker @contract routes authorized rate-limit requests by identifier', async () => {
    const rateLimitFetch = vi.fn().mockResolvedValue(Response.json({ ok: true, remaining: 0 }));
    const rateLimitBinding = createBinding(rateLimitFetch);

    const response = await routeGatewayRequest(
      authedRequest('/rate-limit/consume', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'qa-rate-key' }),
      }),
      createEnv({
        RATE_LIMIT_STATE: rateLimitBinding,
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true, remaining: 0 });
    expect(rateLimitBinding.idFromName).toHaveBeenCalledWith('qa-rate-key');
    expect(rateLimitFetch).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });

  it('@p1 @worker @contract routes authorized capacity-version requests to the capacity durable object', async () => {
    const capacityFetch = vi.fn().mockResolvedValue(Response.json({ ok: true, versions: {} }));
    const capacityBinding = createBinding(capacityFetch);

    const response = await routeGatewayRequest(
      authedRequest('/capacity/versions/read', {
        method: 'POST',
        body: JSON.stringify({ restaurantIds: ['restaurant-1'] }),
      }),
      createEnv({
        CAPACITY_VERSION_STATE: capacityBinding,
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true, versions: {} });
    expect(capacityBinding.idFromName).toHaveBeenCalledWith('primary');
    expect(capacityFetch).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });
});
