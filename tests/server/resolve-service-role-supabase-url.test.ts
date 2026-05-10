import { afterEach, describe, expect, it } from 'vitest';

import { resetEnvCache } from '@/lib/env';
import { resolveOpsEnvBanner } from '@/server/ops/resolve-ops-env-banner';
import { resolveServiceRoleSupabaseUrl } from '@/server/supabase';

describe('resolveServiceRoleSupabaseUrl', () => {
  afterEach(() => {
    delete process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA;
    delete process.env.SUPABASE_READ_REPLICA_URL;
    delete process.env.VERCEL_ENV;
    process.env.APP_ENV = 'test';
    resetEnvCache();
  });

  it('uses the primary URL when the replica flag is off', () => {
    process.env.APP_ENV = 'staging';
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'false';
    process.env.SUPABASE_READ_REPLICA_URL = 'https://replica.example.supabase.co';
    resetEnvCache();
    expect(resolveServiceRoleSupabaseUrl()).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
  });

  it('uses the replica URL on staging when the flag is on', () => {
    process.env.APP_ENV = 'staging';
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'true';
    process.env.SUPABASE_READ_REPLICA_URL = 'https://replica.example.supabase.co';
    resetEnvCache();
    expect(resolveServiceRoleSupabaseUrl()).toBe('https://replica.example.supabase.co');
  });

  it('ignores the replica when VERCEL_ENV is production', () => {
    process.env.APP_ENV = 'staging';
    process.env.VERCEL_ENV = 'production';
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'true';
    process.env.SUPABASE_READ_REPLICA_URL = 'https://replica.example.supabase.co';
    resetEnvCache();
    expect(resolveServiceRoleSupabaseUrl()).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
  });
});

describe('resolveOpsEnvBanner', () => {
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

  it('returns default replica notice when service URL differs from primary', () => {
    process.env.APP_ENV = 'staging';
    process.env.FEATURE_SERVICE_CLIENT_USE_READ_REPLICA = 'true';
    process.env.SUPABASE_READ_REPLICA_URL = 'https://replica.example.supabase.co';
    resetEnvCache();
    const banner = resolveOpsEnvBanner();
    expect(banner).toContain('read-replica');
  });
});
