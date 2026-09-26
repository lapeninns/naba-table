import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
);
const cookiesMock = vi.hoisted(() => vi.fn());
const headersMock = vi.hoisted(() => vi.fn());
const cookieGetMock = vi.hoisted(() => vi.fn());
const headerGetMock = vi.hoisted(() => vi.fn());
const getServerComponentSupabaseClientMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const getRequestUserMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsCachedMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const resolveServiceRoleSupabaseUrlMock = vi.hoisted(() =>
  vi.fn(() => process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co'),
);

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/headers', () => ({ cookies: cookiesMock, headers: headersMock }));

vi.mock('@/components/features/restaurant-settings/RestaurantSettingsPageShell', () => ({
  RestaurantSettingsPageShell: ({ children }: { children: React.ReactNode }) => ({
    type: 'settings-shell',
    props: { children },
  }),
}));

vi.mock('@/server/supabase', () => ({
  getServerComponentSupabaseClient: getServerComponentSupabaseClientMock,
  resolveServiceRoleSupabaseUrl: resolveServiceRoleSupabaseUrlMock,
}));

vi.mock('@/server/auth/request-user', () => ({
  getRequestUser: getRequestUserMock,
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMembershipsCached: fetchUserMembershipsCachedMock,
  requireAdminMembership: requireAdminMembershipMock,
}));

import { APP_REQUEST_PATH_HEADER } from '@/lib/url/app-request-path';
import RestaurantSettingsLayout from '@/src/app/app/(app)/settings/restaurant/layout';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';

describe('RestaurantSettingsLayout security', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookieGetMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({ get: cookieGetMock });
    headerGetMock.mockReset();
    headerGetMock.mockImplementation((name: string) =>
      name.toLowerCase() === 'host' ? 'app.localhost:5180' : null,
    );
    headersMock.mockReset();
    headersMock.mockResolvedValue({ get: headerGetMock });
    getUserMock.mockReset();
    getServerComponentSupabaseClientMock.mockReset();
    getServerComponentSupabaseClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
    });
    getRequestUserMock.mockReset();
    getRequestUserMock.mockImplementation(async () => {
      const {
        data: { user },
        error,
      } = await getUserMock();
      return { user, error };
    });
    fetchUserMembershipsCachedMock.mockReset();
    requireAdminMembershipMock.mockReset();
  });

  it('redirects unauthenticated users before membership checks', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining('/app/auth/signin'));
    expect(fetchUserMembershipsCachedMock).not.toHaveBeenCalled();
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
  });

  it('preserves the requested restaurant settings path and query in auth redirects', async () => {
    headerGetMock.mockImplementation((name: string) => {
      if (name.toLowerCase() === 'host') return 'localhost:5180';
      if (name.toLowerCase() === APP_REQUEST_PATH_HEADER) {
        return '/app/settings/restaurant/email-templates?source=legacy';
      }
      return null;
    });
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith(
      '/app/auth/signin?redirectedFrom=%2Fapp%2Fsettings%2Frestaurant%2Femail-templates%3Fsource%3Dlegacy',
    );
  });

  it('falls back to the canonical profile route when the request-path header is unsafe', async () => {
    headerGetMock.mockImplementation((name: string) => {
      if (name.toLowerCase() === 'host') return 'localhost:5180';
      if (name.toLowerCase() === APP_REQUEST_PATH_HEADER) return 'https://evil.example/settings';
      return null;
    });
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith(
      '/app/auth/signin?redirectedFrom=%2Fapp%2Fsettings%2Frestaurant%2Fprofile',
    );
  });

  it('resolves the viewer through the shared per-request getRequestUser helper', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(getRequestUserMock).toHaveBeenCalledTimes(1);
    expect(getServerComponentSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('redirects active non-admin restaurant members away from settings', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieGetMock.mockReturnValue({ value: RESTAURANT_ID });
    fetchUserMembershipsCachedMock.mockResolvedValue([
      { restaurant_id: RESTAURANT_ID, role: 'host' },
    ]);

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(fetchUserMembershipsCachedMock).toHaveBeenCalledWith(USER_ID);
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/app/bookings');
  });

  it.each(['server', 'host', 'unknown-role'])(
    'rejects the %s role using the already-fetched memberships',
    async (role) => {
      getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
      cookieGetMock.mockReturnValue({ value: RESTAURANT_ID });
      fetchUserMembershipsCachedMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role }]);

      await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
        'NEXT_REDIRECT',
      );

      expect(redirectMock).toHaveBeenCalledWith('/app/bookings');
    },
  );

  it('does not grant settings for another restaurant when the active-restaurant cookie is forged', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    // Cookie names a restaurant this user has no membership in; they are only a
    // host at their own restaurant, so they must still be rejected.
    cookieGetMock.mockReturnValue({ value: OTHER_RESTAURANT_ID });
    fetchUserMembershipsCachedMock.mockResolvedValue([
      { restaurant_id: RESTAURANT_ID, role: 'host' },
    ]);

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith('/app/bookings');
  });

  it('redirects users with no memberships at all', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieGetMock.mockReturnValue({ value: OTHER_RESTAURANT_ID });
    fetchUserMembershipsCachedMock.mockResolvedValue([]);

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith('/app/bookings');
  });

  it('checks the admin role of the active restaurant, not an admin role held elsewhere', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieGetMock.mockReturnValue({ value: RESTAURANT_ID });
    fetchUserMembershipsCachedMock.mockResolvedValue([
      { restaurant_id: OTHER_RESTAURANT_ID, role: 'owner' },
      { restaurant_id: RESTAURANT_ID, role: 'server' },
    ]);

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith('/app/bookings');
  });

  it.each(['owner', 'manager'])(
    'renders settings for an active restaurant %s without a second membership query',
    async (role) => {
      getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
      cookieGetMock.mockReturnValue({ value: RESTAURANT_ID });
      fetchUserMembershipsCachedMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role }]);

      const result = await RestaurantSettingsLayout({ children: 'allowed' });

      expect(result).toEqual(
        expect.objectContaining({
          props: expect.objectContaining({ children: 'allowed' }),
        }),
      );
      expect(redirectMock).not.toHaveBeenCalled();
      expect(requireAdminMembershipMock).not.toHaveBeenCalled();
      expect(getUserMock).toHaveBeenCalledTimes(1);
    },
  );
});
