import { describe, expect, it, vi } from 'vitest';

import { safeStagingTransport, withStagingProtection } from '@/tests/e2e/staging/protection';

import type { APIRequestContext } from '@playwright/test';

const publicUrl = 'https://nabatable-staging.vercel.app';
const opsUrl = 'https://nabatable-staging-ops.vercel.app';

function fixture(secret: string | undefined = 'test-protection-secret') {
  const get = vi.fn(async () => ({ status: 200 }));
  const dispose = vi.fn(async () => undefined);
  const context = { get, dispose } as unknown as APIRequestContext;
  return { get, dispose, request: withStagingProtection(context, publicUrl, opsUrl, secret) };
}

describe('staging deployment protection transport', () => {
  it('adds protection only to configured web hosts and prevents redirect forwarding', async () => {
    const { get, request } = fixture();
    for (const origin of [publicUrl, opsUrl]) {
      await request.get(`${origin}/api/ready`, {
        headers: { authorization: 'Bearer test-monitoring' },
        maxRedirects: 5,
      });
      expect(get).toHaveBeenLastCalledWith(`${origin}/api/ready`, {
        headers: {
          authorization: 'Bearer test-monitoring',
          'x-vercel-protection-bypass': 'test-protection-secret',
        },
        maxRedirects: 0,
      });
    }
  });

  it('does not leak the Vercel bypass to Workers, Supabase or lookalike hosts', async () => {
    const { get, request } = fixture();
    for (const origin of [
      'https://staging-worker.workers.dev',
      'https://staging-db.supabase.co',
      `${publicUrl}.attacker.test`,
    ]) {
      await request.get(`${origin}/ready`, {
        headers: {
          authorization: 'Bearer test-worker',
          'x-vercel-protection-bypass': 'accidental-test-secret',
        },
      });
      expect(get).toHaveBeenLastCalledWith(`${origin}/ready`, {
        headers: { authorization: 'Bearer test-worker' },
      });
    }
  });

  it('resolves relative requests against the public host and retains lifecycle methods', async () => {
    const { get, dispose, request } = fixture();
    await request.get('/api/bookings');
    expect(get).toHaveBeenCalledWith(`${publicUrl}/api/bookings`, {
      headers: { 'x-vercel-protection-bypass': 'test-protection-secret' },
      maxRedirects: 0,
    });
    await request.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it.each([publicUrl, 'https://staging-worker.workers.dev', 'https://staging-db.supabase.co'])(
    'suppresses transport call logs and token-bearing URLs for %s',
    async (origin) => {
      const get = vi.fn(async () => {
        throw new Error(
          'Call log: authorization: Bearer synthetic-token x-vercel-protection-bypass: synthetic-secret ?access_token=synthetic-query',
        );
      });
      const request = withStagingProtection(
        { get } as unknown as APIRequestContext,
        publicUrl,
        opsUrl,
        'synthetic-secret',
      );
      let failure: unknown;
      try {
        await request.get(`${origin}/ready?access_token=synthetic-query`, {
          headers: { authorization: 'Bearer synthetic-token', apikey: 'synthetic-apikey' },
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      const error = failure as Error;
      expect(error.message).toContain(`GET request to ${origin} failed`);
      expect(error.cause).toBeUndefined();
      for (const secret of [
        'synthetic-token',
        'synthetic-secret',
        'synthetic-query',
        'synthetic-apikey',
        'Call log:',
      ]) {
        expect(`${error.message}\n${error.stack}`).not.toContain(secret);
      }
    },
  );

  it('sanitizes browser route transport failures without retaining the original error', async () => {
    const original = new Error('route.fetch: x-vercel-protection-bypass: synthetic-secret');
    await expect(
      safeStagingTransport('GET', publicUrl, async () => {
        throw original;
      }),
    ).rejects.toThrow(`Staging GET request to ${publicUrl} failed; transport details suppressed.`);
  });

  it('does not invent credentials when no bypass is configured', async () => {
    const get = vi.fn(async () => ({ status: 200 }));
    const request = withStagingProtection(
      { get } as unknown as APIRequestContext,
      publicUrl,
      opsUrl,
      undefined,
    );
    await request.get('/api/ready');
    expect(get).toHaveBeenCalledWith(`${publicUrl}/api/ready`, { headers: {} });
  });
});
