import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { parseCsv } from './csv';
import {
  BACKUP_ENCRYPTION_KEY_ENV,
  BackupEncryptStream,
  BACKUP_IV_LENGTH,
  encryptBuffer,
  keyIdFor,
  parseBackupEncryptionKey,
} from './encrypt';
import { assertBackupIdentity, DEFAULT_IDENTITY_ENV, type BackupIdentity } from './identity';
import { createLogger, type Logger } from './log';
import {
  backupManifestKey,
  backupObjectPrefix,
  combinedArtifactSha256,
  formatBackupId,
  validateBackupManifest,
  type BackupArtifact,
  type BackupManifest,
} from './manifest';
import {
  assertPgClientMajor,
  buildPgDumpParts,
  createNodeCommandRunner,
  libpqEnvFromUrl,
  type CommandEnv,
  type CommandRunner,
} from './pg-dump';
import { isBucketConfigured, loadRecoveryPolicy, type RecoveryPolicy } from './policy';
import { computeEffectiveRecoveryWindowDays } from './recovery-window';
import { loadRestoreManifest, type RestoreManifest } from './restore-manifest';
import { createS3Client, resolveS3ConfigFromEnv, type S3Client } from './s3';
import {
  backupStorageObjects,
  createSupabaseStorageSource,
  STORAGE_BACKUP_ENV,
  storageManifestKey,
  type StorageSource,
} from './storage-objects';

/**
 * Independent logical backup runner.
 *
 * Entry point for `pnpm db:backup` (delegated by scripts/db/safe-run.ts):
 *   tsx scripts/db/backup/run.ts --target production --identity-env DB_BACKUP_ROLE_URL --bucket <name>
 */

export type BackupTarget = 'production' | 'staging';

export type BackupRunInput = {
  readonly target: BackupTarget;
  readonly identityEnv: string;
  readonly bucket: string;
  readonly env: NodeJS.ProcessEnv;
  readonly policy: RecoveryPolicy;
  readonly restoreManifest: RestoreManifest;
  readonly workDir: string;
  readonly includeStorage: boolean;
  readonly createdAt: Date;
};

export type BackupRunDeps = {
  readonly runner: CommandRunner;
  readonly s3: S3Client;
  readonly storageSource: StorageSource | null;
  readonly logger: Logger;
  readonly randomHex8: () => string;
  readonly ivFactory: () => Buffer;
};

export class BackupRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupRunError';
  }
}

class HashTap extends Transform {
  readonly hash = createHash('sha256');
  bytes = 0;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.hash.update(chunk);
    this.bytes += chunk.length;
    callback(null, chunk);
  }
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

async function runSqlExport(
  runner: CommandRunner,
  libpqEnv: CommandEnv,
  query: string,
): Promise<string> {
  const result = await runner.run(
    'psql',
    ['--csv', '--no-psqlrc', '--no-password', '-v', 'ON_ERROR_STOP=1', '-c', query],
    libpqEnv,
  );
  if (result.status !== 0) {
    throw new BackupRunError(`psql export failed with status ${String(result.status)}.`);
  }
  return result.stdout;
}

export function migrationLedgerHeadFromCsv(csv: string): string {
  const rows = parseCsv(csv);
  const versions = rows
    .map((row) => row.version ?? '')
    .filter((version) => /^\d{14}$/.test(version))
    .sort();
  const head = versions.at(-1);
  if (!head)
    throw new BackupRunError(
      'Migration ledger export is empty; refusing to back up an unknown schema.',
    );
  return head;
}

export function schemaVersionsFromExtensionsCsv(csv: string): Record<string, string> {
  const rows = parseCsv(csv);
  const versions: Record<string, string> = {};
  for (const row of rows) {
    if (row.extname && row.extversion) versions[`extension:${row.extname}`] = row.extversion;
  }
  return versions;
}

