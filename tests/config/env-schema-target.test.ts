import { describe, expect, it } from 'vitest';

import { extractSupabaseProjectRef, resolveEnvSchemaTarget } from '@/config/env.schema';

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

describe('extractSupabaseProjectRef', () => {
  it('extracts the project ref from a Supabase API URL', () => {
    expect(extractSupabaseProjectRef('https://ndxmivcrehsacuerwxtm.supabase.co')).toBe('ndxmivcrehsacuerwxtm');
  });

  it('extracts the project ref from a direct database URL', () => {
    expect(
      extractSupabaseProjectRef('postgresql://postgres:secret@db.ndxmivcrehsacuerwxtm.supabase.co:5432/postgres'),
    ).toBe('ndxmivcrehsacuerwxtm');
  });

  it('extracts the project ref from a pooler URL that encodes it in the username', () => {
    expect(
      extractSupabaseProjectRef(
        'postgresql://postgres.ndxmivcrehsacuerwxtm:secret@aws-1-eu-west-2.pooler.supabase.com:6543/postgres',
      ),
    ).toBe('ndxmivcrehsacuerwxtm');
  });
});
