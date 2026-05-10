import { describe, expect, it } from 'vitest';

import {
  buildVercelPreviewEnvListArgs,
  extractSupabaseProjectRefFromApiUrl,
  extractSupabaseProjectRefFromDatabaseUrl,
  parseSmsDeliveryReadinessArgs,
} from '@/scripts/sms-delivery-readiness';

describe('buildVercelPreviewEnvListArgs', () => {
  it('builds the generic Preview metadata command', () => {
    expect(buildVercelPreviewEnvListArgs(null)).toEqual([
      'vercel',
      'env',
      'ls',
      'preview',
      '--format',
      'json',
    ]);
  });

  it('builds the branch-specific Preview metadata command', () => {
    expect(buildVercelPreviewEnvListArgs('codex/Menu')).toEqual([
      'vercel',
      'env',
      'ls',
      'preview',
      'codex/Menu',
      '--format',
      'json',
    ]);
  });
});

describe('parseSmsDeliveryReadinessArgs', () => {
  it('supports skipping pulled and local env files for Vercel env-run', () => {
    expect(
      parseSmsDeliveryReadinessArgs([
        '--target',
        'staging',
        '--check-vercel-env',
        '--vercel-git-branch',
        'codex/Menu',
        '--callback-base-url',
        'https://preview.example.com',
        '--expected-staging-project-ref',
        'ndxmivcrehsacuerwxtm',
        '--strict',
        '--skip-pulled-env-files',
        '--skip-local-env-files',
      ]),
    ).toMatchObject({
      target: 'staging',
      checkVercelEnv: true,
      vercelGitBranch: 'codex/Menu',
      callbackBaseUrl: 'https://preview.example.com',
      expectedStagingProjectRef: 'ndxmivcrehsacuerwxtm',
      expectedStagingProjectRefSource: 'expected-arg',
      strict: true,
      skipPulledEnvFiles: true,
      skipLocalEnvFiles: true,
    });
  });
});

describe('Supabase project ref parsing', () => {
  it('extracts project refs from Supabase API and database URLs', () => {
    expect(extractSupabaseProjectRefFromApiUrl('https://ndxmivcrehsacuerwxtm.supabase.co')).toBe(
      'ndxmivcrehsacuerwxtm',
    );
    expect(
      extractSupabaseProjectRefFromDatabaseUrl(
        'postgresql://postgres.ndxmivcrehsacuerwxtm:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
      ),
    ).toBe('ndxmivcrehsacuerwxtm');
    expect(
      extractSupabaseProjectRefFromDatabaseUrl(
        'postgresql://postgres:pw@db.ndxmivcrehsacuerwxtm.supabase.co:5432/postgres',
      ),
    ).toBe('ndxmivcrehsacuerwxtm');
  });
});