export async function runBackup(
  input: BackupRunInput,
  deps: BackupRunDeps,
): Promise<BackupManifest> {
  const { policy } = input;
  const expectedProjectRef = policy.protectedProjectRefs[input.target];

  if (!isBucketConfigured(input.bucket)) {
    throw new BackupRunError(
      `Backup bucket "${input.bucket}" is unconfigured or invalid; refusing.`,
    );
  }
  if (input.bucket === policy.ciEvidenceBucket) {
    throw new BackupRunError('Backup bucket must be separate from the CI evidence bucket.');
  }
  if (input.bucket !== policy.bucket && !isBucketConfigured(policy.bucket)) {
    deps.logger.warn('Policy bucket is a placeholder; using the CLI-provided bucket.', {
      bucket: input.bucket,
    });
  } else if (input.bucket !== policy.bucket) {
    throw new BackupRunError(`Bucket ${input.bucket} does not match config/recovery/policy.yaml.`);
  }

  const identity: BackupIdentity = assertBackupIdentity(input.env, {
    identityEnv: input.identityEnv,
    expectedProjectRef,
  });
  const key = parseBackupEncryptionKey(input.env[BACKUP_ENCRYPTION_KEY_ENV]);
  const pgDumpVersion = await assertPgClientMajor(deps.runner, 'pg_dump');
  await assertPgClientMajor(deps.runner, 'psql');
  if (input.includeStorage && !deps.storageSource) {
    throw new BackupRunError(
      'Storage object backup requested but no storage source is configured.',
    );
  }

  const backupId = formatBackupId(input.createdAt, deps.randomHex8());
  const createdAt = input.createdAt.toISOString();
  const prefix = backupObjectPrefix(backupId);
  const rawUrl = input.env[input.identityEnv] ?? '';
  const libpqEnv = libpqEnvFromUrl(rawUrl, input.env);
  fs.mkdirSync(input.workDir, { recursive: true });
  const localFiles: string[] = [];
  const artifacts: BackupArtifact[] = [];
  deps.logger.info('Backup started', {
    backupId,
    target: input.target,
    user: identity.user,
    host: identity.host,
  });

  try {
    // 1. SQL exports (ledger, grants, extensions, cron definitions, row counts).
    const exportsCsv: Record<string, string> = {};
    for (const sqlExport of input.restoreManifest.sqlExports) {
      let csv: string;
      try {
        csv = await runSqlExport(deps.runner, libpqEnv, sqlExport.query);
      } catch (error) {
        if (sqlExport.optional) {
          deps.logger.warn('Optional export skipped', { export: sqlExport.id });
          continue;
        }
        throw error;
      }
      exportsCsv[sqlExport.id] = csv;
      const encrypted = encryptBuffer(key, Buffer.from(csv, 'utf8'), deps.ivFactory());
      const objectKey = `${prefix}/exports/${sqlExport.id}.csv.enc`;
      await deps.s3.putObject(objectKey, encrypted);
      artifacts.push({
        id: `export_${sqlExport.id}`,
        objectKey,
        sizeBytes: encrypted.length,
        sha256: sha256Hex(encrypted),
      });
    }
    const ledgerCsv = exportsCsv.migration_ledger;
    if (!ledgerCsv) throw new BackupRunError('migration_ledger export is required.');
    const migrationLedgerHead = migrationLedgerHeadFromCsv(ledgerCsv);
    const schemaVersions: Record<string, string> = {
      ...schemaVersionsFromExtensionsCsv(exportsCsv.extensions ?? ''),
      supabase_migrations: migrationLedgerHead,
    };

    // 2. pg_dump parts streamed through the encryptor; plaintext never touches disk.
    for (const part of buildPgDumpParts(input.restoreManifest)) {
      const filePath = path.join(input.workDir, `${backupId}-${part.id}.dump.enc`);
      localFiles.push(filePath);
      const proc = deps.runner.stream('pg_dump', part.args, libpqEnv);
      const plaintextTap = new HashTap();
      const ciphertextTap = new HashTap();
      const encryptor = new BackupEncryptStream(key, deps.ivFactory());
      await pipeline(
        proc.stdout,
        plaintextTap,
        encryptor,
        ciphertextTap,
        fs.createWriteStream(filePath),
      );
      const exit = await proc.exit;
      if (exit.status !== 0) {
        throw new BackupRunError(`pg_dump ${part.id} failed with status ${String(exit.status)}.`);
      }
      if (plaintextTap.bytes === 0) {
        throw new BackupRunError(`pg_dump ${part.id} produced no data.`);
      }
      const objectKey = `${prefix}/${part.id}.dump.enc`;
      await deps.s3.putObject(objectKey, fs.readFileSync(filePath));
      artifacts.push({
        id: `dump_${part.id}`,
        objectKey,
        sizeBytes: ciphertextTap.bytes,
        sha256: ciphertextTap.hash.digest('hex'),
      });
      deps.logger.info('Dump part uploaded', { part: part.id, sizeBytes: ciphertextTap.bytes });
    }

    // 3. Storage objects (separate manifest, validated against provider metadata).
    let storageObjects: BackupManifest['storageObjects'] = null;
    if (input.includeStorage && deps.storageSource) {
      const storageManifest = await backupStorageObjects({
        backupId,
        createdAt,
        buckets: input.restoreManifest.storageBuckets,
        source: deps.storageSource,
        s3: deps.s3,
        key,
        ivFactory: deps.ivFactory,
      });
      storageObjects = {
        manifestKey: storageManifestKey(backupId),
        objectCount: storageManifest.objectCount,
      };
    }

    // 4. Manifest.
    const effectiveRecoveryWindowDays = computeEffectiveRecoveryWindowDays({
      nativeRetentionDays: policy.nativeRetentionDays,
      independentRetentionDays: policy.independentBackup.retentionDays,
      intervalHours: policy.independentBackup.intervalHours,
      overhangDays: policy.recoveryWindow.overhangDays,
    });
    const manifest = validateBackupManifest({
      manifestVersion: 1,
      backupId,
      createdAt,
      sourceRef: expectedProjectRef,
      target: input.target,
      identity: { user: identity.user, host: identity.host },
      sizeBytes: artifacts.reduce((total, artifact) => total + artifact.sizeBytes, 0),
      sha256: combinedArtifactSha256(artifacts, sha256Hex),
      artifacts,
      schemaVersions,
      migrationLedgerHead,
      pitrState: policy.pitr.state,
      effectiveRecoveryWindowDays,
      encryption: { algorithm: 'aes-256-gcm', keyId: keyIdFor(key).toString('hex') },
      pgDumpVersion,
      policyVersion: policy.policyVersion,
      storageObjects,
    });
    const manifestJson = Buffer.from(JSON.stringify(manifest, null, 2));
    await deps.s3.putObject(backupManifestKey(backupId), manifestJson, {
      contentType: 'application/json',
    });
    fs.writeFileSync(path.join(input.workDir, `${backupId}-manifest.json`), manifestJson);
    deps.logger.info('Backup completed', {
      backupId,
      sizeBytes: manifest.sizeBytes,
      artifacts: artifacts.length,
    });
    return manifest;
  } finally {
    for (const file of localFiles) {
      fs.rmSync(file, { force: true });
    }
  }
}

