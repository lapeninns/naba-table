import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const featureFlagEqMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { resetEnvCache } from '@/lib/env';
import { isEmailQueueEnabled } from '@/server/feature-flags';
import {
  clearFeatureFlagOverrideCache,
  prefetchFeatureFlagOverrides,
} from '@/server/feature-flags-overrides';

const ORIGINAL_ENV = { ...process.env };

function applyBaseEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'production',
    APP_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://www.nabatable.com',
    NEXT_PUBLIC_SITE_URL: 'https://www.nabatable.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    RESEND_API_KEY: 'resend-key',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'turnstile-site-key',
    TURNSTILE_SECRET_KEY: 'turnstile-secret-key',
    AUTH_AUDIT_HASH_SECRET: 'audit-secret',
    CRON_SECRET: 'cron-secret',
    NEXT_PUBLIC_POSTHOG_KEY: 'posthog-key',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
    ...overrides,
  };
  resetEnvCache();
  clearFeatureFlagOverrideCache();
}

describe('server feature flags', () => {
  beforeEach(() => {
    featureFlagEqMock.mockReset();
    featureFlagEqMock.mockResolvedValue({ data: [], error: null });
    getServiceSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: featureFlagEqMock,
        })),
      })),
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetEnvCache();
    clearFeatureFlagOverrideCache();
  });

  it('defaults the durable email queue on in production when the flag is unset', () => {
    applyBaseEnv({ FEATURE_EMAIL_QUEUE_ENABLED: undefined });

    expect(isEmailQueueEnabled()).toBe(true);
  });

  it('preserves an explicit durable email queue opt-out', () => {
    applyBaseEnv({ FEATURE_EMAIL_QUEUE_ENABLED: 'false' });

    expect(isEmailQueueEnabled()).toBe(false);
  });

  it('scopes feature flag overrides by APP_ENV instead of NODE_ENV', async () => {
    applyBaseEnv({ NODE_ENV: 'production', APP_ENV: 'staging' });

    await prefetchFeatureFlagOverrides();

    expect(featureFlagEqMock).toHaveBeenCalledWith('environment', 'staging');
  });
});
