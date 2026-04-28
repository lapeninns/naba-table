import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    googleBusinessProfile: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example/api/ops/google-business/callback',
      tokenEncryptionKey: 'test-key',
      quotaProject: '23639420332',
      configured: true,
    },
  },
}));

import {
  buildGoogleBusinessProfileAuthUrl,
  patchGoogleBusinessProfileLocation,
} from '@/server/google-business-profile/client';

describe('google business profile client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds validateOnly alongside updateMask for dry-run location patches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await patchGoogleBusinessProfileLocation(
      'access-token',
      'locations/123',
      { title: 'Old Crown Girton' },
      ['title'],
      { validateOnly: true },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.pathname).toBe('/v1/locations/123');
    expect(requestUrl.searchParams.get('updateMask')).toBe('title');
    expect(requestUrl.searchParams.get('validateOnly')).toBe('true');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ title: 'Old Crown Girton' }));
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
      'X-Goog-User-Project': '23639420332',
    });
  });

  it('omits validateOnly for real location patches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: 'locations/123', title: 'Old Crown Girton' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await patchGoogleBusinessProfileLocation(
      'access-token',
      'locations/123',
      { title: 'Old Crown Girton' },
      ['title'],
    );

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.searchParams.get('updateMask')).toBe('title');
    expect(requestUrl.searchParams.has('validateOnly')).toBe(false);
  });

  it('requests only the business.manage OAuth scope for GBP consent', () => {
    const url = new URL(buildGoogleBusinessProfileAuthUrl('state-token'));

    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/business.manage');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });
});
