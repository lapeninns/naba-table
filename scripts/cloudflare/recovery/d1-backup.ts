import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  BACKUP_ENCRYPTION_KEY_ENV,
  encryptBuffer,
  parseBackupEncryptionKey,
} from '../../db/backup/encrypt';
import { createLogger, type Logger } from '../../db/backup/log';
import {
  createPnpmWranglerRunner,
  envFlags,
  loadWranglerConfig,
  parseD1JsonResults,
  parseWorkerEnvName,
  RecoveryToolError,
  requireExit,
  resolveWorkerBindings,
  workerDir,
  type WorkerEnvName,
  type WranglerRunner,
} from './shared';

/**
 * D1 logical backup for the booking short links worker (`wrangler d1 export`), one
 * environment at a time, with an integrity check against live row counts and the
 * migrations table. The export is encrypted with the same AES-256-GCM format as the
 * Postgres backups before it is kept; the plaintext export only ever exists in a
 * private temp directory that is removed in `finally`.
 */

export const D1_WORKER = 'booking-short-links';
export const D1_BINDING = 'BOOKING_SHORT_LINKS_DB';
export const D1_TABLES = ['booking_short_links', 'booking_short_link_access_events'] as const;
export const D1_MIGRATIONS_TABLE = 'd1_migrations';

export type D1TableCounts = Readonly<Record<string, number>>;

/** Count `INSERT INTO <table>` statements per table in a wrangler d1 export. */
export function countInsertsByTable(sql: string): D1TableCounts {
  const counts: Record<string, number> = {};
  const pattern = /^\s*INSERT\s+INTO\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gim;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    const table = match[1] ?? '';
    counts[table] = (counts[table] ?? 0) + 1;
  }
  return counts;
}

export function liveCountsQuery(): string {
  const tables = [...D1_TABLES, D1_MIGRATIONS_TABLE];
  return tables
    .map((table) => `select '${table}' as table_name, count(*) as n from ${table}`)
    .join(' union all ');
}

export function parseCountRows(rows: readonly Record<string, unknown>[]): D1TableCounts {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const table = typeof row.table_name === 'string' ? row.table_name : '';
    const n = typeof row.n === 'number' ? row.n : Number.parseInt(String(row.n ?? ''), 10);
    if (table && Number.isInteger(n) && n >= 0) counts[table] = n;
  }
  return counts;
}

export type D1IntegrityInput = {
  readonly exported: D1TableCounts;
  readonly live: D1TableCounts;
  readonly migrationFiles: readonly string[];
  readonly appliedMigrations: readonly string[];
};

export type D1IntegrityResult = {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly tables: Readonly<Record<string, { readonly exported: number; readonly live: number }>>;
};

/**
 * Links and the migrations table must match exactly. Access events are append-only in
 * normal operation, so the live count may only be greater than or equal to the export
 * taken moments earlier; anything else is an integrity failure.
 */
export function compareD1Integrity(input: D1IntegrityInput): D1IntegrityResult {
  const problems: string[] = [];
  const tables: Record<string, { exported: number; live: number }> = {};
  for (const table of [...D1_TABLES, D1_MIGRATIONS_TABLE]) {
    const exported = input.exported[table] ?? 0;
    const live = input.live[table];
    if (live === undefined) {
      problems.push(`${table}: live count unavailable`);
      tables[table] = { exported, live: -1 };
      continue;
    }
    tables[table] = { exported, live };
    if (table === 'booking_short_link_access_events') {
      if (live < exported) problems.push(`${table}: live ${live} < exported ${exported}`);
    } else if (live !== exported) {
      problems.push(`${table}: live ${live} != exported ${exported}`);
    }
  }
  if ((input.exported[D1_MIGRATIONS_TABLE] ?? 0) === 0) {
    problems.push(`${D1_MIGRATIONS_TABLE}: export contains no migration rows`);
  }
  const applied = new Set(input.appliedMigrations);
  for (const file of input.migrationFiles) {
    if (!applied.has(file)) problems.push(`migration ${file} is not recorded as applied`);
  }
  return { ok: problems.length === 0, problems, tables };
}

