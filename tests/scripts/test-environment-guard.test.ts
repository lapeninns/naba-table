import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertQaEnvironment,
  QaEnvironmentGuardError,
  type QaEnvironmentGuardInput,
} from '@/scripts/qa/environment';

/**
 * Behavioral pins for the automated-test environment safety guard.
 *
 * Every test passes an explicit `env` object instead of mutating process.env, so parallel
 * suites cannot leak environment state. The one test that exercises the process.env default
 * path uses vi.stubEnv and is unstubbed in afterEach.
 */

type GuardEnv = Record<string, string | undefined>;

function guardEnv(overrides: GuardEnv = {}): GuardEnv {
  return {
    QA_RUN_ID: 'qa-environment-guard-suite',
    QA_TARGET_ENV: 'ci-ephemeral',
    ...overrides,
  };
}

function captureGuardError(input: QaEnvironmentGuardInput): QaEnvironmentGuardError {
  try {
    assertQaEnvironment(input);
  } catch (error) {
    if (error instanceof QaEnvironmentGuardError) return error;
    throw error;
  }
  throw new Error('Expected assertQaEnvironment to throw QaEnvironmentGuardError.');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assertQaEnvironment production blocklist', () => {
  it('rejects QA_TARGET_ENV=production before anything runs @contract @security @local-only', () => {
    const error = captureGuardError({ env: guardEnv({ QA_TARGET_ENV: 'production' }) });

    expect(error.code).toBe('QA_PRODUCTION_ENV');
    expect(error.message).toContain('QA_TARGET_ENV=production');
  });

  it('rejects the prod shorthand across every checked target-env key @contract @security @local-only', () => {
    for (const key of ['QA_TARGET_ENV', 'DB_TARGET_ENV', 'APP_ENV', 'VERCEL_ENV']) {
      const env = guardEnv({ QA_TARGET_ENV: undefined });
      env[key] = 'prod';

      expect(captureGuardError({ env }).code).toBe('QA_PRODUCTION_ENV');
    }
  });

  it('rejects a nabatable.com URL found in a checked env key @contract @security @local-only', () => {
    const error = captureGuardError({
      env: guardEnv({ NEXT_PUBLIC_SITE_URL: 'https://nabatable.com' }),
    });

    expect(error.code).toBe('QA_PRODUCTION_URL');
    expect(error.message).toContain('nabatable.com');
  });

  it('rejects nabatable subdomains and production Vercel hosts @contract @security @local-only', () => {
    expect(
      captureGuardError({
        env: guardEnv({ PLAYWRIGHT_BASE_URL: 'https://app.nabatable.com' }),
      }).code,
    ).toBe('QA_PRODUCTION_URL');

    expect(
      captureGuardError({ env: guardEnv(), targetUrls: ['https://nabatable.vercel.app'] }).code,
    ).toBe('QA_PRODUCTION_URL');

    expect(
      captureGuardError({
        env: guardEnv(),
        targetUrls: ['https://nabatable-git-main-lapen-inns-projects.vercel.app'],
      }).code,
    ).toBe('QA_PRODUCTION_URL');
  });

  it('still allows non-main Vercel preview deployments as staging-like @contract @security @local-only', () => {
    const result = assertQaEnvironment({
      env: guardEnv(),
      targetUrls: ['https://nabatable-git-feat-rota-lapen-inns-projects.vercel.app'],
    });

    expect(result.targetClass).toBe('staging-like');
  });

  it('rejects the production Supabase ref in hosts and connection-string usernames, redacting credentials @contract @security @local-only', () => {
    expect(
      captureGuardError({
        env: guardEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://vrdiqfudmwydclqpydee.supabase.co' }),
      }).code,
    ).toBe('QA_PRODUCTION_URL');

    const error = captureGuardError({
      env: guardEnv({
        DATABASE_URL:
          'postgresql://postgres.vrdiqfudmwydclqpydee:fixture-password@aws-0-eu-west-2.pooler.supabase.com:5432/postgres',
      }),
    });

    expect(error.code).toBe('QA_PRODUCTION_URL');
    expect(error.message).toContain('[credentials-redacted]@');
    expect(error.message).not.toContain('fixture-password');
  });

  it('rejects production URLs passed as explicit target URLs even with a clean env @contract @security @local-only', () => {
    const error = captureGuardError({
      env: guardEnv(),
      targetUrls: ['https://book.nabatable.com/reserve'],
    });

    expect(error.code).toBe('QA_PRODUCTION_URL');
  });
});

