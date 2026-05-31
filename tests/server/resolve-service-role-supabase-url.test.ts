import { afterEach, describe, expect, it } from 'vitest';

import { resetEnvCache } from '@/lib/env';
import { resolveOpsEnvBanner } from '@/server/ops/resolve-ops-env-banner';
import { resolveServiceRoleSupabaseUrl } from '@/server/supabase';

const TEST_PRIMARY_SUPABASE_REF = 'abcdefghijklmnopqrst';
const TEST_ALT_SUPABASE_REF = '12345678901234567890';
const TEST_PRIMARY_SUPABASE_URL = `https://${TEST_PRIMARY_SUPABASE_REF}.supabase.co`;

function applyBaseServiceRoleSupabaseEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_PRIMARY_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  Object.assign(process.env, overrides);
  resetEnvCache();
}

describe('resolveServiceRoleSupabaseUrl', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'staging';
    process.env.VERCEL_ENV = undefined;
    applyBaseServiceRoleSupabaseEnv();
  });

  afterEach(() => {
    delete process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA;
    delete process.env.SUPABASE_READ_REPLICA_URL;
    delete process.env.VERCEL_ENV;
    process.env.APP_ENV = 'test';
    resetEnvCache();
  });

  it('uses the primary URL when the replica flag is off', () => {
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'false';
    process.env.SUPABASE_READ_REPLICA_URL = `https://replica.${TEST_PRIMARY_SUPABASE_REF}.supabase.co`;
    resetEnvCache();
    expect(resolveServiceRoleSupabaseUrl()).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
  });

  it('uses the replica URL on staging when it is pinned to the same project', () => {
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'true';
    process.env.SUPABASE_READ_REPLICA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    resetEnvCache();
    expect(resolveServiceRoleSupabaseUrl()).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
  });

  it('rejects alternate service URLs for a different Supabase project', () => {
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'true';
    process.env.SUPABASE_READ_REPLICA_URL = `https://${TEST_ALT_SUPABASE_REF}.supabase.co`;
    resetEnvCache();
    expect(() => resolveServiceRoleSupabaseUrl()).toThrow(/same Supabase project/);
  });

  it('rejects non-Supabase alternate service URLs', () => {
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'true';
    process.env.SUPABASE_READ_REPLICA_URL = 'https://attacker.example';
    resetEnvCache();
    expect(() => resolveServiceRoleSupabaseUrl()).toThrow(/exact Supabase project API host/);
  });

  it('ignores the replica when VERCEL_ENV is production', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'true';
    process.env.SUPABASE_READ_REPLICA_URL = `https://replica.${TEST_PRIMARY_SUPABASE_REF}.supabase.co`;
    resetEnvCache();
    expect(resolveServiceRoleSupabaseUrl()).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
  });
});

describe('resolveOpsEnvBanner', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'staging';
    process.env.VERCEL_ENV = undefined;
    applyBaseServiceRoleSupabaseEnv();
  });

  afterEach(() => {
    delete process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA;
    delete process.env.SUPABASE_READ_REPLICA_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.OPS_ENV_BANNER;
    process.env.APP_ENV = 'test';
    resetEnvCache();
  });

  it('returns OPS_ENV_BANNER when set', () => {
    process.env.OPS_ENV_BANNER = '  Custom notice  ';
    resetEnvCache();
    expect(resolveOpsEnvBanner()).toBe('Custom notice');
  });

  it('does not show the replica notice when the service URL is pinned to the primary project', () => {
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'true';
    process.env.SUPABASE_READ_REPLICA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    resetEnvCache();
    expect(resolveOpsEnvBanner()).toBeNull();
  });
});
