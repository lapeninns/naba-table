import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BACKUP_KEY } from './recovery-fixtures';
import {
  compareD1Integrity,
  countInsertsByTable,
  main,
  parseCountRows,
  parseD1BackupArgs,
  runD1Backup,
} from '../../scripts/cloudflare/recovery/d1-backup';
import { RecoveryToolError, type WranglerRunner } from '../../scripts/cloudflare/recovery/shared';
import { decryptBuffer } from '../../scripts/db/backup/encrypt';

import type { Logger } from '../../scripts/db/backup/log';

const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const REPO_ROOT = process.cwd();

const EXPORT_SQL = [
  'PRAGMA defer_foreign_keys=TRUE;',
  'CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT);',
  "INSERT INTO d1_migrations VALUES(1,'0001_review_access_events.sql','2026-01-01');",
  'CREATE TABLE booking_short_links(token TEXT PRIMARY KEY);',
  'INSERT INTO "booking_short_links" VALUES(\'t1\');',
  "INSERT INTO booking_short_links VALUES('t2');",
  "insert into booking_short_link_access_events VALUES('e1','t1','2026-09-01');",
  '',
].join('\n');

function fakeWrangler(
  options: { live?: Record<string, number>; exportSql?: string } = {},
): WranglerRunner & { readonly calls: string[][] } {
  const calls: string[][] = [];
  const live = options.live ?? {
    booking_short_links: 2,
    booking_short_link_access_events: 1,
    d1_migrations: 1,
  };
  return {
    calls,
    async run(_dir, args) {
      calls.push([...args]);
      if (args[0] === 'd1' && args[1] === 'execute') {
        const command = args[args.length - 1] ?? '';
        if (command.includes('count(*)')) {
          const results = Object.entries(live).map(([table_name, n]) => ({ table_name, n }));
          return { status: 0, stdout: JSON.stringify([{ results, success: true }]), stderr: '' };
        }
        return {
          status: 0,
          stdout: JSON.stringify([
            { results: [{ name: '0001_review_access_events.sql' }], success: true },
          ]),
          stderr: '',
        };
      }
      if (args[0] === 'd1' && args[1] === 'export') {
        const output = args[args.indexOf('--output') + 1] ?? '';
        fs.writeFileSync(output, options.exportSql ?? EXPORT_SQL);
        return { status: 0, stdout: 'Exported', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: 'unexpected' };
    },
  };
}

describe('D1 backup pure functions', () => {
  it('counts INSERT statements per table regardless of quoting or case', () => {
    expect(countInsertsByTable(EXPORT_SQL)).toEqual({
      d1_migrations: 1,
      booking_short_links: 2,
      booking_short_link_access_events: 1,
    });
  });

  it('parses live count rows and compares integrity', () => {
    const live = parseCountRows([
      { table_name: 'booking_short_links', n: 2 },
      { table_name: 'd1_migrations', n: '1' },
      { table_name: 'booking_short_link_access_events', n: 5 },
    ]);
    expect(live).toEqual({
      booking_short_links: 2,
      d1_migrations: 1,
      booking_short_link_access_events: 5,
    });
    const ok = compareD1Integrity({
      exported: countInsertsByTable(EXPORT_SQL),
      live,
      migrationFiles: ['0001_review_access_events.sql'],
      appliedMigrations: ['0001_review_access_events.sql'],
    });
    expect(ok.ok).toBe(true);
    const drift = compareD1Integrity({
      exported: countInsertsByTable(EXPORT_SQL),
      live: { ...live, booking_short_links: 3 },
      migrationFiles: ['0001_review_access_events.sql'],
      appliedMigrations: ['0001_review_access_events.sql'],
    });
    expect(drift.ok).toBe(false);
    expect(drift.problems[0]).toMatch(/booking_short_links: live 3 != exported 2/);
    const eventsLost = compareD1Integrity({
      exported: countInsertsByTable(EXPORT_SQL),
      live: { ...live, booking_short_link_access_events: 0 },
      migrationFiles: [],
      appliedMigrations: [],
    });
    expect(eventsLost.problems).toEqual(['booking_short_link_access_events: live 0 < exported 1']);
    const missingMigration = compareD1Integrity({
      exported: countInsertsByTable(EXPORT_SQL),
      live,
      migrationFiles: ['0002_new.sql'],
      appliedMigrations: [],
    });
    expect(missingMigration.problems).toContain(
      'migration 0002_new.sql is not recorded as applied',
    );
    const noMigrations = compareD1Integrity({
      exported: { booking_short_links: 2 },
      live: { booking_short_links: 2, booking_short_link_access_events: 0, d1_migrations: 0 },
      migrationFiles: [],
      appliedMigrations: [],
    });
    expect(noMigrations.problems).toContain('d1_migrations: export contains no migration rows');
  });

  it('parses CLI args and refuses unknown environments', () => {
    expect(parseD1BackupArgs(['--env', 'staging', '--dry-run'], '/repo')).toMatchObject({
      kind: 'run',
      envName: 'staging',
      dryRun: true,
      repoRoot: '/repo',
    });
    expect(parseD1BackupArgs(['--env', 'prod'], '/repo')).toMatchObject({ kind: 'refusal' });
    expect(parseD1BackupArgs(['--env'], '/repo')).toMatchObject({ kind: 'refusal' });
  });
});

describe('runD1Backup', () => {
  let outDir: string;
  let tempRoot: string;
  beforeEach(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nabatable-d1-out-'));
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nabatable-d1-tmp-'));
  });
  afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('exports, verifies integrity, encrypts and removes the plaintext export', async () => {
    const wrangler = fakeWrangler();
    const tempDirs: string[] = [];
    const manifest = await runD1Backup(
      {
        envName: 'production',
        repoRoot: REPO_ROOT,
        outDir,
        exportedAt: new Date('2026-09-04T12:00:00.000Z'),
        key: BACKUP_KEY,
      },
      {
        wrangler,
        logger,
        tempDir: () => {
          const dir = fs.mkdtempSync(path.join(tempRoot, 'work-'));
          tempDirs.push(dir);
          return dir;
        },
      },
    );
    expect(manifest.integrity.ok).toBe(true);
    expect(manifest.databaseName).toBe('nabatable-booking-short-links');
    expect(manifest.appliedMigrations).toEqual(['0001_review_access_events.sql']);
    const encrypted = fs.readFileSync(path.join(outDir, manifest.encryptedFile));
    expect(encrypted.includes(Buffer.from('INSERT INTO'))).toBe(false);
    expect(decryptBuffer(BACKUP_KEY, encrypted).toString('utf8')).toBe(EXPORT_SQL);
    expect(fs.existsSync(tempDirs[0] ?? '')).toBe(false);
    expect(fs.readdirSync(outDir).some((name) => name.endsWith('.manifest.json'))).toBe(true);
    // Production uses the top-level config: no --env flag; export goes to the temp dir only.
    const exportCall = wrangler.calls.find((args) => args[1] === 'export');
    expect(exportCall).not.toContain('--env');
    expect(exportCall?.[exportCall.indexOf('--output') + 1]?.startsWith(tempRoot)).toBe(true);
  });

  it('fails the backup (after cleaning up) when live counts disagree with the export', async () => {
    const wrangler = fakeWrangler({
      live: { booking_short_links: 7, booking_short_link_access_events: 1, d1_migrations: 1 },
    });
    let temp = '';
    await expect(
      runD1Backup(
        {
          envName: 'production',
          repoRoot: REPO_ROOT,
          outDir,
          exportedAt: new Date(),
          key: BACKUP_KEY,
        },
        {
          wrangler,
          logger,
          tempDir: () => {
            temp = fs.mkdtempSync(path.join(tempRoot, 'work-'));
            return temp;
          },
        },
      ),
    ).rejects.toThrow(/integrity check failed/);
    expect(fs.existsSync(temp)).toBe(false);
  });

  it('refuses the staging environment while its D1 id is a REPLACE_ME_ placeholder', async () => {
    await expect(
      runD1Backup(
        {
          envName: 'staging',
          repoRoot: REPO_ROOT,
          outDir,
          exportedAt: new Date(),
          key: BACKUP_KEY,
        },
        { wrangler: fakeWrangler(), logger, tempDir: () => tempRoot },
      ),
    ).rejects.toThrow(RecoveryToolError);
    await expect(
      runD1Backup(
        {
          envName: 'staging',
          repoRoot: REPO_ROOT,
          outDir,
          exportedAt: new Date(),
          key: BACKUP_KEY,
        },
        { wrangler: fakeWrangler(), logger, tempDir: () => tempRoot },
      ),
    ).rejects.toThrow(/unconfigured/);
  });

  it('CLI: dry-run needs no key, real run refuses without an encryption key', async () => {
    const out: string[] = [];
    const io = {
      stdout: (line: string) => out.push(line),
      logger,
      now: () => new Date(),
      cwd: REPO_ROOT,
    };
    expect(await main(['--env', 'production', '--dry-run'], {}, io)).toBe(0);
    expect(JSON.parse(out.join(''))).toMatchObject({
      dryRun: true,
      environment: 'production',
      encryptionKeyPresent: false,
    });
    expect(await main(['--env', 'production', '--out', outDir], {}, io)).toBe(2);
    expect(
      await main(['--env', 'staging'], { BACKUP_ENCRYPTION_KEY: BACKUP_KEY.toString('hex') }, io),
    ).toBe(2);
    expect(fs.readdirSync(outDir)).toEqual([]);
  });
});