describe('assertQaEnvironment destructive gate', () => {
  it('fails closed when QA_ALLOW_DESTRUCTIVE is unset, empty, or token-free @contract @security @local-only', () => {
    for (const value of [undefined, '', '   ', ' , ,']) {
      const error = captureGuardError({
        destructive: true,
        env: guardEnv({ QA_ALLOW_DESTRUCTIVE: value, QA_TARGET_ENV: 'local' }),
      });

      expect(error.code).toBe('QA_DESTRUCTIVE_NOT_ALLOWED');
    }
  });

  it('allows destructive runs only with a matching target token @contract @security @local-only', () => {
    const result = assertQaEnvironment({
      destructive: true,
      env: guardEnv({ QA_ALLOW_DESTRUCTIVE: 'local', QA_TARGET_ENV: 'local' }),
    });

    expect(result.destructiveAllowed).toBe(true);
    expect(result.targetClass).toBe('local');
  });

  it('lets the local token cover ci-ephemeral but not the reverse @contract @security @local-only', () => {
    expect(
      assertQaEnvironment({
        destructive: true,
        env: guardEnv({ QA_ALLOW_DESTRUCTIVE: 'local' }),
      }).targetClass,
    ).toBe('ci-ephemeral');

    expect(
      captureGuardError({
        destructive: true,
        env: guardEnv({ QA_ALLOW_DESTRUCTIVE: 'ci-ephemeral', QA_TARGET_ENV: 'local' }),
      }).code,
    ).toBe('QA_DESTRUCTIVE_NOT_ALLOWED');
  });

  it('auto-classifies remote non-localhost targets as staging-like, raising the destructive bar @contract @security @local-only', () => {
    const env = guardEnv({
      QA_ALLOW_DESTRUCTIVE: 'local',
      QA_TARGET_ENV: 'local',
      QA_TARGET_URL: 'https://qa-preview.example.dev',
    });

    const error = captureGuardError({ destructive: true, env: { ...env } });
    expect(error.code).toBe('QA_DESTRUCTIVE_NOT_ALLOWED');
    expect(error.message).toContain('QA_ALLOW_DESTRUCTIVE=staging-like');

    const result = assertQaEnvironment({
      destructive: true,
      env: { ...env, QA_ALLOW_DESTRUCTIVE: 'staging-like' },
    });
    expect(result.targetClass).toBe('staging-like');
    expect(result.destructiveAllowed).toBe(true);
  });

  it('accepts staging and preview as staging-like destructive tokens @contract @security @local-only', () => {
    for (const token of ['staging', 'preview']) {
      const result = assertQaEnvironment({
        destructive: true,
        env: guardEnv({ QA_ALLOW_DESTRUCTIVE: token, QA_TARGET_ENV: 'staging-like' }),
      });

      expect(result.destructiveAllowed).toBe(true);
    }
  });

  it('keeps localhost-only targets classified as local @contract @security @local-only', () => {
    const result = assertQaEnvironment({
      env: guardEnv({
        NEXT_PUBLIC_APP_URL: 'http://app.localhost:3000',
        QA_TARGET_ENV: 'local',
        QA_TARGET_URL: 'http://127.0.0.1:3000',
        SUPABASE_URL: 'http://localhost:54321',
      }),
    });

    expect(result.targetClass).toBe('local');
  });

  it('treats scheme-less remote hostnames as remote targets @contract @security @local-only', () => {
    const result = assertQaEnvironment({
      env: guardEnv({ QA_TARGET_ENV: 'local' }),
      targetUrls: ['qa-preview.example.dev'],
    });

    expect(result.targetClass).toBe('staging-like');
  });
});

