import { describe, expect, it } from 'vitest';

import { resolveEnvSchemaTarget } from '@/config/env.schema';

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
