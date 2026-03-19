import { beforeEach, describe, expect, it, vi } from 'vitest';

const consumeRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

import { consumeMagicLinkSigninThrottle } from '@/server/auth/signin-throttle';

function buildRateResult(params: {
  ok: boolean;
  limit?: number;
  remaining?: number;
  resetAt?: number;
}) {
  return {
    ok: params.ok,
    limit: params.limit ?? 5,
    remaining: params.remaining ?? 0,
    resetAt: params.resetAt ?? Date.now() + 60_000,
    source: 'memory' as const,
  };
}

describe('consumeMagicLinkSigninThrottle', () => {
  beforeEach(() => {
    consumeRateLimitMock.mockReset();
  });

  it('blocks on IP limiter breach', async () => {
    consumeRateLimitMock.mockResolvedValueOnce(buildRateResult({ ok: false, remaining: 0 }));

    const result = await consumeMagicLinkSigninThrottle({ clientIp: '1.2.3.4' });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected blocked outcome');
    }
    expect(result.blocked.scope).toBe('ip');
  });

  it('blocks on global limiter breach after passing IP limiter', async () => {
    consumeRateLimitMock
      .mockResolvedValueOnce(buildRateResult({ ok: true, remaining: 3 }))
      .mockResolvedValueOnce(buildRateResult({ ok: false, remaining: 0, limit: 120 }));

    const result = await consumeMagicLinkSigninThrottle({ clientIp: '5.6.7.8' });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected blocked outcome');
    }
    expect(result.blocked.scope).toBe('global');
  });
});
