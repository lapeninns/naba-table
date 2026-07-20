import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() =>
  vi.fn(async () => ({
    auth: { getUser: getUserMock, signOut: signOutMock },
    rpc: rpcMock,
  })),
);

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn(
    async (_request: NextRequest, handler: () => Promise<Response>) => handler(),
  ),
}));

import { DELETE, GET, PATCH, POST } from '@/src/app/api/account/sessions/route';

describe('account sessions route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getUserMock.mockReset();
    signOutMock.mockReset();
    rpcMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockClear();
  });

  it('requires an authenticated account', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(new NextRequest('http://localhost:3000/api/account/sessions'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('maps the signed-in users own RPC rows into device descriptions', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    rpcMock.mockResolvedValue({
      data: [
        {
          session_id: '99999999-9999-4999-8999-000000000001',
          signed_in_at: '2026-07-20T08:00:00.000Z',
          last_seen_at: '2026-07-20T12:00:00.000Z',
          signed_out_at: null,
          user_agent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          ip_address: '203.0.113.4',
          device_id: '88888888-8888-4888-8888-000000000001',
          device_name: 'Reception computer',
          device_first_seen_at: '2026-06-12T08:00:00.000Z',
          device_session_count: 7,
          time_zone: 'Europe/London',
          locale: 'en-GB',
          city: 'London',
          region: 'ENG',
          country_code: 'GB',
          assurance_level: 'aal2',
          refreshed_at: '2026-07-20T11:55:00.000Z',
          expires_at: '2026-08-20T08:00:00.000Z',
          is_active: true,
          is_current: true,
        },
      ],
      error: null,
    });

    const response = await GET(new NextRequest('http://localhost:3000/api/account/sessions'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body.sessions).toEqual([
      expect.objectContaining({
        id: '99999999-9999-4999-8999-000000000001',
        isActive: true,
        isCurrent: true,
        ipAddress: '203.0.113.4',
        assuranceLevel: 'aal2',
        refreshedAt: '2026-07-20T11:55:00.000Z',
        expiresAt: '2026-08-20T08:00:00.000Z',
        approximateLocation: {
          city: 'London',
          region: 'ENG',
          countryCode: 'GB',
        },
        device: expect.objectContaining({
          id: '88888888-8888-4888-8888-000000000001',
          name: 'Reception computer',
          firstSeenAt: '2026-06-12T08:00:00.000Z',
          sessionCount: 7,
          timeZone: 'Europe/London',
          locale: 'en-GB',
          kind: 'desktop',
          label: 'Chrome 126 on Windows 10 or 11',
        }),
      }),
    ]);
    expect(rpcMock).toHaveBeenCalledWith('list_my_account_sessions');
  });

  it('uses sample sessions only for the fully enabled localhost QA fixture', async () => {
    vi.stubEnv('QA_ENABLE_AUTH_FIXTURES', '1');
    vi.stubEnv('QA_USE_MOCKS', '1');
    vi.stubEnv('QA_TARGET_ENV', 'local');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'localhost');
    vi.stubEnv('APP_ENV', 'development');

    const response = await GET(
      new NextRequest('http://app.localhost:3000/api/account/sessions', {
        headers: {
          cookie: '__nabatable_qa_ops_auth=enabled',
          host: 'app.localhost:3000',
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessions).toHaveLength(3);
    expect(body.sessions[0]).toMatchObject({ isCurrent: true, isActive: true });
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('records minimal first-party device metadata and trusted platform location', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    rpcMock.mockResolvedValue({ data: null, error: null });

    const response = await POST(
      new NextRequest('http://localhost:3000/api/account/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-vercel-ip-city': 'Greater%20London',
          'x-vercel-ip-country-region': 'ENG',
          'x-vercel-ip-country': 'gb',
        },
        body: JSON.stringify({
          deviceId: '88888888-8888-4888-8888-000000000001',
          timeZone: 'Europe/London',
          locale: 'en-GB',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('touch_my_account_session', {
      p_city: 'Greater London',
      p_country_code: 'GB',
      p_device_id: '88888888-8888-4888-8888-000000000001',
      p_locale: 'en-GB',
      p_region: 'ENG',
      p_time_zone: 'Europe/London',
    });
  });

  it('rejects invalid heartbeat metadata', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    const response = await POST(
      new NextRequest('http://localhost:3000/api/account/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: 'hardware-fingerprint' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('renames a device owned by the authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    rpcMock.mockResolvedValue({ data: null, error: null });

    const response = await PATCH(
      new NextRequest('http://localhost:3000/api/account/sessions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deviceId: '88888888-8888-4888-8888-000000000001',
          name: '  Reception iPad  ',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('rename_my_account_device', {
      p_device_id: '88888888-8888-4888-8888-000000000001',
      p_name: 'Reception iPad',
    });
  });

  it('logs out every other session while preserving the current session', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    signOutMock.mockResolvedValue({ error: null });

    const response = await DELETE(
      new NextRequest('http://localhost:3000/api/account/sessions', {
        method: 'DELETE',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('does not revoke other sessions for an unauthenticated request', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await DELETE(
      new NextRequest('http://localhost:3000/api/account/sessions', {
        method: 'DELETE',
      }),
    );

    expect(response.status).toBe(401);
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
