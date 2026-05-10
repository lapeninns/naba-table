import { describe, expect, it } from 'vitest';

import {
  buildPreviewAuditReport,
  parseVercelPreviewAuditArgs,
} from '@/scripts/sms-delivery-vercel-preview-audit';

describe('Vercel Preview SMS delivery audit', () => {
  it('parses branch and expected staging project ref args', () => {
    expect(
      parseVercelPreviewAuditArgs([
        '--branch',
        'codex/Menu',
        '--expected-staging-project-ref',
        'ndxmivcrehsacuerwxtm',
      ]),
    ).toEqual({
      branch: 'codex/Menu',
      expectedStagingProjectRef: 'ndxmivcrehsacuerwxtm',
    });
  });

  it('reports missing Twilio keys and Supabase project mismatches without secret values', () => {
    const report = buildPreviewAuditReport(
      {
        branch: 'codex/Menu',
        expectedStagingProjectRef: 'ndxmivcrehsacuerwxtm',
      },
      {
        NEXT_PUBLIC_APP_URL: 'https://${VERCEL_URL}',
        NEXT_PUBLIC_SITE_URL: 'not-a-url',
        BASE_URL: '',
        NEXT_PUBLIC_SUPABASE_URL: 'https://rrpeokmfbtbrirqjprpe.supabase.co',
        SUPABASE_DB_URL:
          'postgresql://postgres.vrdiqfudmwydclqpydee@aws.pooler.supabase.com:6543/postgres',
        SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role',
      },
      {
        genericPreviewKeysPresent: [
          'NEXT_PUBLIC_APP_URL',
          'NEXT_PUBLIC_SITE_URL',
          'NEXT_PUBLIC_SUPABASE_URL',
          'SUPABASE_DB_URL',
          'SUPABASE_SERVICE_ROLE_KEY',
        ],
        branchPreviewKeysPresent: [],
      },
    );

    expect(report.ok).toBe(false);
    expect(report.twilio.keysMissing).toEqual([
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_API_KEY_SID',
      'TWILIO_API_KEY_SECRET',
      'TWILIO_MESSAGING_SERVICE_SID',
    ]);
    expect(report.urlEnv).toEqual({
      requiredKeys: ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'BASE_URL'],
      keysPresent: ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL'],
      validConcreteKeys: [],
      vercelRuntimeResolvableKeys: ['NEXT_PUBLIC_APP_URL'],
      invalidPresentKeys: ['NEXT_PUBLIC_SITE_URL'],
      callbackBaseUrlSatisfied: true,
    });
    expect(report.supabase).toMatchObject({
      apiProjectRef: 'rrpeokmfbtbrirqjprpe',
      databaseProjectRef: 'vrdiqfudmwydclqpydee',
      serviceRolePresent: true,
      apiMatchesExpected: false,
      databaseMatchesExpected: false,
    });
    expect(report.metadata).toEqual({
      genericPreviewKeysPresent: [
        'NEXT_PUBLIC_APP_URL',
        'NEXT_PUBLIC_SITE_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_DB_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
      ],
      branchPreviewKeysPresent: [],
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('postgresql://');
    expect(serialized).not.toContain('supabase.co');
    expect(serialized).not.toContain('placeholder-service-role');
    expect(serialized).not.toContain('https://${VERCEL_URL}');
    expect(serialized).not.toContain('not-a-url');
  });

  it('accepts concrete Preview URL env values without exposing raw URLs', () => {
    const report = buildPreviewAuditReport(
      {
        branch: 'codex/Menu',
        expectedStagingProjectRef: 'ndxmivcrehsacuerwxtm',
      },
      {
        TWILIO_ACCOUNT_SID: 'present',
        TWILIO_AUTH_TOKEN: 'present',
        TWILIO_API_KEY_SID: 'present',
        TWILIO_API_KEY_SECRET: 'present',
        TWILIO_MESSAGING_SERVICE_SID: 'present',
        NEXT_PUBLIC_APP_URL: 'https://preview.example.com',
        NEXT_PUBLIC_SITE_URL: 'https://preview.example.com',
        BASE_URL: 'https://preview.example.com',
        NEXT_PUBLIC_SUPABASE_URL: 'https://ndxmivcrehsacuerwxtm.supabase.co',
        SUPABASE_DB_URL:
          'postgresql://postgres.ndxmivcrehsacuerwxtm@aws.pooler.supabase.com:6543/postgres',
        SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role',
      },
    );

    expect(report.urlEnv).toEqual({
      requiredKeys: ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'BASE_URL'],
      keysPresent: ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'BASE_URL'],
      validConcreteKeys: ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'BASE_URL'],
      vercelRuntimeResolvableKeys: [],
      invalidPresentKeys: [],
      callbackBaseUrlSatisfied: true,
    });
    expect(report.ok).toBe(true);
    expect(JSON.stringify(report)).not.toContain('preview.example.com');
  });

  it('requires at least one concrete or Vercel-resolvable callback base URL key', () => {
    const report = buildPreviewAuditReport(
      {
        branch: 'codex/Menu',
        expectedStagingProjectRef: 'ndxmivcrehsacuerwxtm',
      },
      {
        TWILIO_ACCOUNT_SID: 'present',
        TWILIO_AUTH_TOKEN: 'present',
        TWILIO_API_KEY_SID: 'present',
        TWILIO_API_KEY_SECRET: 'present',
        TWILIO_MESSAGING_SERVICE_SID: 'present',
        BASE_URL: 'https://preview.example.com',
        NEXT_PUBLIC_SUPABASE_URL: 'https://ndxmivcrehsacuerwxtm.supabase.co',
        SUPABASE_DB_URL:
          'postgresql://postgres.ndxmivcrehsacuerwxtm@aws.pooler.supabase.com:6543/postgres',
        SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role',
      },
    );

    expect(report.urlEnv.callbackBaseUrlSatisfied).toBe(false);
    expect(report.blockers).toContain(
      'Vercel Preview env for branch codex/Menu needs one valid callback base URL key: NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL',
    );
    expect(report.ok).toBe(false);
  });
});
