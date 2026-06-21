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

vi.mock('@/server/team/access', () => ({
  fetchUserMembershipsCached: fetchUserMembershipsCachedMock,
  requireAdminMembership: requireAdminMembershipMock,
}));

import { APP_REQUEST_PATH_HEADER } from '@/lib/url/app-request-path';
import RestaurantSettingsLayout from '@/src/app/app/(app)/settings/restaurant/layout';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

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

  it('redirects active non-admin restaurant members away from settings', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieGetMock.mockReturnValue({ value: RESTAURANT_ID });
    fetchUserMembershipsCachedMock.mockResolvedValue([
      { restaurant_id: RESTAURANT_ID, role: 'host' },
    ]);
    requireAdminMembershipMock.mockRejectedValue(new Error('Insufficient permissions'));

    await expect(RestaurantSettingsLayout({ children: 'blocked' })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(requireAdminMembershipMock).toHaveBeenCalledWith({
      userId: USER_ID,
      restaurantId: RESTAURANT_ID,
    });
    expect(redirectMock).toHaveBeenCalledWith('/app/bookings');
  });

  it('renders settings only after an active restaurant admin membership passes', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieGetMock.mockReturnValue({ value: RESTAURANT_ID });
    fetchUserMembershipsCachedMock.mockResolvedValue([
      { restaurant_id: RESTAURANT_ID, role: 'manager' },
    ]);
    requireAdminMembershipMock.mockResolvedValue({
      restaurant_id: RESTAURANT_ID,
      role: 'manager',
    });

    const result = await RestaurantSettingsLayout({ children: 'allowed' });

    expect(result).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({ children: 'allowed' }),
      }),
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