export type D1BackupManifest = {
  readonly manifestVersion: 1;
  readonly worker: string;
  readonly environment: WorkerEnvName;
  readonly databaseName: string;
  readonly databaseId: string;
  readonly exportedAt: string;
  readonly encryptedFile: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly integrity: D1IntegrityResult;
  readonly appliedMigrations: readonly string[];
  readonly encryption: { readonly algorithm: 'aes-256-gcm' };
};

export type D1BackupInput = {
  readonly envName: WorkerEnvName;
  readonly repoRoot: string;
  readonly outDir: string;
  readonly exportedAt: Date;
  readonly key: Buffer;
};

export type D1BackupDeps = {
  readonly wrangler: WranglerRunner;
  readonly logger: Logger;
  readonly tempDir: () => string;
};

export function d1BackupStamp(exportedAt: Date): string {
  return exportedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export async function runD1Backup(
  input: D1BackupInput,
  deps: D1BackupDeps,
): Promise<D1BackupManifest> {
  const dir = workerDir(input.repoRoot, D1_WORKER);
  const resolution = resolveWorkerBindings(loadWranglerConfig(dir), input.envName);
  if (resolution.kind === 'unconfigured') {
    throw new RecoveryToolError(
      `${D1_WORKER} ${input.envName} bindings are unconfigured (${resolution.placeholders.join(', ')}).`,
    );
  }
  const binding = resolution.bindings.d1.find((entry) => entry.binding === D1_BINDING);
  if (!binding)
    throw new RecoveryToolError(`${D1_WORKER} has no ${D1_BINDING} binding for ${input.envName}.`);
  const flags = envFlags(input.envName);
  const migrationFiles = fs
    .readdirSync(path.join(dir, binding.migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const liveRows = parseD1JsonResults(
    requireExit(
      await deps.wrangler.run(dir, [
        'd1',
        'execute',
        binding.databaseName,
        '--remote',
        '--json',
        ...flags,
        '--command',
        liveCountsQuery(),
      ]),
      'd1 live counts',
    ).stdout,
  );
  const live = parseCountRows(liveRows);
  const appliedMigrations = parseD1JsonResults(
    requireExit(
      await deps.wrangler.run(dir, [
        'd1',
        'execute',
        binding.databaseName,
        '--remote',
        '--json',
        ...flags,
        '--command',
        `select name from ${D1_MIGRATIONS_TABLE} order by id`,
      ]),
      'd1 applied migrations',
    ).stdout,
  )
    .map((row) => (typeof row.name === 'string' ? row.name : ''))
    .filter((name) => name.length > 0);

  const temp = deps.tempDir();
  const plaintextPath = path.join(temp, 'export.sql');
  try {
    requireExit(
      await deps.wrangler.run(dir, [
        'd1',
        'export',
        binding.databaseName,
        '--remote',
        ...flags,
        '--output',
        plaintextPath,
      ]),
      'd1 export',
    );
    const sql = fs.readFileSync(plaintextPath);
    const integrity = compareD1Integrity({
      exported: countInsertsByTable(sql.toString('utf8')),
      live,
      migrationFiles,
      appliedMigrations,
    });
    const encrypted = encryptBuffer(input.key, sql);
    const stamp = d1BackupStamp(input.exportedAt);
    fs.mkdirSync(input.outDir, { recursive: true });
    const encryptedFile = path.join(
      input.outDir,
      `d1-${D1_WORKER}-${input.envName}-${stamp}.sql.enc`,
    );
    fs.writeFileSync(encryptedFile, encrypted, { mode: 0o600 });
    const manifest: D1BackupManifest = {
      manifestVersion: 1,
      worker: D1_WORKER,
      environment: input.envName,
      databaseName: binding.databaseName,
      databaseId: binding.databaseId,
      exportedAt: input.exportedAt.toISOString(),
      encryptedFile: path.basename(encryptedFile),
      sizeBytes: encrypted.length,
      sha256: createHash('sha256').update(encrypted).digest('hex'),
      integrity,
      appliedMigrations,
      encryption: { algorithm: 'aes-256-gcm' },
    };
    fs.writeFileSync(
      path.join(input.outDir, `d1-${D1_WORKER}-${input.envName}-${stamp}.manifest.json`),
      JSON.stringify(manifest, null, 2),
    );
    deps.logger.info('D1 export encrypted', {
      environment: input.envName,
      sizeBytes: encrypted.length,
      integrity: integrity.ok,
    });
    if (!integrity.ok) {
      throw new RecoveryToolError(`D1 integrity check failed: ${integrity.problems.join('; ')}.`);
    }
    return manifest;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

export type D1BackupCliRequest =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'run';
      readonly envName: WorkerEnvName;
      readonly outDir: string;
      readonly repoRoot: string;
      readonly dryRun: boolean;
    }
  | { readonly kind: 'refusal'; readonly message: string };

const HELP = `Nabatable D1 backup (booking short links)

Usage: tsx scripts/cloudflare/recovery/d1-backup.ts --env staging|production [--out <dir>] [--dry-run]
Env: ${BACKUP_ENCRYPTION_KEY_ENV} (32 bytes hex/base64), CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID for wrangler.
`;

export function parseD1BackupArgs(args: readonly string[], cwd: string): D1BackupCliRequest {
  if (args.includes('--help')) return { kind: 'help' };
  const values = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    const value = args[index + 1];
    if (
      !['--env', '--out', '--repo-root'].includes(arg) ||
      value === undefined ||
      value.startsWith('--')
    ) {
      return { kind: 'refusal', message: `Invalid argument ${arg}.` };
    }
    values.set(arg, value);
    index += 1;
  }
  let envName: WorkerEnvName;
  try {
    envName = parseWorkerEnvName(values.get('--env'));
  } catch (error) {
    return { kind: 'refusal', message: error instanceof Error ? error.message : 'Invalid --env.' };
  }
  return {
    kind: 'run',
    envName,
    outDir: values.get('--out') ?? path.join(cwd, '.recovery', 'd1'),
    repoRoot: values.get('--repo-root') ?? cwd,
    dryRun,
  };
}

export async function main(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  io: {
    readonly stdout: (line: string) => void;
    readonly logger: Logger;
    readonly now: () => Date;
    readonly cwd: string;
  },
): Promise<number> {
  const request = parseD1BackupArgs(args, io.cwd);
  if (request.kind === 'help') {
    io.stdout(HELP);
    return 0;
  }
  if (request.kind === 'refusal') {
    io.logger.error(request.message);
    return 2;
  }
  let resolution;
  try {
    resolution = resolveWorkerBindings(
      loadWranglerConfig(workerDir(request.repoRoot, D1_WORKER)),
      request.envName,
    );
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Failed to read wrangler config.');
    return 2;
  }
  if (resolution.kind === 'unconfigured') {
    io.logger.error(`D1 bindings for ${request.envName} are unconfigured.`, {
      placeholders: resolution.placeholders,
    });
    return 2;
  }
  if (request.dryRun) {
    io.stdout(
      JSON.stringify(
        {
          dryRun: true,
          worker: D1_WORKER,
          environment: request.envName,
          databases: resolution.bindings.d1.map((entry) => entry.databaseName),
          outDir: request.outDir,
          encryptionKeyPresent: Boolean(env[BACKUP_ENCRYPTION_KEY_ENV]?.trim()),
        },
        null,
        2,
      ),
    );
    return 0;
  }
  let key: Buffer;
  try {
    key = parseBackupEncryptionKey(env[BACKUP_ENCRYPTION_KEY_ENV]);
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Encryption key missing.');
    return 2;
  }
  try {
    const manifest = await runD1Backup(
      {
        envName: request.envName,
        repoRoot: request.repoRoot,
        outDir: request.outDir,
        exportedAt: io.now(),
        key,
      },
      {
        wrangler: createPnpmWranglerRunner(env),
        logger: io.logger,
        tempDir: () => {
          const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nabatable-d1-'));
          fs.chmodSync(dir, 0o700);
          return dir;
        },
      },
    );
    io.stdout(
      JSON.stringify({
        encryptedFile: manifest.encryptedFile,
        sha256: manifest.sha256,
        integrity: manifest.integrity.ok,
      }),
    );
    return 0;
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'D1 backup failed.');
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), process.env, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    logger: createLogger(),
    now: () => new Date(),
    cwd: process.cwd(),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'D1 backup failed.'}\n`);
      process.exitCode = 1;
    },
  );
}
