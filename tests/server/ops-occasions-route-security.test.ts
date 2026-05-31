import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const withPlatformAdminAuthorizationMock = vi.hoisted(() => vi.fn());
const fetchAllOccasionsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', () => ({
  withPlatformAdminAuthorization: withPlatformAdminAuthorizationMock,
}));

vi.mock('@/server/occasions/admin', () => ({
  fetchAllOccasions: fetchAllOccasionsMock,
  insertAudit: vi.fn(),
  toAdminOccasion: vi.fn((occasion) => occasion),
}));

vi.mock('@/server/auth/supabase-auth-errors', () => ({
  mapSupabaseAuthError: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(),
  getServiceSupabaseClient: vi.fn(),
}));

import { GET } from '@/src/app/api/ops/occasions/route';

describe('ops occasions route security', () => {
  beforeEach(() => {
    withPlatformAdminAuthorizationMock.mockReset();
    fetchAllOccasionsMock.mockReset();
  });

  it('requires platform admin authorization before listing admin occasions', async () => {
    withPlatformAdminAuthorizationMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Platform administrator access required' }), {
        status: 403,
      }),
    });

    const response = await GET(new NextRequest('https://app.nabatable.com/api/ops/occasions'));

    expect(response.status).toBe(403);
    expect(fetchAllOccasionsMock).not.toHaveBeenCalled();
  });
});
