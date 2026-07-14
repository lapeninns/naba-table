import { describe, expect, it } from 'vitest';

import { assertQaEnvironment, QaEnvironmentGuardError } from '@/scripts/qa';

describe('QA environment guard', () => {
  it('fails before execution when target env is production', () => {
    expect(() =>
      assertQaEnvironment({
        env: { APP_ENV: 'production', QA_RUN_ID: 'qa-env-prod' },
      }),
    ).toThrowError(QaEnvironmentGuardError);
  });

  it('blocks production Nabatable domains and subdomains', () => {
    expect(() =>
      assertQaEnvironment({
        env: {
          NEXT_PUBLIC_APP_URL: 'https://app.nabatable.com',
          QA_RUN_ID: 'qa-prod-domain',
        },
      }),
    ).toThrow(/production-like target URL/);

    expect(() =>
      assertQaEnvironment({
        env: {
          NEXT_PUBLIC_SITE_URL: 'https://www.nabatable.com',
          QA_RUN_ID: 'qa-prod-domain-2',
        },
      }),
    ).toThrow(/production-like target URL/);

    expect(() =>
      assertQaEnvironment({
        env: {
          QA_RUN_ID: 'qa-prod-domain-3',
          QA_TARGET_URL: 'nabatable.com',
        },
      }),
    ).toThrow(/production-like target URL/);
  });

  it('blocks the production Supabase project ref as an active target', () => {
    expect(() =>
      assertQaEnvironment({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://vrdiqfudmwydclqpydee.supabase.co',
          QA_RUN_ID: 'qa-prod-supabase',
        },
      }),
    ).toThrow(/production-like target URL/);

    expect(() =>
      assertQaEnvironment({
        env: {
          QA_RUN_ID: 'qa-prod-supabase-db',
          SUPABASE_DB_URL:
            'postgresql://postgres.vrdiqfudmwydclqpydee:password@aws-0-eu-west-2.pooler.supabase.com/postgres',
        },
      }),
    ).toThrow(/production-like target URL/);

    expect(() =>
      assertQaEnvironment({
        env: {
          QA_RUN_ID: 'qa-prod-database-url',
          DATABASE_URL:
            'postgresql://postgres.vrdiqfudmwydclqpydee:password@aws-0-eu-west-2.pooler.supabase.com/postgres',
        },
      }),
    ).toThrow(/production-like target URL/);

    expect(() =>
      assertQaEnvironment({
        env: {
          QA_RUN_ID: 'qa-prod-db-url',
          DB_URL:
            'postgresql://postgres.vrdiqfudmwydclqpydee:password@aws-0-eu-west-2.pooler.supabase.com/postgres',
        },
      }),
    ).toThrow(/production-like target URL/);
  });

  it('redacts credentials and query strings from production target errors', () => {
    const password = 'Sup3rSecretPassword';
    let message = '';

    try {
      assertQaEnvironment({
        env: {
          QA_RUN_ID: 'qa-prod-target-redaction',
          SUPABASE_DB_URL: `postgresql://postgres.vrdiqfudmwydclqpydee:${password}@aws-0-eu-west-2.pooler.supabase.com/postgres?access_token=leaky`,
        },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('[credentials-redacted]@aws-0-eu-west-2.pooler.supabase.com');
    expect(message).not.toContain(password);
    expect(message).not.toContain('postgres.vrdiqfudmwydclqpydee');
    expect(message).not.toContain('access_token');
    expect(message).not.toContain('leaky');
  });

  it('blocks production-like Nabatable Vercel aliases', () => {
    for (const targetUrl of [
      'https://nabatable.vercel.app',
      'https://nabatable-lapen-inns-projects.vercel.app',
      'https://nabatable-git-main-lapen-inns-projects.vercel.app',
      'https://nabatable-amanmain-lapen-inns-projects.vercel.app',
      'https://nabatable-production-lapen-inns-projects.vercel.app',
    ]) {
      expect(() =>
        assertQaEnvironment({
          env: {
            QA_RUN_ID: 'qa-prod-vercel',
            QA_TARGET_URL: targetUrl,
          },
        }),
      ).toThrow(/production-like target URL/);
    }
  });

  it('fails clearly when required credentials are missing', () => {
    expect(() =>
      assertQaEnvironment({
        env: {
          APP_ENV: 'test',
          NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
          QA_RUN_ID: 'qa-missing-creds',
        },
        requiredEnv: ['QA_PERSONA_CONFIG_JSON'],
      }),
    ).toThrow(/Missing required QA credential/);
  });

  it('requires explicit local permission for destructive local QA', () => {
    expect(() =>
      assertQaEnvironment({
        destructive: true,
        env: {
          APP_ENV: 'test',
          NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
          QA_RUN_ID: 'qa-destructive-blocked',
        },
      }),
    ).toThrow(/QA_ALLOW_DESTRUCTIVE=local/);

    const result = assertQaEnvironment({
      destructive: true,
      env: {
        APP_ENV: 'test',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
        QA_ALLOW_DESTRUCTIVE: 'local',
        QA_RUN_ID: 'qa-destructive-local',
      },
    });

    expect(result.targetClass).toBe('local');
    expect(result.destructiveAllowed).toBe(true);
  });

  it('requires explicit staging-like permission for destructive remote preview QA', () => {
    const result = assertQaEnvironment({
      destructive: true,
      env: {
        NEXT_PUBLIC_SITE_URL: 'https://nabatable-git-pr-123-lapen-inns-projects.vercel.app',
        QA_ALLOW_DESTRUCTIVE: 'staging-like',
        QA_RUN_ID: 'qa-destructive-preview',
      },
    });

    expect(result.targetClass).toBe('staging-like');
    expect(result.destructiveAllowed).toBe(true);
  });

  it('requires mock, dry-run, sandbox, or test-sink proof for external mutations', () => {
    expect(() =>
      assertQaEnvironment({
        env: {
          APP_ENV: 'test',
          NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
          QA_RUN_ID: 'qa-external-blocked',
        },
        externalMutation: true,
      }),
    ).toThrow(/External mutation QA requires/);

    expect(
      assertQaEnvironment({
        env: {
          APP_ENV: 'test',
          NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
          QA_EXTERNAL_MUTATION_MODE: 'dry-run',
          QA_RUN_ID: 'qa-external-dry-run',
        },
        externalMutation: true,
      }).externalMutationMode,
    ).toBe('dry-run');

    expect(
      assertQaEnvironment({
        env: {
          APP_ENV: 'test',
          NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
          QA_RUN_ID: 'qa-external-mock',
          RESEND_USE_MOCK: 'true',
        },
        externalMutation: true,
      }).externalMutationMode,
    ).toBe('resend_use_mock');
  });

  it('assigns a QA_RUN_ID to accepted runs', () => {
    const env: Record<string, string | undefined> = {
      APP_ENV: 'test',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
    };

    const result = assertQaEnvironment({ env });

    expect(result.qaRunId).toMatch(/^qa-/);
    expect(env.QA_RUN_ID).toBe(result.qaRunId);
  });
});