export type BackupCliRequest =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'run';
      readonly target: BackupTarget;
      readonly identityEnv: string;
      readonly bucket: string | null;
      readonly workDir: string;
      readonly includeStorage: boolean;
      readonly dryRun: boolean;
    }
  | { readonly kind: 'refusal'; readonly message: string };

const HELP = `Nabatable independent database backup

Usage: tsx scripts/db/backup/run.ts --target production|staging --identity-env DB_BACKUP_ROLE_URL --bucket <name>
       [--work-dir <dir>] [--skip-storage] [--dry-run]

--bucket defaults to config/recovery/policy.yaml "bucket"; a REPLACE_ME_ placeholder there is
"unconfigured" and the run is refused unless a real bucket is passed explicitly.

Env: <identity-env> (dedicated read-only role URL), BACKUP_ENCRYPTION_KEY (32 bytes hex/base64),
     BACKUP_S3_ENDPOINT, BACKUP_S3_REGION, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY,
     STORAGE_BACKUP_API_URL, STORAGE_BACKUP_TOKEN (unless --skip-storage)
`;

export function parseBackupCliArgs(args: readonly string[]): BackupCliRequest {
  if (args.includes('--help')) return { kind: 'help' };
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--skip-storage' || arg === '--dry-run') {
      flags.add(arg);
      continue;
    }
    if (!arg.startsWith('--')) return { kind: 'refusal', message: `Unexpected argument ${arg}.` };
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      return { kind: 'refusal', message: `${arg} requires a value.` };
    }
    values.set(arg, value);
    index += 1;
  }
  const target = values.get('--target');
  if (target !== 'production' && target !== 'staging') {
    return { kind: 'refusal', message: '--target must be exactly production or staging.' };
  }
  const identityEnv = values.get('--identity-env') ?? DEFAULT_IDENTITY_ENV;
  if (!/^[A-Z][A-Z0-9_]*$/.test(identityEnv)) {
    return { kind: 'refusal', message: '--identity-env must be an UPPER_SNAKE_CASE env name.' };
  }
  const bucket = values.get('--bucket') ?? null;
  if (bucket !== null && bucket.trim() === '') {
    return { kind: 'refusal', message: '--bucket must not be empty.' };
  }
  const workDir = values.get('--work-dir') ?? path.join('.recovery', 'backup-work');
  const unknown = [...values.keys()].filter(
    (name) => !['--target', '--identity-env', '--bucket', '--work-dir'].includes(name),
  );
  if (unknown.length > 0) return { kind: 'refusal', message: `Unknown option ${unknown[0]}.` };
  return {
    kind: 'run',
    target,
    identityEnv,
    bucket,
    workDir,
    includeStorage: !flags.has('--skip-storage'),
    dryRun: flags.has('--dry-run'),
  };
}

