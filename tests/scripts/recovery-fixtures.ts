import { createHash } from 'node:crypto';

import { combinedArtifactSha256, type BackupManifest } from '../../scripts/db/backup/manifest';

import type { S3Client, S3ObjectSummary } from '../../scripts/db/backup/s3';
import type { RestoreSteps } from '../../scripts/db/restore/steps';

/** Shared fixtures for the backup / restore / recovery test files (not a test itself). */

export const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
export const BACKUP_KEY = Buffer.alloc(32, 7);
export const SIGNING_KEY = Buffer.alloc(32, 3);
export const PROD_REF = 'vrdiqfudmwydclqpydee';
export const STAGING_REF = 'ndxmivcrehsacuerwxtm';
export const TEMP_REF = 'tempdrillprojref0001';
export const BACKUP_ID = 'bk-20260904T120000Z-0badcafe';

export function createMemoryS3(): S3Client & { readonly objects: Map<string, Buffer> } {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    async putObject(key, body) {
      objects.set(key, Buffer.from(body));
      return { etag: createHash('md5').update(body).digest('hex') };
    },
    async getObject(key) {
      return objects.get(key) ?? null;
    },
    async headObject(key) {
      const body = objects.get(key);
      return body ? { size: body.length, etag: '', lastModified: null } : null;
    },
    async listObjects(prefix) {
      const summaries: S3ObjectSummary[] = [];
      for (const [key, body] of objects) {
        if (key.startsWith(prefix))
          summaries.push({ key, size: body.length, lastModified: '', etag: '' });
      }
      return summaries;
    },
    async deleteObject(key) {
      objects.delete(key);
    },
  };
}

export function manifestFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const artifacts = [
    {
      id: 'export_migration_ledger',
      objectKey: `backups/${BACKUP_ID}/exports/migration_ledger.csv.enc`,
      sizeBytes: 100,
      sha256: sha('a'),
    },
    {
      id: 'dump_core',
      objectKey: `backups/${BACKUP_ID}/core.dump.enc`,
      sizeBytes: 900,
      sha256: sha('b'),
    },
  ];
  return {
    manifestVersion: 1,
    backupId: BACKUP_ID,
    createdAt: '2026-09-04T12:00:00.000Z',
    sourceRef: PROD_REF,
    target: 'production',
    identity: { user: 'nabatable_backup', host: `db.${PROD_REF}.supabase.co` },
    sizeBytes: 1000,
    sha256: combinedArtifactSha256(artifacts, sha),
    artifacts,
    schemaVersions: { supabase_migrations: '20260809120000', 'extension:pgcrypto': '1.3' },
    migrationLedgerHead: '20260809120000',
    pitrState: 'disabled_optional',
    effectiveRecoveryWindowDays: 9,
    encryption: { algorithm: 'aes-256-gcm', keyId: '0123456789abcdef' },
    pgDumpVersion: 'pg_dump (PostgreSQL) 17.4',
    policyVersion: 1,
    storageObjects: null,
    ...overrides,
  };
}

/** A clock that advances one second per call, starting at `start`. */
export function makeClock(
  start = '2026-09-04T13:00:00.000Z',
  stepMs = 1000,
): { now: () => Date; jump: (ms: number) => void } {
  let current = Date.parse(start);
  return {
    now: () => {
      const value = new Date(current);
      current += stepMs;
      return value;
    },
    jump: (ms) => {
      current += ms;
    },
  };
}

export function createFakeSteps(
  manifest: BackupManifest,
  calls: string[],
  overrides: Partial<RestoreSteps> = {},
): RestoreSteps {
  const record =
    <T>(name: string, value: T) =>
    async (): Promise<T> => {
      calls.push(name);
      return value;
    };
  return {
    verifyBackup: record('verifyBackup', { manifest, ageHours: 1 }),
    disableOutbound: record('disableOutbound', {
      cronUnscheduled: 2,
      killSwitches: ['GBP_EXPORT_ENABLED=false'],
    }),
    restoreData: record('restoreData', { restoredParts: ['dump_core'] }),
    verifySchema: record('verifySchema', {
      migrationHead: manifest.migrationLedgerHead,
      tablesWithoutRls: [],
      missingGrants: 0,
      invalidConstraints: 0,
      invalidIndexes: 0,
      functionCount: 12,
      missingExtensions: [],
      activeCronJobs: 0,
    }),
    verifyData: record('verifyData', {
      tablesCompared: 2,
      countMismatches: [],
      foreignKeyViolations: [],
      rowCounts: { bookings: 3, restaurants: 1 },
    }),
    verifyStorage: record('verifyStorage', {
      objectsChecked: 0,
      failures: [],
      encryptedDataRecovered: true,
    }),
    runIsolationProofs: record('runIsolationProofs', {
      source: 'embedded' as const,
      proofs: [{ name: 'tenant_tables_have_rls', passed: true }],
    }),
    destroy: record('destroy', {
      resourcesDestroyed: [`supabase-project:${TEMP_REF}`],
      credentialsRevoked: ['RESTORE_VERIFY_DB_URL'],
    }),
    ...overrides,
  };
}
