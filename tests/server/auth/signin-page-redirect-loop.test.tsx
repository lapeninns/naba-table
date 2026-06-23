import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
);
const headersMock = vi.hoisted(() => vi.fn());
const headerGetMock = vi.hoisted(() => vi.fn());
const ensureCsrfCookieMock = vi.hoisted(() => vi.fn());
const getServerComponentSupabaseClientMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/headers', () => ({ headers: headersMock }));

vi.mock('@/components/auth/OpsSignInForm', () => ({
  OpsSignInForm: () => null,
}));

vi.mock('@/components/auth/GuestSignInForm', () => ({
  GuestSignInForm: () => null,
}));

vi.mock('@/components/guest/ui', () => ({
  GuestPanel: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => children,
  AlertDescription: ({ children }: { children: React.ReactNode }) => children,
  AlertTitle: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => children,
  CardContent: ({ children }: { children: React.ReactNode }) => children,
  CardFooter: ({ children }: { children: React.ReactNode }) => children,
  CardHeader: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => null,
}));

vi.mock('@/server/security/csrf', () => ({
  ensureCsrfCookie: ensureCsrfCookieMock,
}));

vi.mock('@/server/supabase', () => ({
  getServerComponentSupabaseClient: getServerComponentSupabaseClientMock,
}));

import PublicSignInPage from '@/src/app/(public)/auth/signin/page';
import OpsAuthSignInPage from '@/src/app/app/auth/signin/page';

describe('sign-in page redirect-loop guard', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    headersMock.mockReset();
    headerGetMock.mockReset();
    headerGetMock.mockReturnValue('app.localhost:3000');
    headersMock.mockResolvedValue({ get: headerGetMock });
    ensureCsrfCookieMock.mockReset();
    getServerComponentSupabaseClientMock.mockReset();
    getUserMock.mockReset();
    getServerComponentSupabaseClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
    });
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
  });

  it('renders the app-host sign-in page after an auth-guard handoff without re-redirecting', async () => {
    const result = await OpsAuthSignInPage({
      searchParams: Promise.resolve({ redirectedFrom: '/settings/restaurant/profile' }),
    });

    expect(result).toBeTruthy();
    expect(ensureCsrfCookieMock).toHaveBeenCalledOnce();
    expect(getServerComponentSupabaseClientMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('preserves authenticated app-host sign-in redirects when there is no handoff target', async () => {
    await expect(
      OpsAuthSignInPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(getServerComponentSupabaseClientMock).toHaveBeenCalledOnce();
    expect(getUserMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('renders the public sign-in page after an auth-guard handoff without re-redirecting', async () => {
    headerGetMock.mockReturnValue('localhost:3000');

    const result = await PublicSignInPage({
      searchParams: Promise.resolve({ redirectedFrom: '/bookings/booking-1' }),
    });

    expect(result).toBeTruthy();
    expect(ensureCsrfCookieMock).toHaveBeenCalledOnce();
    expect(getServerComponentSupabaseClientMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
