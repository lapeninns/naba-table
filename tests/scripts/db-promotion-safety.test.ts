import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runExtendedInspection } from '@/scripts/db/check-drift';
import {
  BACKUP_BUCKET_ENV,
  BACKUP_ROLE_URL_ENV,
  RESTORE_VERIFY_BACKUP_ID_ENV,
  RESTORE_VERIFY_DB_URL_ENV,
  RESTORE_VERIFY_PROJECT_REF_ENV,
  SCRUBBED_DELEGATE_ENV_KEYS,
  scrubDelegateEnv,
  validateBackupBucket,
  validateBackupIdentity,
  validateRestoreBackupId,
  validateRestoreVerifyTarget,
} from '@/scripts/db/migrations/backup-guard';
import {
  MIGRATION_CHECKSUMS_RELATIVE_PATH,
  MIGRATIONS_RELATIVE_PATH,
  compareCensus,
  computeMigrationCensus,
  createEmptyBaseline,
  isImmutabilitySatisfied,
  parseChecksumBaseline,
  recordUnrecorded,
  renderChecksumBaseline,
} from '@/scripts/db/migrations/checksums';
import {
  INVENTORY_SQL,
  compareInventory,
  normalizeInventory,
  parseInventoryBaseline,
  renderInventoryBaseline,
} from '@/scripts/db/migrations/drift-inventory';
import {
  compareLedger,
  migrationVersionFromFileName,
  parseMigrationList,
} from '@/scripts/db/migrations/ledger';
import { REFUSED_ARGUMENTS, findRefusedArgument } from '@/scripts/db/migrations/refusals';
import {
  expectedProjectRef,
  extractDatabaseRole,
  readLinkedProjectRef,
  validateRemoteTarget,
} from '@/scripts/db/migrations/targets';
import { createIsolatedSupabaseWorkdir } from '@/scripts/db/migrations/workdir';

const STAGING_REF = 'ndxmivcrehsacuerwxtm';
const PRODUCTION_REF = 'vrdiqfudmwydclqpydee';
const SCRATCH_REF = 'scratchrefabcdefghij';
const repoRoot = path.resolve(import.meta.dirname, '../..');
const temporaryDirectories: string[] = [];

