import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getPgSslConfig } from '@/scripts/db/pg-ssl';
import {
  assertExactSupabaseApiProjectRef,
  assertExactSupabaseProjectRef,
  assertProductionApiScriptSafety,
  assertProductionScriptSafety,
  assertStagingScriptSafety,
} from '@/scripts/db/safety';

const repoRoot = process.cwd();

function readScript(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('script DB safety', () => {
  it('validates Supabase project refs exactly from DB host and user', () => {
    expect(
      assertExactSupabaseProjectRef(
        'postgresql://postgres.actualrefabcdefghijk:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
        'actualrefabcdefghijk',
      ),
    ).toBe('actualrefabcdefghijk');

    expect(() =>
      assertExactSupabaseProjectRef(
        'postgresql://postgres:pw@db.notactualrefabcdefghijk.supabase.co:5432/postgres',
        'actualrefabcdefghijk',
      ),
    ).toThrow(/mismatch/);
  });

  it('validates Supabase API project refs exactly instead of substring matching', () => {
    expect(
      assertExactSupabaseApiProjectRef(
        'https://actualrefabcdefghij.supabase.co',
        'actualrefabcdefghij',
      ),
    ).toBe('actualrefabcdefghij');
    expect(() =>
      assertExactSupabaseApiProjectRef(
        'https://notactualrefabcdefghij.supabase.co',
        'actualrefabcdefghij',
      ),
    ).toThrow(/mismatch/);
  });

  it('fails closed for destructive production apply without confirmation and break-glass', () => {
    expect(() =>
      assertProductionScriptSafety({
        connectionString:
          'postgresql://postgres.actualrefabcdefghijk:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
        expectedProjectRef: 'actualrefabcdefghijk',
        targetEnv: 'production',
        apply: true,
        destructive: true,
        requireRestaurant: true,
        targetRestaurant: 'the-venue',
        confirmation: 'true',
        breakGlass: undefined,
      }),
    ).toThrow(/BREAK_GLASS_PRODUCTION=true/);
  });

  it('requires explicit production target env when requested', () => {
    expect(() =>
      assertProductionScriptSafety({
        connectionString:
          'postgresql://postgres.actualrefabcdefghijk:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
        expectedProjectRef: 'actualrefabcdefghijk',
        requireTargetEnv: true,
        apply: true,
        destructive: true,
        confirmation: 'true',
        breakGlass: 'true',
      }),
    ).toThrow(/DB_TARGET_ENV=production or APP_ENV=production/);
  });

  it('treats the production project ref itself as production even without target env', () => {
    expect(() =>
      assertProductionScriptSafety({
        connectionString:
          'postgresql://postgres.actualrefabcdefghijk:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
        expectedProjectRef: 'actualrefabcdefghijk',
        apply: true,
      }),
    ).toThrow(/CONFIRM_PRODUCTION=true/);
  });

  it('rejects production target env when the DB URL points at a different project', () => {
    expect(() =>
      assertProductionScriptSafety({
        connectionString:
          'postgresql://postgres.otherrefabcdefghijkl:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
        expectedProjectRef: 'actualrefabcdefghijk',
        targetEnv: 'production',
        apply: true,
        confirmation: 'true',
      }),
    ).toThrow(/Supabase project ref mismatch/);
  });

  it('guards production API scripts with exact project ref and target env', () => {
    expect(() =>
      assertProductionApiScriptSafety({
        apiUrl: 'https://actualrefabcdefghijk.supabase.co',
        expectedProjectRef: 'actualrefabcdefghijk',
        targetEnv: 'production',
        requireTargetEnv: true,
        apply: true,
      }),
    ).toThrow(/CONFIRM_PRODUCTION=true/);

    expect(() =>
      assertProductionApiScriptSafety({
        apiUrl: 'https://otherrefabcdefghijkl.supabase.co',
        expectedProjectRef: 'actualrefabcdefghijk',
        targetEnv: 'production',
        requireTargetEnv: true,
        apply: true,
        confirmation: 'true',
      }),
    ).toThrow(/Supabase API project ref mismatch/);
  });

  it('requires staging env, exact project ref, and confirmation for staging writes', () => {
    const expectedProjectRef = 'actualrefabcdefghijk';
    const apiUrl = `https://${expectedProjectRef}.supabase.co`;

    expect(
      assertStagingScriptSafety({
        apiUrl,
        expectedProjectRef,
        targetEnv: 'staging',
        confirmation: 'true',
      }),
    ).toBe(expectedProjectRef);

    expect(() =>
      assertStagingScriptSafety({
        apiUrl,
        expectedProjectRef,
        confirmation: 'true',
      }),
    ).toThrow(/DB_TARGET_ENV=staging or APP_ENV=staging/);

    expect(() =>
      assertStagingScriptSafety({
        apiUrl,
        expectedProjectRef,
        targetEnv: 'production',
        confirmation: 'true',
      }),
    ).toThrow(/Refusing staging script against target env "production"/);

    expect(() =>
      assertStagingScriptSafety({
        apiUrl: 'https://otherrefabcdefghijk.supabase.co',
        expectedProjectRef,
        targetEnv: 'staging',
        confirmation: 'true',
      }),
    ).toThrow(/Supabase API project ref mismatch/);

    expect(() =>
      assertStagingScriptSafety({
        apiUrl,
        expectedProjectRef,
        targetEnv: 'staging',
      }),
    ).toThrow(/CONFIRM_STAGING_WRITE=true/);
  });

  it('keeps Postgres TLS certificate verification enabled by default', () => {
    expect(getPgSslConfig({} as NodeJS.ProcessEnv)).toEqual({ rejectUnauthorized: true });
  });

  it('keeps Postgres TLS certificate verification enabled when a CA is provided inline', () => {
    expect(
      getPgSslConfig({
        SUPABASE_DB_CA_CERT: '-----BEGIN CERTIFICATE-----\\ncert\\n-----END CERTIFICATE-----',
      } as NodeJS.ProcessEnv),
    ).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
    });
  });

  it('keeps database scripts from disabling TLS certificate verification', () => {
    for (const script of [
      'scripts/apply-sql-file.ts',
      'scripts/run-production-optimization.ts',
      'scripts/staging/replay-perf-workload.ts',
      'scripts/verify-zone-adjacencies.ts',
      'scripts/run-schema-optimization.ts',
      'scripts/db-perf-baseline.ts',
      'scripts/find-supabase-region.ts',
      'scripts/ensure-auth-user.ts',
      'scripts/staging/seed-perf-dataset.ts',
      'scripts/sms-delivery-readiness.ts',
    ]) {
      const source = readScript(script);
      expect(source).not.toContain('rejectUnauthorized: false');
      expect(source).toContain('getPgSslConfig');
    }
  });

  it('keeps production access dry-run auth resolution read-only', () => {
    const source = readScript('scripts/grant-production-restaurant-access.ts');
    const mainBody = source.slice(
      source.indexOf('async function main()'),
      source.indexOf('void main().catch'),
    );

    expect(mainBody).toContain('resolveExistingAuthUser(userEmail)');
    expect(mainBody.indexOf('if (!apply)')).toBeLessThan(
      mainBody.indexOf('ensureAuthUser(userEmail)'),
    );
    expect(mainBody).toContain('wouldCreateAuthUser');
  });

  it('guards staging staff import before constructing the destination admin client', () => {
    const source = readScript('scripts/staging/import-prod-staff.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertStagingScriptSafety');
    expect(source).toContain('CONFIRM_STAGING_STAFF_IMPORT');
    expect(source).toContain('stagingRef === params.prodRef');
    expect(source).toContain('EXPECTED_STAGING_PROJECT_REF');
    expect(source).toContain('DB_TARGET_ENV');
    expect(source).toContain('APP_ENV');
    expect(mainBody.indexOf('requireConfirmedStagingDestination')).toBeLessThan(
      mainBody.indexOf('createClient<Database>(stagingUrl'),
    );
    expect(source).toContain('mode: 0o600');
    expect(source).toContain('fs.chmodSync(outPath, 0o600)');
    expect(source).toContain('fs.chmodSync(outputDir, 0o700)');
  });

  it('requires the Supabase region probe password from environment only', () => {
    const source = readScript('scripts/find-supabase-region.ts');

    expect(source).toContain('process.env.SUPABASE_DB_PASSWORD');
    expect(source).not.toContain('process.argv[3]');
    expect(source).not.toContain('<db_password>');
  });

  it('does not pass Vercel tokens on the setup-notifications-domain command line', () => {
    const source = readScript('scripts/email/setup-notifications-domain.ts');
    const runBody = source.slice(
      source.indexOf('function runVercelDnsAdd'),
      source.indexOf('async function getOrCreateDomain'),
    );

    expect(runBody).not.toContain('"--token"');
    expect(runBody).toContain('env: { ...process.env, VERCEL_TOKEN: token }');
  });

  it('does not log soft-hold session tokens from manual table assignment release failures', () => {
    const source = readScript('server/capacity/table-assignment/manual.ts');
    const warningBlocks = [
      source.match(
        /console\.warn\('\[capacity\]\[manual\] Failed to release soft-holds after hold creation'[\s\S]*?\n\s*\}\);/,
      )?.[0],
      source.match(
        /console\.warn\('\[capacity\]\[manual\]\[instant\] Failed to release soft-holds'[\s\S]*?\n\s*\}\);/,
      )?.[0],
    ].filter((block): block is string => Boolean(block));

    expect(warningBlocks.length).toBeGreaterThan(0);
    for (const block of warningBlocks) {
      expect(block).not.toContain('sessionToken:');
    }
  });

  it('does not pass Vercel tokens on the setup-notifications-domain command line', () => {
    const source = readScript('scripts/email/setup-notifications-domain.ts');
    const runBody = source.slice(
      source.indexOf('function runVercelDnsAdd'),
      source.indexOf('async function getOrCreateDomain'),
    );

    expect(runBody).not.toContain('"--token"');
    expect(runBody).toContain('env: { ...process.env, VERCEL_TOKEN: token }');
  });

  it('does not log soft-hold session tokens from manual table assignment release failures', () => {
    const source = readScript('server/capacity/table-assignment/manual.ts');
    const warningBlocks = [
      source.match(
        /console\.warn\('\[capacity\]\[manual\] Failed to release soft-holds after hold creation'[\s\S]*?\n\s*\}\);/,
      )?.[0],
      source.match(
        /console\.warn\('\[capacity\]\[manual\]\[instant\] Failed to release soft-holds'[\s\S]*?\n\s*\}\);/,
      )?.[0],
    ].filter((block): block is string => Boolean(block));

    expect(warningBlocks.length).toBeGreaterThan(0);
    for (const block of warningBlocks) {
      expect(block).not.toContain('sessionToken:');
    }
  });

  it('keeps SQL file runner behind mandatory project-ref validation and production confirmation', () => {
    const source = readScript('scripts/apply-sql-file.ts');

    expect(source).toContain('normalizeSupabaseProjectRef');
    expect(source).toContain('assertExactSupabaseProjectRef(connectionString, expectedProjectRef)');
    expect(source).toContain('CONFIRM_PRODUCTION=true');
    expect(
      source.indexOf('assertExactSupabaseProjectRef(connectionString, expectedProjectRef)'),
    ).toBeLessThan(source.indexOf('await client.connect()'));
  });

  it('keeps fixed SQL executor staging-only with explicit confirmation', () => {
    const source = readScript('scripts/execute-sql.ts');

    expect(source).toContain('assertStagingScriptSafety');
    expect(source).toContain('CONFIRM_SQL_EXECUTION');
    expect(source).toContain('DB_TARGET_ENV?.trim() || process.env.APP_ENV?.trim()');
    expect(source).toContain('SQL file is empty');
    expect(source.indexOf('assertStagingScriptSafety({')).toBeLessThan(
      source.indexOf('await client.connect()'),
    );
    expect(source.indexOf("fs.readFileSync(sqlPath, 'utf8')")).toBeLessThan(
      source.indexOf('const client = new Client'),
    );
  });

  it('guards schema optimization runner as a confirmed staging script', () => {
    const source = readScript('scripts/run-schema-optimization.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertStagingScriptSafety');
    expect(source).toContain('CONFIRM_STAGING_SCHEMA_OPTIMIZATION');
    expect(source).toContain('assertPhaseSucceeded');
    expect(source).toContain('orphanedCheckFailed');
    expect(mainBody.indexOf('assertStagingScriptSafety')).toBeLessThan(
      mainBody.indexOf('const client = new Client'),
    );
  });

  it('guards production optimization runner and fails hard on DDL phase errors', () => {
    const source = readScript('scripts/run-production-optimization.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertProductionScriptSafety');
    expect(source).toContain('requireTargetEnv: true');
    expect(source).toContain('CONFIRM_PRODUCTION_OPTIMIZATION');
    expect(source).toContain('CONFIRM_PRODUCTION_DDL');
    expect(source).toContain('runTransactionalPhase');
    expect(source).toContain('failedPhases.length > 0');
    expect(source).toContain('break;');
    expect(mainBody.indexOf('requireProductionTarget')).toBeLessThan(
      mainBody.indexOf('const client = new Client'),
    );
  });

  it('guards staging owner bootstrap before password persistence or service-role clients', () => {
    const source = readScript('scripts/staging/bootstrap-owner.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertStagingScriptSafety');
    expect(source).toContain('CONFIRM_STAGING_OWNER_BOOTSTRAP');
    expect(mainBody.indexOf('assertStagingScriptSafety')).toBeLessThan(
      mainBody.indexOf('writePasswordToGitignoredBackups'),
    );
    expect(mainBody.indexOf('assertStagingScriptSafety')).toBeLessThan(
      mainBody.indexOf('createClient<Database>(supabaseUrl'),
    );
  });

  it('guards auth reset script for explicit staging or production targets before admin client use', () => {
    const source = readScript('scripts/ensure-auth-user.ts');

    expect(source).toContain('assertAuthUserScriptSafety');
    expect(source).toContain('CONFIRM_STAGING_AUTH_RESET');
    expect(source).toContain('CONFIRM_PRODUCTION_AUTH_RESET');
    expect(source).toContain(
      'assertExactSupabaseApiProjectRef(checkedSupabaseUrl, expectedProjectRef)',
    );
    expect(source).toContain('assertExactSupabaseProjectRef(dbUrl, expectedProjectRef)');
    expect(source.indexOf('assertAuthUserScriptSafety()')).toBeLessThan(
      source.indexOf('createClient(checkedSupabaseUrl, checkedServiceRoleKey'),
    );
  });

  it('guards staging perf seed against stale linked refs and actual DB URL mismatch', () => {
    const source = readScript('scripts/staging/seed-perf-dataset.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertStagingScriptSafety');
    expect(source).toContain('CONFIRM_STAGING_PERF_SEED');
    expect(source).toContain('assertLinkedStagingProject(apply, expectedProjectRef)');
    expect(source).toContain('connectionString');
    expect(source).toContain('fs.mkdirSync(artifactsDir, { recursive: true })');
    expect(mainBody.indexOf('if (!args.apply)')).toBeLessThan(
      mainBody.indexOf('buildPgConnectionString()'),
    );
    expect(mainBody.indexOf('assertStagingApplySafety')).toBeLessThan(
      mainBody.indexOf('await client.connect()'),
    );
  });

  it('keeps synthetic booking seed scripts staging-only and explicit restaurant targeted', () => {
    for (const script of [
      'scripts/generate-bookings-safe.ts',
      'scripts/seed-bookings-week.ts',
      'scripts/seed-bookings-week-final.ts',
    ]) {
      const source = readScript(script);

      expect(source).toContain('assertStagingScriptSafety');
      expect(source).toContain('CONFIRM_STAGING_BOOKING_SEED');
      expect(source).toContain('requireEnv');
      expect(source).toContain('RESTAURANT_ID');
      expect(source.indexOf('assertStagingScriptSafety({')).toBeLessThan(
        source.indexOf('const supabase = createClient'),
      );
    }
  });

  it('requires explicit restaurant seed owner and target guard', () => {
    const source = readScript('scripts/seed-restaurant.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertSeedRestaurantSafety');
    expect(source).toContain('CONFIRM_STAGING_RESTAURANT_SEED');
    expect(source).toContain('Set OWNER_USER_ID or OWNER_EMAIL before seeding a restaurant.');
    expect(source).not.toContain('using first auth user as owner');
    expect(mainBody.indexOf('assertSeedRestaurantSafety()')).toBeLessThan(
      mainBody.indexOf('Promise.all'),
    );
  });
});
