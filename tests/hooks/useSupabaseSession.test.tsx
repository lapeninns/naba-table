import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupabaseSessionProvider, useSupabaseSession } from '@/hooks/useSupabaseSession';

import type { Session, User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

const supabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    setSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowserClient: () => supabase,
}));

const user = { id: 'user-1', email: 'guest@example.com' } as User;

function makeSession(accessToken = 'access-1'): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-1',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as Session;
}

type AuthCallback = (event: string, session: Session | null) => void;

let authCallback: AuthCallback | undefined;
let unsubscribe: ReturnType<typeof vi.fn>;

function providerWrapper(initialSession?: Session | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SupabaseSessionProvider initialSession={initialSession}>{children}</SupabaseSessionProvider>
    );
  };
}

describe('useSupabaseSession', () => {
  beforeEach(() => {
    authCallback = undefined;
    unsubscribe = vi.fn();
    supabase.auth.onAuthStateChange.mockImplementation((callback: AuthCallback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe } } };
    });
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabase.auth.setSession.mockResolvedValue({ data: {}, error: null });
  });

  it('@contract @external-mock resolves to unauthenticated when no session exists', async () => {
    const { result } = renderHook(() => useSupabaseSession(), { wrapper: providerWrapper() });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it('@contract @external-mock authenticates once getUser confirms the session user', async () => {
    const session = makeSession();
    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const { result } = renderHook(() => useSupabaseSession(), { wrapper: providerWrapper() });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(user);
    expect(result.current.session).toEqual(session);
  });

  it('@contract @external-mock treats getUser failures as signed out', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: makeSession() }, error: null });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    const { result } = renderHook(() => useSupabaseSession(), { wrapper: providerWrapper() });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
  });

  it('@contract @external-mock signs the user out on the SIGNED_OUT auth event', async () => {
    const session = makeSession();
    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const { result } = renderHook(() => useSupabaseSession(), { wrapper: providerWrapper() });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    act(() => authCallback?.('SIGNED_OUT', null));

    expect(result.current).toEqual({ user: null, session: null, status: 'unauthenticated' });
  });

  it('@contract @external-mock reuses the cached user on TOKEN_REFRESHED without re-fetching', async () => {
    const session = makeSession();
    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const { result } = renderHook(() => useSupabaseSession(), { wrapper: providerWrapper() });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    const getUserCalls = supabase.auth.getUser.mock.calls.length;
    const refreshed = makeSession('access-2');

    act(() => authCallback?.('TOKEN_REFRESHED', refreshed));

    expect(result.current.status).toBe('authenticated');
    expect(result.current.session).toEqual(refreshed);
    expect(result.current.user).toEqual(user);
    expect(supabase.auth.getUser.mock.calls.length).toBe(getUserCalls);
  });

  it('@contract @external-mock hydrates the browser client from a server-issued session', async () => {
    const session = makeSession();
    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const { result } = renderHook(() => useSupabaseSession(), {
      wrapper: providerWrapper(session),
    });

    await waitFor(() =>
      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
  });

  it('@contract falls back to a loading state without a provider', () => {
    const { result } = renderHook(() => useSupabaseSession());

    expect(result.current).toEqual({ user: null, session: null, status: 'loading' });
  });

  it('@contract @external-mock unsubscribes from auth changes on unmount', async () => {
    const { unmount, result } = renderHook(() => useSupabaseSession(), {
      wrapper: providerWrapper(),
    });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
