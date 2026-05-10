import { describe, expect, it } from 'vitest';

import { findBlockedPublicEnvKeys, resolveEnvSchemaTarget } from '@/config/env.schema';

describe('resolveEnvSchemaTarget', () => {
  it('uses development schema for local staging builds', () => {
    expect(
      resolveEnvSchemaTarget({
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        VERCEL_ENV: undefined,
      }),
    ).toBe('development');
  });

  it('uses production schema for production app targets', () => {
    expect(
      resolveEnvSchemaTarget({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        VERCEL_ENV: undefined,
      }),
    ).toBe('production');
  });

  it('uses production schema for production vercel targets', () => {
    expect(
      resolveEnvSchemaTarget({
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        VERCEL_ENV: 'production',
      }),
    ).toBe('production');
  });

  it('preserves test schema selection', () => {
    expect(
      resolveEnvSchemaTarget({
        NODE_ENV: 'test',
        APP_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).toBe('test');
  });
});

describe('public env secret blocking', () => {
  it('blocks NEXT_PUBLIC secret-looking names unless explicitly allowlisted', () => {
    expect(
      findBlockedPublicEnvKeys({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        NEXT_PUBLIC_SITE_URL: 'https://www.nabatable.com',
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'secret',
        NEXT_PUBLIC_INVITE_TOKEN: 'secret',
        NEXT_PUBLIC_DATABASE_URL: 'postgres://secret',
      }),
    ).toEqual([
      'NEXT_PUBLIC_DATABASE_URL',
      'NEXT_PUBLIC_INVITE_TOKEN',
      'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    ]);
  });
});
