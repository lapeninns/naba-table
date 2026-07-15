import { describe, expect, it } from 'vitest';

import { assertQaEnvironment } from '@/scripts/qa';

describe('QA environment guard remote target classification', () => {
  it('treats remote active targets as staging-like even when APP_ENV is local/test', () => {
    const result = assertQaEnvironment({
      env: {
        APP_ENV: 'test',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
        NEXT_PUBLIC_SUPABASE_URL: 'https://ndxmivcrehsacuerwxtm.supabase.co',
        QA_RUN_ID: 'qa-remote-staging-like',
      },
    });

    expect(result.targetClass).toBe('staging-like');
  });

  it('treats generic database URLs as active remote targets', () => {
    const result = assertQaEnvironment({
      env: {
        APP_ENV: 'test',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
        DATABASE_URL:
          'postgresql://postgres.ndxmivcrehsacuerwxtm:password@aws-0-eu-west-2.pooler.supabase.com/postgres',
        QA_RUN_ID: 'qa-remote-database-url',
      },
    });

    expect(result.targetClass).toBe('staging-like');
  });

  it('treats remote active targets as staging-like even when QA_TARGET_ENV is local', () => {
    const result = assertQaEnvironment({
      env: {
        APP_ENV: 'test',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
        NEXT_PUBLIC_SUPABASE_URL: 'https://ndxmivcrehsacuerwxtm.supabase.co',
        QA_RUN_ID: 'qa-explicit-local-remote-staging-like',
        QA_TARGET_ENV: 'local',
      },
    });

    expect(result.targetClass).toBe('staging-like');
  });

  it('does not allow local destructive permission against a remote active target', () => {
    expect(() =>
      assertQaEnvironment({
        destructive: true,
        env: {
          APP_ENV: 'test',
          NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
          NEXT_PUBLIC_SUPABASE_URL: 'https://ndxmivcrehsacuerwxtm.supabase.co',
          QA_ALLOW_DESTRUCTIVE: 'local',
          QA_RUN_ID: 'qa-remote-local-denied',
        },
      }),
    ).toThrow(/QA_ALLOW_DESTRUCTIVE=staging-like/);
  });

  it('does not allow local destructive permission when explicit local env points at a remote target', () => {
    expect(() =>
      assertQaEnvironment({
        destructive: true,
        env: {
          APP_ENV: 'test',
          NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
          NEXT_PUBLIC_SUPABASE_URL: 'https://ndxmivcrehsacuerwxtm.supabase.co',
          QA_ALLOW_DESTRUCTIVE: 'local',
          QA_RUN_ID: 'qa-explicit-local-remote-denied',
          QA_TARGET_ENV: 'local',
        },
      }),
    ).toThrow(/QA_ALLOW_DESTRUCTIVE=staging-like/);
  });
});
