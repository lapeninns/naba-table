import { describe, expect, it, vi } from 'vitest';

import {
  OPTIONAL_ENV_VARS,
  REQUIRED_ENV_VARS,
  type ValidationSummary,
  validateEnvironment,
} from '@/scripts/validate-env';

const baseEnv = (): NodeJS.ProcessEnv => ({
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
});

const fullEnv = (): NodeJS.ProcessEnv => ({
  ...baseEnv(),
  SUPABASE_DB_URL: 'postgres://user:pass@db.supabase.co:5432/postgres',
  RESEND_API_KEY: 'resend',
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'app.example.com',
});

const createLogger = () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe('validateEnvironment', () => {
  it('fails when any required variable is missing', () => {
    const env: NodeJS.ProcessEnv = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      // SUPABASE_SERVICE_ROLE_KEY intentionally missing
    };
    const logger = createLogger();

    const summary = validateEnvironment({ env, nodeEnv: 'development', logger });

    expect(summary.hasErrors).toBe(true);
    expect(summary.missingRequired).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
    expect(summary.warningCount).toBe(0);
    expect(logger.error).toHaveBeenCalledWith('❌ Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
    expect(logger.error).toHaveBeenCalledWith('\n❌ Environment validation failed. Please check your .env.local file.');
  });

  it('emits warnings for missing optional variables in production', () => {
    const env: NodeJS.ProcessEnv = {
      ...baseEnv(),
      SUPABASE_DB_URL: 'postgres://user:pass@db.supabase.co:5432/postgres',
    };
    const logger = createLogger();

    const summary = validateEnvironment({ env, nodeEnv: 'production', logger });

    const expectedMissing = OPTIONAL_ENV_VARS.filter((name) => env[name] === undefined);

    expect(summary.hasErrors).toBe(false);
    expect(summaryWarningCount(summary)).toBe(expectedMissing.length);
    expect(summary.missingOptional).toEqual(expectedMissing);
    expectedMissing.forEach((varName) => {
      expect(logger.warn).toHaveBeenCalledWith(
        `⚠️  Optional environment variable not set: ${varName} (recommended for production)`,
      );
    });
  });

  it('does not warn for optional variables outside production', () => {
    const env: NodeJS.ProcessEnv = baseEnv();
    const logger = createLogger();

    const summary = validateEnvironment({ env, nodeEnv: 'development', logger });

    expect(summary.hasErrors).toBe(false);
    expect(summaryWarningCount(summary)).toBe(0);
    expect(summary.missingOptional).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes when all required and optional variables are present', () => {
    const env = fullEnv();
    const logger = createLogger();

    const summary = validateEnvironment({ env, nodeEnv: 'production', logger });

    expect(summary.hasErrors).toBe(false);
    expect(summaryWarningCount(summary)).toBe(0);
    expect(summary.missingRequired).toHaveLength(0);
    expect(summary.missingOptional).toHaveLength(0);
    expect(summary.totalChecked).toBe(Object.keys(env).length);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

function summaryWarningCount(summary: ValidationSummary) {
  return summary.warningCount;
}
