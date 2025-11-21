import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../scripts/validate-env';

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://local.supabase.dev',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-local',
  SUPABASE_SERVICE_ROLE_KEY: 'service-local',
  RESERVE_API_BASE_URL: 'http://localhost:3000/api',
};

describe('validate-environment guards', () => {
  it('blocks non-production envs from using production credentials', () => {
    const summary = validateEnvironment({
      env: {
        ...BASE_ENV,
        APP_ENV: 'development',
        NODE_ENV: 'development',
        PRODUCTION_SUPABASE_URL: BASE_ENV.NEXT_PUBLIC_SUPABASE_URL,
        PRODUCTION_SUPABASE_ANON_KEY: BASE_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        PRODUCTION_SUPABASE_SERVICE_ROLE_KEY: BASE_ENV.SUPABASE_SERVICE_ROLE_KEY,
        PRODUCTION_BOOKING_API_BASE_URL: BASE_ENV.RESERVE_API_BASE_URL,
      },
      nodeEnv: 'development',
    });

    expect(summary.safetyErrors.length).toBeGreaterThan(0);
    expect(summary.hasErrors).toBe(true);
  });

  it('requires production markers to match live values in production', () => {
    const summary = validateEnvironment({
      env: {
        ...BASE_ENV,
        APP_ENV: 'production',
        NODE_ENV: 'production',
        PRODUCTION_SUPABASE_URL: 'https://prod.supabase.fake',
        PRODUCTION_SUPABASE_ANON_KEY: 'anon-prod',
        PRODUCTION_SUPABASE_SERVICE_ROLE_KEY: 'service-prod',
        PRODUCTION_BOOKING_API_BASE_URL: 'https://api.prod.sajilo',
      },
      nodeEnv: 'production',
    });

    expect(summary.productionMarkerErrors.length).toBe(4);
    expect(summary.hasErrors).toBe(true);
  });
});
