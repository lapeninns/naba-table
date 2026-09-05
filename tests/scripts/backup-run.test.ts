import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BACKUP_KEY, createMemoryS3, PROD_REF } from './recovery-fixtures';
import { decryptBuffer, keyIdFor } from '../../scripts/db/backup/encrypt';
import { loadRecoveryPolicy } from '../../scripts/db/backup/policy';
import { loadRestoreManifest } from '../../scripts/db/backup/restore-manifest';
import {
  BackupRunError,
  main,
  migrationLedgerHeadFromCsv,
  parseBackupCliArgs,
  runBackup,
} from '../../scripts/db/backup/run';

import type { Logger } from '../../scripts/db/backup/log';
import type { CommandRunner } from '../../scripts/db/backup/pg-dump';

const IDENTITY_URL = `postgresql://nabatable_backup:pw-backup@db.${PROD_REF}.supabase.co:5432/postgres`;
const DUMP_BYTES = Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(2048, 1)]);

function csvFor(query: string): string {
  if (query.includes('schema_migrations'))
    return 'version,name\n20260101000000,init\n20260809120000,gbp\n';
  if (query.includes('pg_extension')) return 'extname,extversion\npgcrypto,1.3\npg_cron,1.6\n';
  if (query.includes('role_table_grants'))
    return 'grantee,table_schema,table_name,privilege_type\nauthenticated,public,bookings,SELECT\n';
  if (query.includes('information_schema.tables'))
    return 'table_name,row_count\nbookings,3\nrestaurants,1\n';
  throw new Error(`unexpected query ${query}`);
}

function createFakeRunner(
  options: { cronFails?: boolean; pgDumpMajor?: number } = {},
): CommandRunner & { readonly argv: string[][] } {
  const argv: string[][] = [];
  const major = options.pgDumpMajor ?? 17;
  return {
    argv,
    async run(command, args, env) {
      argv.push([command, ...args]);
      if (args[0] === '--version')
        return { status: 0, stdout: `${command} (PostgreSQL) ${major}.4`, stderr: '' };
      if (command === 'psql') {
        expect(env?.PGPASSWORD).toBe('pw-backup');
        const query = args[args.length - 1] ?? '';
        if (query.includes('cron.job')) {
          if (options.cronFails)
            return { status: 1, stdout: '', stderr: 'relation cron.job does not exist' };
          return {
            status: 0,
            stdout: 'jobid,schedule,command\n1,* * * * *,select 1\n',
            stderr: '',
          };
        }
        return { status: 0, stdout: csvFor(query), stderr: '' };
      }
      return { status: 1, stdout: '', stderr: 'unexpected' };
    },
    async runWithInput() {
      return { status: 1, stdout: '', stderr: 'not used' };
    },
    stream(command, args, env) {
      argv.push([command, ...args]);
      expect(command).toBe('pg_dump');
      expect(env?.PGPASSWORD).toBe('pw-backup');
      return {
        stdout: Readable.from([DUMP_BYTES.subarray(0, 100), DUMP_BYTES.subarray(100)]),
        exit: Promise.resolve({ status: 0, stderr: '' }),
      };
    },
  };
}

const silentLogger: Logger & { readonly lines: string[] } = {
  lines: [],
  info(message, meta) {
    this.lines.push(JSON.stringify({ message, meta }));
  },
  warn(message, meta) {
    this.lines.push(JSON.stringify({ message, meta }));
  },
  error(message, meta) {
    this.lines.push(JSON.stringify({ message, meta }));
  },
};