function makeTempDir(prefix: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('remote target validation', () => {
  it('maps named targets to the fixed project refs', () => {
    expect(expectedProjectRef('staging')).toBe(STAGING_REF);
    expect(expectedProjectRef('production')).toBe(PRODUCTION_REF);
  });

  it('refuses when no project is linked', () => {
    const result = validateRemoteTarget({ target: 'staging', linkedProjectRef: null });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('No linked Supabase project');
  });

  it('refuses a linked ref that belongs to the other target', () => {
    const result = validateRemoteTarget({ target: 'staging', linkedProjectRef: PRODUCTION_REF });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain(
      `Linked Supabase project ref does not match staging: expected ${STAGING_REF}, linked ${PRODUCTION_REF}`,
    );
  });

  it('refuses a database host that addresses a different project', () => {
    const result = validateRemoteTarget({
      target: 'staging',
      linkedProjectRef: STAGING_REF,
      databaseUrl: `postgresql://postgres:pw@db.${PRODUCTION_REF}.supabase.co:5432/postgres`,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('Database connection does not match staging');
    expect(result.ok ? '' : result.message).not.toContain('pw@');
  });

  it('refuses a pooler user that names a different project', () => {
    const result = validateRemoteTarget({
      target: 'staging',
      linkedProjectRef: STAGING_REF,
      databaseUrl: `postgresql://postgres.${PRODUCTION_REF}:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('mismatch');
  });

  it('refuses a database host outside Supabase even when the user looks right', () => {
    const result = validateRemoteTarget({
      target: 'staging',
      linkedProjectRef: STAGING_REF,
      databaseUrl: `postgresql://postgres.${STAGING_REF}:pw@attacker.example:5432/postgres`,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('Unable to determine Supabase project ref');
  });

  it('refuses an API URL for a different project', () => {
    const result = validateRemoteTarget({
      target: 'production',
      linkedProjectRef: PRODUCTION_REF,
      apiUrl: `https://${STAGING_REF}.supabase.co`,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('Supabase API URL does not match production');
  });

  it('requires a database URL when the workflow needs one', () => {
    const result = validateRemoteTarget({
      target: 'staging',
      linkedProjectRef: STAGING_REF,
      requireDatabaseUrl: true,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('is required by this workflow');
  });

  it('accepts a fully matching staging target and reports the database role', () => {
    const result = validateRemoteTarget({
      target: 'staging',
      linkedProjectRef: STAGING_REF,
      databaseUrl: `postgresql://postgres.${STAGING_REF}:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`,
      apiUrl: `https://${STAGING_REF}.supabase.co`,
      requireDatabaseUrl: true,
    });

    expect(result).toEqual({ ok: true, projectRef: STAGING_REF, databaseRole: 'postgres' });
  });

  it('extracts roles from direct and pooler connection strings without the password', () => {
    expect(extractDatabaseRole('postgresql://nabatable_backup:pw@db.x.supabase.co/postgres')).toBe(
      'nabatable_backup',
    );
    expect(
      extractDatabaseRole(
        `postgresql://postgres.${STAGING_REF}:pw@aws.pooler.supabase.com/postgres`,
      ),
    ).toBe('postgres');
    expect(extractDatabaseRole('not a url')).toBeNull();
  });

  it('reads the linked project ref from a workdir and treats a blank file as unlinked', () => {
    const workdir = makeTempDir('nabatable-target-');
    expect(readLinkedProjectRef(workdir)).toBeNull();

    createLinkedWorkdir(workdir, ` ${STAGING_REF.toUpperCase()}\n`);
    expect(readLinkedProjectRef(workdir)).toBe(STAGING_REF);

    writeFileSync(path.join(workdir, 'supabase', '.temp', 'project-ref'), '   \n');
    expect(readLinkedProjectRef(workdir)).toBeNull();
  });
});

function createLinkedWorkdir(
  root: string,
  projectRef: string,
  migrations: Readonly<Record<string, string>> = {},
): void {
  const supabaseDirectory = path.join(root, 'supabase');
  const migrationsDirectory = path.join(supabaseDirectory, 'migrations');
  const tempDirectory = path.join(supabaseDirectory, '.temp');
  rmSync(supabaseDirectory, { force: true, recursive: true });
  mkdirSync(migrationsDirectory, { recursive: true });
  mkdirSync(tempDirectory, { recursive: true });
  writeFileSync(path.join(tempDirectory, 'project-ref'), projectRef);
  for (const [name, content] of Object.entries(migrations)) {
    writeFileSync(path.join(migrationsDirectory, name), content);
  }
}

describe('refused arguments', () => {
  it.each([
    ['repair', ['plan-remote', 'repair']],
    ['reset', ['status', 'reset']],
    ['--force', ['push', '--force']],
    ['--db-url', ['plan-remote', '--db-url=postgresql://x@y/z']],
    ['--include-seed', ['migrate', '--INCLUDE-SEED']],
    ['--version', ['push', '--version', '20260101000000']],
  ])('refuses %s wherever it appears', (token, args) => {
    expect(findRefusedArgument(args)?.token).toBe(token);
  });

  it('lets governed options through', () => {
    expect(findRefusedArgument(['plan-remote', '--dry-run'])).toBeNull();
    expect(findRefusedArgument(['migrate', '--include-all'])).toBeNull();
  });

  it('covers migration repair, database reset and historical replay controls', () => {
    const tokens = REFUSED_ARGUMENTS.map((entry) => entry.token);
    for (const required of ['repair', 'reset', 'wipe', '--force', '--db-url', '--version']) {
      expect(tokens).toContain(required);
    }
  });
});

describe('remote migration ledger reconciliation', () => {
  const ledger = [
    '',
    '        LOCAL      │     REMOTE     │     TIME (UTC)      ',
    '  ─────────────────┼────────────────┼─────────────────────',
    '    20260101000000 │ 20260101000000 │ 2026-01-01 00:00:00 ',
    '    20260102000000 │ 20260102000000 │ 2026-01-02 00:00:00 ',
    '    20260103000000 │                │                     ',
    '',
  ].join('\n');

  it('parses the CLI table into local/remote rows', () => {
    expect(parseMigrationList(ledger)).toEqual([
      { local: '20260101000000', remote: '20260101000000' },
      { local: '20260102000000', remote: '20260102000000' },
      { local: '20260103000000', remote: null },
    ]);
  });

  it('accepts a prefix-compatible ledger with pending newest migrations', () => {
    const comparison = compareLedger(parseMigrationList(ledger), [
      '20260101000000',
      '20260102000000',
      '20260103000000',
    ]);

    expect(comparison.ok).toBe(true);
    expect(comparison.pending).toEqual(['20260103000000']);
  });

  it('refuses remote-only versions because repair is never allowed', () => {
    const rows = parseMigrationList(
      `${ledger}\n                   │ 20260104000000 │ 2026-01-04 00:00:00 `,
    );
    const comparison = compareLedger(rows, ['20260101000000', '20260102000000', '20260103000000']);

    expect(comparison.ok).toBe(false);
    expect(comparison.remoteOnly).toEqual(['20260104000000']);
    expect(comparison.messages.join('\n')).toContain('migration repair is refused');
  });

  it('refuses pending versions that sit behind the newest applied version', () => {
    const rows = parseMigrationList(
      `${ledger}\n    20251231000000 │                │                     `,
    );
    const comparison = compareLedger(rows, [
      '20251231000000',
      '20260101000000',
      '20260102000000',
      '20260103000000',
    ]);

    expect(comparison.ok).toBe(false);
    expect(comparison.outOfOrderPending).toEqual(['20251231000000']);
    expect(comparison.messages.join('\n')).toContain('historical replay is refused');
  });

  it('refuses when the CLI view is missing local files or is empty', () => {
    expect(
      compareLedger(parseMigrationList(ledger), ['20260101000000', '20260105000000']).messages.join(
        '\n',
      ),
    ).toContain('absent from the CLI ledger view');
    expect(compareLedger([], []).messages.join('\n')).toContain('refusing to plan blind');
  });

  it('extracts versions from migration file names only', () => {
    expect(migrationVersionFromFileName('20260101000000_add_thing.sql')).toBe('20260101000000');
    expect(migrationVersionFromFileName('CONSOLIDATED_ALL_MIGRATIONS.sql')).toBeNull();
  });
});

describe('migration immutability census', () => {
  it('detects a modified recorded migration and never rewrites recorded entries', () => {
    const directory = makeTempDir('nabatable-census-');
    writeFileSync(path.join(directory, '20260101000000_a.sql'), 'select 1;\n');
    writeFileSync(path.join(directory, '20260102000000_b.sql'), 'select 2;\n');

    const baseline = recordUnrecorded(
      createEmptyBaseline('2026-09-04'),
      computeMigrationCensus(directory),
      '2026-09-04T00:00:00.000Z',
    );
    expect(
      isImmutabilitySatisfied(compareCensus(baseline, computeMigrationCensus(directory))),
    ).toBe(true);

    writeFileSync(path.join(directory, '20260101000000_a.sql'), 'select 1; -- edited\n');
    writeFileSync(path.join(directory, '20260103000000_c.sql'), 'select 3;\n');
    rmSync(path.join(directory, '20260102000000_b.sql'));
    const report = compareCensus(baseline, computeMigrationCensus(directory));

    expect(report.changed).toEqual(['20260101000000_a.sql']);
    expect(report.missing).toEqual(['20260102000000_b.sql']);
    expect(report.unrecorded).toEqual(['20260103000000_c.sql']);
    expect(isImmutabilitySatisfied(report)).toBe(false);

    const appended = recordUnrecorded(
      baseline,
      computeMigrationCensus(directory),
      '2026-09-05T00:00:00.000Z',
    );
    expect(appended.files['20260101000000_a.sql']).toEqual(baseline.files['20260101000000_a.sql']);
    expect(appended.files['20260103000000_c.sql']?.recordedAt).toBe('2026-09-05T00:00:00.000Z');
    expect(Object.keys(appended.files)).toEqual([
      '20260101000000_a.sql',
      '20260102000000_b.sql',
      '20260103000000_c.sql',
    ]);
  });

  it('round-trips through the JSON baseline and rejects unreviewed entries', () => {
    const baseline = recordUnrecorded(
      createEmptyBaseline('2026-09-04'),
      { '20260101000000_a.sql': { sha256: 'a'.repeat(64), bytes: 10 } },
      '2026-09-04T00:00:00.000Z',
    );
    const rendered = renderChecksumBaseline(baseline);

    expect(parseChecksumBaseline(rendered)).toEqual(baseline);
    expect(() =>
      parseChecksumBaseline(rendered.replace('"reviewed": true', '"reviewed": false')),
    ).toThrow(/not marked reviewed/);
    expect(() => parseChecksumBaseline('{')).toThrow(/not valid JSON/);
    expect(() => parseChecksumBaseline(rendered.replace('a'.repeat(64), 'zz'))).toThrow(
      /invalid sha256/,
    );
  });

  it('keeps the committed baseline consistent with the committed migration tree', () => {
    // Given: the baseline describes committed content. Comparing against HEAD (not the
    // working tree) keeps this contract deterministic on CI and on a developer machine
    // with uncommitted migration edits; the CLI (`pnpm db:check-migration-immutability`)
    // is what flags working-tree edits to an applied migration.
    const baseline = parseChecksumBaseline(
      readFileSync(path.join(repoRoot, MIGRATION_CHECKSUMS_RELATIVE_PATH), 'utf8'),
    );
    const committedRoot = makeTempDir('nabatable-committed-migrations-');
    execFileSync(
      'sh',
      [
        '-c',
        `git -C "$0" archive HEAD -- "$1" | tar -x -C "$2"`,
        repoRoot,
        MIGRATIONS_RELATIVE_PATH,
        committedRoot,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    const census = computeMigrationCensus(path.join(committedRoot, MIGRATIONS_RELATIVE_PATH));
    const report = compareCensus(baseline, census);

    expect(report.changed).toEqual([]);
    expect(report.missing).toEqual([]);
    expect(report.unrecorded).toEqual([]);
    expect(baseline.files['20260809120000_gbp_write_safety_foundation.sql']).toBeDefined();
    expect(baseline.note).toContain('NOT assumed safely replayable');
    expect(readFileSync(path.join(repoRoot, 'config/db/census.md'), 'utf8')).toContain(
      baseline.reviewedBaselineDate,
    );
  });
});

describe('backup identity guard', () => {
  const backupUrl = `postgresql://nabatable_backup:backup-secret@db.${STAGING_REF}.supabase.co:5432/postgres`;

  it('requires the dedicated backup identity', () => {
    const result = validateBackupIdentity({}, 'staging');

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain(
      `${BACKUP_ROLE_URL_ENV} (dedicated read-only backup identity) is required`,
    );
  });

  it.each([
    ['service_role', `postgresql://service_role:pw@db.${STAGING_REF}.supabase.co/postgres`],
    ['postgres', `postgresql://postgres:pw@db.${STAGING_REF}.supabase.co/postgres`],
    ['postgres', `postgresql://postgres.${STAGING_REF}:pw@aws-0.pooler.supabase.com/postgres`],
    ['supabase_admin', `postgresql://supabase_admin:pw@db.${STAGING_REF}.supabase.co/postgres`],
  ])('refuses the %s role as a backup identity', (role, url) => {
    const result = validateBackupIdentity({ [BACKUP_ROLE_URL_ENV]: url }, 'staging');

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain(`uses the ${role} role`);
    expect(result.ok ? '' : result.message).not.toContain('pw@');
  });

  it('refuses roles that are not visibly dedicated backup roles', () => {
    const result = validateBackupIdentity(
      { [BACKUP_ROLE_URL_ENV]: `postgresql://reporting:pw@db.${STAGING_REF}.supabase.co/postgres` },
      'staging',
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('not a dedicated backup role');
  });

  it('refuses a backup identity that addresses the wrong project', () => {
    const result = validateBackupIdentity({ [BACKUP_ROLE_URL_ENV]: backupUrl }, 'production');

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain(
      `targets project ${STAGING_REF} but production is ${PRODUCTION_REF}`,
    );
  });

  it('refuses reuse of deploy connection strings or passwords', () => {
    expect(
      validateBackupIdentity(
        { [BACKUP_ROLE_URL_ENV]: backupUrl, SUPABASE_DB_URL: backupUrl },
        'staging',
      ),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('must not reuse the deploy connection'),
    });
    expect(
      validateBackupIdentity(
        {
          [BACKUP_ROLE_URL_ENV]: backupUrl,
          DATABASE_URL: `postgresql://postgres:backup-secret@db.${STAGING_REF}.supabase.co/postgres`,
        },
        'staging',
      ),
    ).toMatchObject({ ok: false, message: expect.stringContaining('must not share credentials') });
    expect(
      validateBackupIdentity(
        { [BACKUP_ROLE_URL_ENV]: backupUrl, SUPABASE_DB_PASSWORD: 'backup-secret' },
        'staging',
      ),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('must not reuse SUPABASE_DB_PASSWORD'),
    });
  });

  it('accepts a dedicated backup role on the expected project', () => {
    expect(validateBackupIdentity({ [BACKUP_ROLE_URL_ENV]: backupUrl }, 'staging')).toEqual({
      ok: true,
      projectRef: STAGING_REF,
      role: 'nabatable_backup',
    });
  });

  it('validates the bucket name that reaches the delegate command line', () => {
    expect(validateBackupBucket({})).toMatchObject({ ok: false });
    expect(validateBackupBucket({ [BACKUP_BUCKET_ENV]: 'Bad Bucket' })).toMatchObject({
      ok: false,
    });
    expect(validateBackupBucket({ [BACKUP_BUCKET_ENV]: '--flag' })).toMatchObject({ ok: false });
    expect(validateBackupBucket({ [BACKUP_BUCKET_ENV]: 'nabatable-backups' })).toEqual({
      ok: true,
      value: 'nabatable-backups',
    });
  });

  it('scrubs service-role and deploy credentials from the delegate environment', () => {
    const env: NodeJS.ProcessEnv = {
      [BACKUP_ROLE_URL_ENV]: backupUrl,
      PATH: '/usr/bin',
      ...Object.fromEntries(SCRUBBED_DELEGATE_ENV_KEYS.map((key) => [key, 'secret'])),
    };
    const scrubbed = scrubDelegateEnv(env);

    expect(scrubbed[BACKUP_ROLE_URL_ENV]).toBe(backupUrl);
    expect(scrubbed.PATH).toBe('/usr/bin');
    for (const key of SCRUBBED_DELEGATE_ENV_KEYS) {
      expect(scrubbed).not.toHaveProperty(key);
    }
    expect(SCRUBBED_DELEGATE_ENV_KEYS).toEqual(
      expect.arrayContaining(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL', 'DATABASE_URL']),
    );
  });
});

describe('restore verification guard', () => {
  it.each([
    ['production', PRODUCTION_REF],
    ['staging', STAGING_REF],
  ])('refuses the %s project ref outright', (name, ref) => {
    const result = validateRestoreVerifyTarget({ [RESTORE_VERIFY_PROJECT_REF_ENV]: ref });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain(`names the ${name} project (${ref})`);
  });

  it('refuses malformed or missing refs', () => {
    expect(validateRestoreVerifyTarget({})).toMatchObject({ ok: false });
    expect(
      validateRestoreVerifyTarget({ [RESTORE_VERIFY_PROJECT_REF_ENV]: 'short' }),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('20-character'),
    });
  });

  it('refuses a scratch DB URL that does not address the scratch project', () => {
    const result = validateRestoreVerifyTarget({
      [RESTORE_VERIFY_PROJECT_REF_ENV]: SCRATCH_REF,
      [RESTORE_VERIFY_DB_URL_ENV]: `postgresql://postgres:pw@db.${PRODUCTION_REF}.supabase.co/postgres`,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain(`does not address ${SCRATCH_REF}`);
  });

  it('accepts a scratch project and uses the delegate env name for its DB URL', () => {
    expect(RESTORE_VERIFY_DB_URL_ENV).toBe('RESTORE_VERIFY_DB_URL');
    expect(
      validateRestoreVerifyTarget({
        [RESTORE_VERIFY_PROJECT_REF_ENV]: SCRATCH_REF.toUpperCase(),
        [RESTORE_VERIFY_DB_URL_ENV]: `postgresql://postgres:pw@db.${SCRATCH_REF}.supabase.co/postgres`,
      }),
    ).toEqual({ ok: true, projectRef: SCRATCH_REF, role: 'postgres' });
  });

  it('validates the backup identifier that reaches the delegate command line', () => {
    expect(validateRestoreBackupId({})).toMatchObject({ ok: false });
    expect(validateRestoreBackupId({ [RESTORE_VERIFY_BACKUP_ID_ENV]: '--evil' })).toMatchObject({
      ok: false,
    });
    expect(
      validateRestoreBackupId({ [RESTORE_VERIFY_BACKUP_ID_ENV]: 'REPLACE_ME_BACKUP' }),
    ).toMatchObject({ ok: false, message: expect.stringContaining('unconfigured placeholder') });
    expect(
      validateRestoreBackupId({ [RESTORE_VERIFY_BACKUP_ID_ENV]: 'prod-20260904T0100Z' }),
    ).toEqual({
      ok: true,
      value: 'prod-20260904T0100Z',
    });
  });
});

describe('isolated Supabase workdir', () => {
  it('copies migrations and link state into a fresh private directory and cleans up', () => {
    const source = makeTempDir('nabatable-source-');
    createLinkedWorkdir(source, STAGING_REF, { '20260101000000_a.sql': 'select 1;\n' });

    const isolated = createIsolatedSupabaseWorkdir(source, makeTempDir('nabatable-iso-root-'));

    expect(isolated.copied).toEqual(['migrations', '.temp']);
    expect(readLinkedProjectRef(isolated.path)).toBe(STAGING_REF);
    expect(
      readFileSync(path.join(isolated.path, 'supabase/migrations/20260101000000_a.sql'), 'utf8'),
    ).toBe('select 1;\n');

    writeFileSync(path.join(source, 'supabase/migrations/20260101000000_a.sql'), 'select 2;\n');
    expect(
      readFileSync(path.join(isolated.path, 'supabase/migrations/20260101000000_a.sql'), 'utf8'),
    ).toBe('select 1;\n');

    isolated.cleanup();
    expect(() => readFileSync(path.join(isolated.path, 'supabase/.temp/project-ref'))).toThrow();
  });

  it('refuses a source without migrations', () => {
    expect(() => createIsolatedSupabaseWorkdir(makeTempDir('nabatable-empty-'))).toThrow(
      /No supabase\/migrations directory/,
    );
  });
});

describe('extended schema drift inventory', () => {
  const inventory = {
    tables: [
      { name: 'bookings', kind: 'r', rlsEnabled: true, rlsForced: false, owner: 'postgres' },
    ],
    functions: [{ signature: 'f()', returns: 'void', securityDefiner: true, language: 'plpgsql' }],
    policies: [
      { table: 'bookings', name: 'tenant_read', command: 'SELECT', roles: ['authenticated'] },
    ],
    grants: [{ table: 'bookings', grantee: 'authenticated', privilege: 'SELECT', grantable: 'NO' }],
    constraints: [
      { table: 'bookings', name: 'bookings_pkey', type: 'p', definition: 'PRIMARY KEY (id)' },
    ],
    roleSettings: [{ role: 'anon', config: [], bypassRls: false, superuser: false }],
    defaultPrivileges: [],
  };

  it('inspects functions, grants, RLS policies, constraints and role configuration', () => {
    for (const catalog of [
      'pg_proc',
      'role_table_grants',
      'pg_policies',
      'pg_constraint',
      'relrowsecurity',
      'pg_roles',
      'pg_default_acl',
    ]) {
      expect(INVENTORY_SQL).toContain(catalog);
    }
  });

  it('compares canonicalised entries set-wise and reports additions and removals', () => {
    const baseline = normalizeInventory(inventory);
    const drifted = normalizeInventory({
      ...inventory,
      policies: [],
      grants: [
        ...inventory.grants,
        { privilege: 'DELETE', grantable: 'NO', table: 'bookings', grantee: 'anon' },
      ],
    });

    const comparison = compareInventory(baseline, drifted);

    expect(comparison.ok).toBe(false);
    expect(comparison.differences.map((difference) => difference.section)).toEqual([
      'policies',
      'grants',
    ]);
    expect(compareInventory(baseline, normalizeInventory(inventory)).ok).toBe(true);
  });

  it('fails closed without a baseline, records from staging only, and detects drift afterwards', async () => {
    const directory = makeTempDir('nabatable-inventory-');
    const baselinePath = path.join(directory, 'schema-inventory.json');
    const query = async () => [{ inventory }];
    const baseEnv = { DB_DRIFT_INVENTORY_BASELINE: baselinePath };

    expect(await runExtendedInspection(baseEnv, query)).toBe(1);
    expect(
      await runExtendedInspection(
        { ...baseEnv, DB_DRIFT_RECORD_INVENTORY: 'true', DB_TARGET_ENV: 'production' },
        query,
      ),
    ).toBe(1);
    expect(
      await runExtendedInspection(
        { ...baseEnv, DB_DRIFT_RECORD_INVENTORY: 'true', DB_TARGET_ENV: 'staging' },
        query,
      ),
    ).toBe(0);
    expect(parseInventoryBaseline(readFileSync(baselinePath, 'utf8')).inventory).toEqual(
      normalizeInventory(inventory),
    );
    expect(await runExtendedInspection({ ...baseEnv, DB_TARGET_ENV: 'production' }, query)).toBe(0);

    const driftedQuery = async () => [{ inventory: { ...inventory, functions: [] } }];
    expect(
      await runExtendedInspection({ ...baseEnv, DB_TARGET_ENV: 'production' }, driftedQuery),
    ).toBe(1);
    expect(await runExtendedInspection(baseEnv, async () => [])).toBe(1);
  });

  it('renders and re-parses a baseline', () => {
    const normalized = normalizeInventory(inventory);
    const parsed = parseInventoryBaseline(
      renderInventoryBaseline(normalized, '2026-09-04T00:00:00Z'),
    );

    expect(parsed.inventory).toEqual(normalized);
    expect(() => parseInventoryBaseline('{"schemaVersion":1,"target":"production"}')).toThrow(
      /target staging/,
    );
  });
});