describe('assertQaEnvironment external mutation gate', () => {
  for (const mode of ['dry-run', 'mock', 'sandbox', 'test-sink']) {
    it(`accepts QA_EXTERNAL_MUTATION_MODE=${mode} for external-mutation runs @contract @security @local-only`, () => {
      const result = assertQaEnvironment({
        env: guardEnv({ QA_EXTERNAL_MUTATION_MODE: mode }),
        externalMutation: true,
      });

      expect(result.externalMutationMode).toBe(mode);
    });
  }

  it('rejects external mutation without any safety mode or flag @contract @security @local-only', () => {
    const error = captureGuardError({ env: guardEnv(), externalMutation: true });

    expect(error.code).toBe('QA_EXTERNAL_MUTATION_NOT_SAFE');
    expect(error.message).toContain('mock|dry-run|sandbox|test-sink');
  });

  it('rejects unsafe explicit modes even when a mock flag is also set @contract @security @local-only', () => {
    expect(
      captureGuardError({
        env: guardEnv({ QA_EXTERNAL_MUTATION_MODE: 'live' }),
        externalMutation: true,
      }).code,
    ).toBe('QA_EXTERNAL_MUTATION_NOT_SAFE');

    // An explicit-but-unsafe mode wins over QA_USE_MOCKS: the guard refuses rather than
    // silently downgrading to the mock flag.
    expect(
      captureGuardError({
        env: guardEnv({ QA_EXTERNAL_MUTATION_MODE: 'live', QA_USE_MOCKS: '1' }),
        externalMutation: true,
      }).code,
    ).toBe('QA_EXTERNAL_MUTATION_NOT_SAFE');
  });

  it('accepts a truthy QA_USE_MOCKS flag as the safety signal @contract @security @local-only', () => {
    for (const value of ['1', 'true']) {
      const result = assertQaEnvironment({
        env: guardEnv({ QA_USE_MOCKS: value }),
        externalMutation: true,
      });

      expect(result.externalMutationMode).toBe('qa_use_mocks');
    }

    expect(
      captureGuardError({
        env: guardEnv({ QA_USE_MOCKS: 'false' }),
        externalMutation: true,
      }).code,
    ).toBe('QA_EXTERNAL_MUTATION_NOT_SAFE');
  });

  it('reports a null mutation mode without blocking non-mutating runs @contract @local-only', () => {
    const result = assertQaEnvironment({ env: guardEnv() });

    expect(result.externalMutationMode).toBeNull();
  });
});

describe('assertQaEnvironment credentials and classification', () => {
  it('fails when required credential env vars are missing or blank @contract @security @local-only', () => {
    const error = captureGuardError({
      env: guardEnv({ SUPABASE_SERVICE_ROLE_KEY: '   ' }),
      requiredEnv: ['SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY'],
    });

    expect(error.code).toBe('QA_MISSING_CREDENTIAL');
    expect(error.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(error.message).toContain('RESEND_API_KEY');
  });

  it('passes when required credential env vars are present @contract @local-only', () => {
    const result = assertQaEnvironment({
      env: guardEnv({ RESEND_API_KEY: 'test-resend-api-key' }),
      requiredEnv: ['RESEND_API_KEY'],
    });

    expect(result.targetClass).toBe('ci-ephemeral');
  });

  it('rejects unsupported QA_TARGET_ENV values @contract @local-only', () => {
    const error = captureGuardError({ env: guardEnv({ QA_TARGET_ENV: 'qa-lab' }) });

    expect(error.code).toBe('QA_UNKNOWN_TARGET');
    expect(error.message).toContain('qa-lab');
  });

  it('falls back to APP_ENV, VERCEL_ENV, and CI when QA_TARGET_ENV is unset @contract @local-only', () => {
    const base: GuardEnv = { QA_RUN_ID: 'qa-environment-guard-suite' };

    expect(assertQaEnvironment({ env: { ...base } }).targetClass).toBe('local');
    expect(assertQaEnvironment({ env: { ...base, CI: 'true' } }).targetClass).toBe('ci-ephemeral');
    expect(assertQaEnvironment({ env: { ...base, APP_ENV: 'staging' } }).targetClass).toBe(
      'staging-like',
    );
    expect(assertQaEnvironment({ env: { ...base, VERCEL_ENV: 'preview' } }).targetClass).toBe(
      'staging-like',
    );
  });

  it('reuses a provided QA_RUN_ID and generates one into the env otherwise @contract @local-only', () => {
    expect(assertQaEnvironment({ env: guardEnv() }).qaRunId).toBe('qa-environment-guard-suite');

    const env = guardEnv({ QA_RUN_ID: undefined });
    const result = assertQaEnvironment({ env });

    expect(result.qaRunId).toMatch(/^qa-\d{8}T\d{9}Z-[0-9a-f]{12}$/);
    expect(env.QA_RUN_ID).toBe(result.qaRunId);
  });

  it('rejects malformed QA_RUN_ID values @contract @local-only', () => {
    expect(() => assertQaEnvironment({ env: guardEnv({ QA_RUN_ID: '!!bad run id!!' }) })).toThrow(
      /QA_RUN_ID/,
    );
  });

  it('collects explicit target URLs ahead of env-derived ones @contract @local-only', () => {
    const result = assertQaEnvironment({
      env: guardEnv({ QA_TARGET_URL: 'https://qa-preview.example.dev' }),
      targetUrls: [' https://qa-input.example.dev '],
    });

    expect(result.targetUrls).toEqual([
      'https://qa-input.example.dev',
      'https://qa-preview.example.dev',
    ]);
  });

  it('defaults to process.env when no env override is provided @contract @security @local-only', () => {
    vi.stubEnv('QA_TARGET_ENV', 'production');

    expect(() => assertQaEnvironment()).toThrow(QaEnvironmentGuardError);
  });
});