describe('runBackup', () => {
  let workDir: string;
  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nabatable-backup-test-'));
    silentLogger.lines.length = 0;
  });
  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  function input(
    overrides: Partial<Parameters<typeof runBackup>[0]> = {},
  ): Parameters<typeof runBackup>[0] {
    return {
      target: 'production',
      identityEnv: 'DB_BACKUP_ROLE_URL',
      bucket: 'nabatable-backups-test',
      env: { DB_BACKUP_ROLE_URL: IDENTITY_URL, BACKUP_ENCRYPTION_KEY: BACKUP_KEY.toString('hex') },
      policy: loadRecoveryPolicy(),
      restoreManifest: loadRestoreManifest(),
      workDir,
      includeStorage: false,
      createdAt: new Date('2026-09-04T12:00:00.000Z'),
      ...overrides,
    };
  }

  function deps(runner = createFakeRunner()) {
    const s3 = createMemoryS3();
    let counter = 0;
    return {
      s3,
      runner,
      deps: {
        runner,
        s3,
        storageSource: null,
        logger: silentLogger,
        randomHex8: () => '0badcafe',
        ivFactory: () => {
          counter += 1;
          return Buffer.alloc(12, counter);
        },
      },
    };
  }

  it('produces an encrypted, uploaded backup with a validated manifest and leaves no plaintext behind', async () => {
    const { s3, deps: d, runner } = deps();
    const manifest = await runBackup(input(), d);

    expect(manifest.backupId).toBe('bk-20260904T120000Z-0badcafe');
    expect(manifest.sourceRef).toBe(PROD_REF);
    expect(manifest.migrationLedgerHead).toBe('20260809120000');
    expect(manifest.schemaVersions).toEqual({
      'extension:pgcrypto': '1.3',
      'extension:pg_cron': '1.6',
      supabase_migrations: '20260809120000',
    });
    expect(manifest.pitrState).toBe('disabled_optional');
    expect(manifest.effectiveRecoveryWindowDays).toBe(9);
    expect(manifest.encryption.keyId).toBe(keyIdFor(BACKUP_KEY).toString('hex'));
    expect(manifest.pgDumpVersion).toBe('pg_dump (PostgreSQL) 17.4');
    expect(manifest.identity).toEqual({
      user: 'nabatable_backup',
      host: `db.${PROD_REF}.supabase.co`,
    });
    expect(manifest.artifacts.map((artifact) => artifact.id)).toEqual([
      'export_grants',
      'export_extensions',
      'export_cron_jobs',
      'export_migration_ledger',
      'export_row_counts',
      'dump_core',
      'dump_auth_data',
    ]);

    // Every uploaded object decrypts and is not plaintext; dumps start with PGDMP.
    for (const artifact of manifest.artifacts) {
      const stored = s3.objects.get(artifact.objectKey);
      expect(stored?.length).toBe(artifact.sizeBytes);
      expect(stored?.includes(Buffer.from('PGDMP'))).toBe(false);
      const plaintext = decryptBuffer(BACKUP_KEY, stored ?? Buffer.alloc(0));
      if (artifact.id.startsWith('dump_')) expect(plaintext).toEqual(DUMP_BYTES);
    }
    expect(s3.objects.has(`backups/${manifest.backupId}/manifest.json`)).toBe(true);

    // Only the manifest remains locally; encrypted dump files are removed and plaintext never existed.
    const remaining = fs.readdirSync(workDir);
    expect(remaining).toEqual([`${manifest.backupId}-manifest.json`]);

    // Connection details never reach argv.
    for (const args of runner.argv) {
      expect(args.join(' ')).not.toContain('pw-backup');
      expect(args.join(' ')).not.toContain('postgresql://');
    }
    expect(JSON.stringify(silentLogger.lines)).not.toContain('pw-backup');
  });

  it('skips an optional export that fails but requires the mandatory ones', async () => {
    const { deps: d } = deps(createFakeRunner({ cronFails: true }));
    const manifest = await runBackup(input(), d);
    expect(manifest.artifacts.some((artifact) => artifact.id === 'export_cron_jobs')).toBe(false);
    expect(silentLogger.lines.some((line) => line.includes('Optional export skipped'))).toBe(true);
  });

  it('refuses a non-17 pg_dump before touching the database', async () => {
    const { deps: d, runner } = deps(createFakeRunner({ pgDumpMajor: 16 }));
    await expect(runBackup(input(), d)).rejects.toThrow(/exactly 17 is required/);
    expect(runner.argv.some((args) => args[0] === 'psql' && args[1] !== '--version')).toBe(false);
  });

  it('refuses a privileged identity, a placeholder bucket and the CI evidence bucket', async () => {
    const { deps: d } = deps();
    await expect(
      runBackup(
        input({
          env: {
            DB_BACKUP_ROLE_URL: `postgresql://postgres:pw@db.${PROD_REF}.supabase.co/postgres`,
            BACKUP_ENCRYPTION_KEY: BACKUP_KEY.toString('hex'),
          },
        }),
        d,
      ),
    ).rejects.toThrow(/privileged or deployment identity/);
    await expect(
      runBackup(input({ bucket: 'REPLACE_ME_ENCRYPTED_BACKUP_BUCKET' }), d),
    ).rejects.toThrow(BackupRunError);
    await expect(runBackup(input({ bucket: 'REPLACE_ME_CI_EVIDENCE_BUCKET' }), d)).rejects.toThrow(
      /unconfigured or invalid/,
    );
  });

  it('refuses when the identity targets the wrong project for the target', async () => {
    const { deps: d } = deps();
    await expect(runBackup(input({ target: 'staging' }), d)).rejects.toThrow(
      /expected Supabase project ref/,
    );
  });

  it('extracts the ledger head and refuses an empty ledger', () => {
    expect(migrationLedgerHeadFromCsv('version,name\n20260101000000,a\n20260809120000,b\n')).toBe(
      '20260809120000',
    );
    expect(() => migrationLedgerHeadFromCsv('version,name\n')).toThrow(/empty/);
  });
});

