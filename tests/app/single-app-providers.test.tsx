import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthListener = (event: string, session: Session | null) => void;

// Plain mutable state instead of vi.fn implementations: the Vitest config sets
// mockReset, which would wipe implementations before each test.
const harness = vi.hoisted(() => ({
  posthogMounts: 0,
  queryLayerMounts: 0,
  sessionResult: null as Session | null,
  userResult: null as User | null,
  authListeners: [] as AuthListener[],
  persistenceKeys: [] as string[],
  clearedKeys: [] as string[],
}));

vi.mock('@/lib/supabase/browser', () => {
  // Singleton, like the real browser client: a fresh object per render would
  // re-run the provider's subscription effect on every render.
  const client = {
    auth: {
      getSession: async () => ({ data: { session: harness.sessionResult }, error: null }),
      getUser: async () => ({ data: { user: harness.userResult }, error: null }),
      setSession: async () => ({ data: {}, error: null }),
      onAuthStateChange: (listener: AuthListener) => {
        harness.authListeners.push(listener);
        const unsubscribe = () => {
          harness.authListeners = harness.authListeners.filter((entry) => entry !== listener);
        };
        return { data: { subscription: { unsubscribe } } };
      },
    },
  };
  return { getSupabaseBrowserClient: () => client };
});

vi.mock('@/lib/posthog/provider', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => {
    React.useEffect(() => {
      harness.posthogMounts += 1;
    }, []);
    return children;
  },
}));

vi.mock('@/components/features/account-sessions/SessionActivityReporter', () => ({
  // Rendered exactly once per QueryLayer, so it counts QueryClient providers.
  SessionActivityReporter: () => {
    React.useEffect(() => {
      harness.queryLayerMounts += 1;
    }, []);
    return null;
  },
}));

vi.mock('@/lib/monitoring/clientReporter', () => ({ useClientErrorReporter: () => undefined }));

vi.mock('@/lib/query/persist', () => ({
  buildQueryStorageKey: (userId: string | null) => `test-query-cache:${userId ?? 'anonymous'}`,
  clearPersistedQueryCache: (key: string) => {
    harness.clearedKeys.push(key);
  },
  configureQueryPersistence: (_client: QueryClient, { storageKey }: { storageKey: string }) => {
    harness.persistenceKeys.push(storageKey);
    return () => undefined;
  },
}));

