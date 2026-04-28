import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireOpsAuthMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/ops-guard', () => ({
  requireOpsAuth: requireOpsAuthMock,
}));

vi.mock('@/server/supabase', () => ({
  getMiddlewareSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/security/csrf', () => ({
  buildCsrfCookieOptions: vi.fn(() => ({})),
  CSRF_COOKIE_NAME: 'csrf',
}));

import { handleRouting } from '@/src/proxy';

describe('proxy GBP callback public API routing', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'localhost');
    requireOpsAuthMock.mockReset();
  });

  it('does not require ops auth for the per-restaurant Google Business callback', async () => {
    const response = await handleRouting(
      new NextRequest(
        'http://app.localhost/api/ops/restaurants/rest-1/google-business/callback?state=s&code=c',
      ),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(requireOpsAuthMock).not.toHaveBeenCalled();
  });

  it('still requires ops auth for non-public ops APIs', async () => {
    requireOpsAuthMock.mockResolvedValue(NextResponse.json({ error: 'auth' }, { status: 401 }));

    const response = await handleRouting(
      new NextRequest('http://app.localhost/api/ops/restaurants/rest-1/google-business'),
    );

    expect(response.status).toBe(401);
    expect(requireOpsAuthMock).toHaveBeenCalledTimes(1);
  });
});