export async function main(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  io: {
    readonly stdout: (line: string) => void;
    readonly logger: Logger;
    readonly now: () => Date;
  },
): Promise<number> {
  const request = parseBackupCliArgs(args);
  if (request.kind === 'help') {
    io.stdout(HELP);
    return 0;
  }
  if (request.kind === 'refusal') {
    io.logger.error(request.message);
    io.stdout(HELP);
    return 2;
  }
  let policy: RecoveryPolicy;
  let restoreManifest: RestoreManifest;
  try {
    policy = loadRecoveryPolicy();
    restoreManifest = loadRestoreManifest();
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Failed to load recovery config.');
    return 2;
  }
  const bucket = request.bucket ?? policy.bucket;
  if (request.dryRun) {
    io.stdout(
      JSON.stringify(
        {
          dryRun: true,
          target: request.target,
          identityEnv: request.identityEnv,
          bucket,
          bucketConfigured: isBucketConfigured(bucket),
          parts: buildPgDumpParts(restoreManifest).map((part) => ({
            id: part.id,
            args: part.args,
          })),
          exports: restoreManifest.sqlExports.map((entry) => entry.id),
          storageBuckets: request.includeStorage ? restoreManifest.storageBuckets : [],
        },
        null,
        2,
      ),
    );
    return 0;
  }
  if (!isBucketConfigured(bucket)) {
    io.logger.error(
      `Backup bucket "${bucket}" is unconfigured (policy placeholder or invalid name); pass --bucket <real bucket> or configure config/recovery/policy.yaml.`,
    );
    return 2;
  }
  const s3Resolution = resolveS3ConfigFromEnv(env, bucket);
  if (s3Resolution.kind === 'unconfigured') {
    io.logger.error('Backup bucket credentials are unconfigured.', {
      missing: s3Resolution.missing,
    });
    return 2;
  }
  let storageSource: StorageSource | null = null;
  if (request.includeStorage) {
    const apiUrl = env[STORAGE_BACKUP_ENV.apiUrl]?.trim() ?? '';
    const token = env[STORAGE_BACKUP_ENV.token]?.trim() ?? '';
    if (!/^https:\/\//.test(apiUrl) || !token) {
      io.logger.error(
        `Storage backup requires ${STORAGE_BACKUP_ENV.apiUrl} and ${STORAGE_BACKUP_ENV.token} (or pass --skip-storage).`,
      );
      return 2;
    }
    storageSource = createSupabaseStorageSource({
      apiUrl,
      token,
      fetch: (url, init) => fetch(url, init),
    });
  }
  try {
    const manifest = await runBackup(
      {
        target: request.target,
        identityEnv: request.identityEnv,
        bucket,
        env,
        policy,
        restoreManifest,
        workDir: request.workDir,
        includeStorage: request.includeStorage,
        createdAt: io.now(),
      },
      {
        runner: createNodeCommandRunner(),
        s3: createS3Client(s3Resolution.config, { fetch: (url, init) => fetch(url, init) }),
        storageSource,
        logger: io.logger,
        randomHex8: () => randomBytes(4).toString('hex'),
        ivFactory: () => randomBytes(BACKUP_IV_LENGTH),
      },
    );
    io.stdout(
      JSON.stringify({
        backupId: manifest.backupId,
        sizeBytes: manifest.sizeBytes,
        sha256: manifest.sha256,
      }),
    );
    return 0;
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Backup failed.');
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), process.env, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    logger: createLogger(),
    now: () => new Date(),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'Backup failed.'}\n`);
      process.exitCode = 1;
    },
  );
}