describe('backup CLI', () => {
  it('parses the delegated argument shape and defaults the bucket to the policy', () => {
    expect(
      parseBackupCliArgs([
        '--target',
        'production',
        '--identity-env',
        'DB_BACKUP_ROLE_URL',
        '--bucket',
        'b',
      ]),
    ).toMatchObject({
      kind: 'run',
      target: 'production',
      identityEnv: 'DB_BACKUP_ROLE_URL',
      bucket: 'b',
      includeStorage: true,
      dryRun: false,
    });
    expect(parseBackupCliArgs(['--target', 'production'])).toMatchObject({
      kind: 'run',
      bucket: null,
      identityEnv: 'DB_BACKUP_ROLE_URL',
    });
    expect(parseBackupCliArgs(['--target', 'prod'])).toMatchObject({ kind: 'refusal' });
    expect(parseBackupCliArgs(['--target', 'staging', '--identity-env', 'lower'])).toMatchObject({
      kind: 'refusal',
    });
    expect(parseBackupCliArgs(['--target', 'staging', '--nope', 'x'])).toMatchObject({
      kind: 'refusal',
    });
  });

  it('refuses to run with the placeholder policy bucket and reports it as unconfigured', async () => {
    const out: string[] = [];
    const code = await main(
      ['--target', 'production'],
      {},
      { stdout: (line) => out.push(line), logger: silentLogger, now: () => new Date() },
    );
    expect(code).toBe(2);
    expect(silentLogger.lines.join('\n')).toMatch(/unconfigured/);
  });

  it('dry-run prints the plan without any credentials', async () => {
    const out: string[] = [];
    const code = await main(
      ['--target', 'production', '--dry-run', '--skip-storage'],
      {},
      { stdout: (line) => out.push(line), logger: silentLogger, now: () => new Date() },
    );
    expect(code).toBe(0);
    const plan = JSON.parse(out.join('')) as {
      bucketConfigured: boolean;
      parts: { id: string }[];
      storageBuckets: string[];
    };
    expect(plan.bucketConfigured).toBe(false);
    expect(plan.parts.map((part) => part.id)).toEqual(['core', 'auth_data']);
    expect(plan.storageBuckets).toEqual([]);
  });
});
