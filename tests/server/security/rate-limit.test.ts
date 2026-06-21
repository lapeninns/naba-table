import { afterEach, describe, expect, it, vi } from 'vitest';

function mockProductionEnv() {
  vi.doMock('@/lib/env', () => ({
    env: {
      node: {
        env: 'production',
        appEnv: 'production',
      },
    },
  }));
}

function mockMissingCloudflareGateway() {
  vi.doMock('@/server/cloudflare/gateway', () => ({
    extractCloudflareGatewayError: vi.fn(),
    isCloudflareGatewayConfigured: vi.fn(() => false),
    requestCloudflareGateway: vi.fn(),
  }));
}

describe('consumeRateLimit production fallback policy', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/lib/env');
    vi.doUnmock('@/server/cloudflare/gateway');
    delete process.env.ALLOW_MEMORY_RATE_LIMIT_IN_PROD;
  });

  it('fails closed in production when Cloudflare is not configured', async () => {
    mockProductionEnv();
    mockMissingCloudflareGateway();

    const { consumeRateLimit } = await import('@/server/security/rate-limit');

    await expect(
      consumeRateLimit({ identifier: 'ip:203.0.113.10', limit: 1, windowMs: 60_000 }),
    ).rejects.toThrow('Cloudflare gateway credentials');
  });

  it('requires an explicit production override before using memory fallback', async () => {
    process.env.ALLOW_MEMORY_RATE_LIMIT_IN_PROD = 'true';
    mockProductionEnv();
    mockMissingCloudflareGateway();

    const { consumeRateLimit } = await import('@/server/security/rate-limit');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const result = await consumeRateLimit({
        identifier: 'ip:203.0.113.20',
        limit: 2,
        windowMs: 60_000,
      });

      expect(result.source).toBe('memory');
      expect(result.ok).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