// Ops layout server dependencies.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => 'app.nabatable.test' }),
}));
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('unexpected redirect');
  },
  usePathname: () => '/app',
}));
vi.mock('@/server/auth/qa-ops-session', () => ({
  QA_OPS_AUTH_COOKIE_NAME: 'qa-ops',
  getQaOpsAuthFixture: () => ({
    user: { id: 'ops-user', email: null },
    memberships: [
      {
        restaurantId: 'restaurant-1',
        restaurantName: 'Restaurant',
        restaurantSlug: null,
        role: 'owner',
        createdAt: null,
      },
    ],
  }),
}));
vi.mock('@/server/ops/resolve-ops-env-banner', () => ({ resolveOpsEnvBanner: () => null }));
vi.mock('@/server/supabase', () => ({ getServerComponentSupabaseClient: async () => ({}) }));
vi.mock('@/server/team/access', () => ({ fetchUserMembershipsCached: async () => [] }));
vi.mock('@/components/features/ops-shell/OpsShell', () => ({
  OpsShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/contexts/ops-services', () => ({
  OpsServicesProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/contexts/ops-session', () => ({
  OpsSessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import OpsAppLayout from '@/src/app/app/(app)/layout';
import { AppProviders } from '@/src/app/providers';

import type { Session, User } from '@supabase/supabase-js';

let probedClient: QueryClient | null = null;

function Probe() {
  const queryClient = useQueryClient();
  const { status } = useSupabaseSession();
  React.useEffect(() => {
    probedClient = queryClient;
  }, [queryClient]);
  return <p data-testid="status">{status}</p>;
}

function makeUser(id: string): User {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function makeSession(user: User): Session {
  return {
    access_token: `access-${user.id}`,
    refresh_token: `refresh-${user.id}`,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
}

beforeEach(() => {
  harness.posthogMounts = 0;
  harness.queryLayerMounts = 0;
  harness.sessionResult = null;
  harness.userResult = null;
  harness.authListeners = [];
  harness.persistenceKeys = [];
  harness.clearedKeys = [];
  probedClient = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('single AppProviders mount', () => {
  it('renders ops pages inside the root providers without a second QueryClient or PostHog', async () => {
    const user = makeUser('ops-user');
    harness.sessionResult = makeSession(user);
    harness.userResult = user;

    const opsTree = await OpsAppLayout({ children: <Probe /> });
    render(<AppProviders initialSession={null}>{opsTree}</AppProviders>);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(harness.posthogMounts).toBe(1);
    expect(harness.queryLayerMounts).toBe(1);
    // One Supabase auth subscription means one session provider.
    expect(harness.authListeners).toHaveLength(1);
  });

  it('keeps the query cache when the anonymous bootstrap resolves to a signed-in user', async () => {
    const user = makeUser('ops-user');
    harness.sessionResult = makeSession(user);
    harness.userResult = user;

    const opsTree = await OpsAppLayout({ children: <Probe /> });
    render(<AppProviders initialSession={null}>{opsTree}</AppProviders>);

    act(() => {
      probedClient?.setQueryData(['ops', 'fetched-before-session-resolved'], 'kept');
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    await waitFor(() => expect(harness.persistenceKeys).toContain('test-query-cache:ops-user'));

    // Persistence is only configured once the real session is known, so ops data
    // is never persisted under the anonymous key.
    expect(harness.persistenceKeys).toEqual(['test-query-cache:ops-user']);
    expect(probedClient?.getQueryData(['ops', 'fetched-before-session-resolved'])).toBe('kept');
  });

  it('still clears the cache on a real sign-in after a confirmed anonymous session', async () => {
    render(
      <AppProviders initialSession={null}>
        <Probe />
      </AppProviders>,
    );

    await waitFor(() => expect(harness.persistenceKeys).toEqual(['test-query-cache:anonymous']));

    act(() => {
      probedClient?.setQueryData(['guest', 'anonymous-data'], 'anonymous');
    });

    const user = makeUser('guest-user');
    harness.userResult = user;
    act(() => {
      for (const listener of harness.authListeners) listener('SIGNED_IN', makeSession(user));
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    await waitFor(() =>
      expect(harness.persistenceKeys).toEqual([
        'test-query-cache:anonymous',
        'test-query-cache:guest-user',
      ]),
    );
    expect(harness.clearedKeys).toContain('test-query-cache:anonymous');
    expect(probedClient?.getQueryData(['guest', 'anonymous-data'])).toBeUndefined();
  });

  it('clears the cache and switches storage key on sign-out', async () => {
    const user = makeUser('ops-user');
    harness.sessionResult = makeSession(user);
    harness.userResult = user;

    render(
      <AppProviders initialSession={null}>
        <Probe />
      </AppProviders>,
    );

    await waitFor(() => expect(harness.persistenceKeys).toEqual(['test-query-cache:ops-user']));
    act(() => {
      probedClient?.setQueryData(['ops', 'private'], 'private');
    });

    act(() => {
      for (const listener of harness.authListeners) listener('SIGNED_OUT', null);
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    await waitFor(() =>
      expect(harness.persistenceKeys).toEqual([
        'test-query-cache:ops-user',
        'test-query-cache:anonymous',
      ]),
    );
    expect(harness.clearedKeys).toContain('test-query-cache:ops-user');
    expect(probedClient?.getQueryData(['ops', 'private'])).toBeUndefined();
  });
});
