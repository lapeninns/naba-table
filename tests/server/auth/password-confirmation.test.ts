import { beforeEach, describe, expect, it, vi } from 'vitest';

const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import { verifyUserPasswordConfirmation } from '@/server/auth/password-confirmation';

describe('verifyUserPasswordConfirmation', () => {
  beforeEach(() => {
    consumeRateLimitMock.mockReset().mockResolvedValue({
      ok: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    createClientMock.mockReset().mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });
  });

  it('checks a rate limit before verifying the password', async () => {
    await verifyUserPasswordConfirmation({
      email: 'Owner@Example.com',
      password: 'correct horse battery staple',
    });

    expect(consumeRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: expect.stringMatching(/^auth:password-confirmation:[a-f0-9]{32}$/),
        limit: 5,
      }),
    );
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when password confirmation is rate limited', async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      limit: 5,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });

    await expect(
      verifyUserPasswordConfirmation({
        email: 'owner@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      code: 'PASSWORD_CONFIRMATION_RATE_LIMITED',
      status: 429,
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
