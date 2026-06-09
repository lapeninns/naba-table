import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    node: {
      appEnv: 'test',
    },
    misc: {},
  },
  getEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    NEXT_PUBLIC_ROOT_DOMAIN: 'localhost',
    NEXT_PUBLIC_DEFAULT_RESTAURANT_ID: null,
    NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG: null,
    SUPABASE_READ_REPLICA_URL: null,
    APP_ENV: 'test',
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/supabase/cookies', () => ({
  buildSupabaseCookieOptions: vi.fn(() => ({})),
  resolveCookieDomain: vi.fn(() => undefined),
}));

function restaurantId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}

describe('tenant service Supabase client cache', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockReset();
    createClientMock.mockImplementation((_url, _key, options) => ({
      options,
      instance: createClientMock.mock.calls.length,
    }));
  });

  it('bounds tenant client memoization and evicts the oldest idle entry', async () => {
    const { getTenantServiceSupabaseClient } = await import('@/server/supabase');
    const firstClient = getTenantServiceSupabaseClient(restaurantId(0));

    for (let index = 1; index <= 1_000; index += 1) {
      getTenantServiceSupabaseClient(restaurantId(index));
    }

    const reloadedFirstClient = getTenantServiceSupabaseClient(restaurantId(0));

    expect(createClientMock).toHaveBeenCalledTimes(1_002);
    expect(reloadedFirstClient).not.toBe(firstClient);
  });
});
