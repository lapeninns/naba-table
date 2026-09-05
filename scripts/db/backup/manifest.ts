import type { PitrState } from './policy';

/** Backup manifest written next to every independent backup. */

export const BACKUP_MANIFEST_VERSION = 1;
export const BACKUP_ID_PATTERN = /^bk-\d{8}T\d{6}Z-[a-f0-9]{8}$/;

export type BackupArtifact = {
  readonly id: string;
  readonly objectKey: string;
  readonly sizeBytes: number;
  readonly sha256: string;
};

export type BackupManifest = {
  readonly manifestVersion: number;
  readonly backupId: string;
  readonly createdAt: string;
  readonly sourceRef: string;
  readonly target: 'production' | 'staging';
  readonly identity: { readonly user: string; readonly host: string };
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly artifacts: readonly BackupArtifact[];
  readonly schemaVersions: Readonly<Record<string, string>>;
  readonly migrationLedgerHead: string;
  readonly pitrState: PitrState;
  readonly effectiveRecoveryWindowDays: number;
  readonly encryption: { readonly algorithm: 'aes-256-gcm'; readonly keyId: string };
  readonly pgDumpVersion: string;
  readonly policyVersion: number;
  readonly storageObjects: { readonly manifestKey: string; readonly objectCount: number } | null;
};

export class BackupManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupManifestError';
  }
}

const SHA256 = /^[a-f0-9]{64}$/;
const PROJECT_REF = /^[a-z0-9]{20}$/;
const PITR_STATES = new Set(['disabled_optional', 'enabled', 'unknown']);

export function formatBackupId(createdAt: Date, randomHex8: string): string {
  const stamp = createdAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const id = `bk-${stamp}-${randomHex8}`;
  if (!BACKUP_ID_PATTERN.test(id)) {
    throw new BackupManifestError('Generated backup id is malformed.');
  }
  return id;
}

export function backupObjectPrefix(backupId: string): string {
  if (!BACKUP_ID_PATTERN.test(backupId)) {
    throw new BackupManifestError(`Backup id ${backupId} is malformed.`);
  }
  return `backups/${backupId}`;
}

export function backupManifestKey(backupId: string): string {
  return `${backupObjectPrefix(backupId)}/manifest.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireIso(value: unknown, field: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new BackupManifestError(`${field} must be an ISO timestamp.`);
  }
  return value;
}

function requireNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new BackupManifestError(`${field} must be a non-negative integer.`);
  }
  return value;
}

function requireSha(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new BackupManifestError(`${field} must be a hex sha256.`);
  }
  return value;
}

function parseArtifact(value: unknown, index: number): BackupArtifact {
  if (!isRecord(value)) throw new BackupManifestError(`artifacts[${index}] must be an object.`);
  if (typeof value.id !== 'string' || !/^[a-z0-9_]+$/.test(value.id)) {
    throw new BackupManifestError(`artifacts[${index}].id is invalid.`);
  }
  if (typeof value.objectKey !== 'string' || !value.objectKey.startsWith('backups/')) {
    throw new BackupManifestError(`artifacts[${index}].objectKey is invalid.`);
  }
  return {
    id: value.id,
    objectKey: value.objectKey,
    sizeBytes: requireNonNegativeInt(value.sizeBytes, `artifacts[${index}].sizeBytes`),
    sha256: requireSha(value.sha256, `artifacts[${index}].sha256`),
  };
}

export function validateBackupManifest(raw: unknown): BackupManifest {
  if (!isRecord(raw)) throw new BackupManifestError('manifest must be an object.');
  if (raw.manifestVersion !== BACKUP_MANIFEST_VERSION) {
    throw new BackupManifestError(`manifestVersion must be ${BACKUP_MANIFEST_VERSION}.`);
  }
  if (typeof raw.backupId !== 'string' || !BACKUP_ID_PATTERN.test(raw.backupId)) {
    throw new BackupManifestError('backupId is malformed.');
  }
  const createdAt = requireIso(raw.createdAt, 'createdAt');
  if (typeof raw.sourceRef !== 'string' || !PROJECT_REF.test(raw.sourceRef)) {
    throw new BackupManifestError('sourceRef must be a Supabase project ref.');
  }
  if (raw.target !== 'production' && raw.target !== 'staging') {
    throw new BackupManifestError('target must be production or staging.');
  }
  if (
    !isRecord(raw.identity) ||
    typeof raw.identity.user !== 'string' ||
    typeof raw.identity.host !== 'string'
  ) {
    throw new BackupManifestError('identity must carry user and host.');
  }
  if (/password|:\/\//i.test(`${raw.identity.user}${raw.identity.host}`)) {
    throw new BackupManifestError('identity must be redacted (no URLs or passwords).');
  }
  const artifacts = Array.isArray(raw.artifacts) ? raw.artifacts.map(parseArtifact) : [];
  if (artifacts.length === 0) throw new BackupManifestError('artifacts must not be empty.');
  const sizeBytes = requireNonNegativeInt(raw.sizeBytes, 'sizeBytes');
  const summed = artifacts.reduce((total, artifact) => total + artifact.sizeBytes, 0);
  if (summed !== sizeBytes) {
    throw new BackupManifestError('sizeBytes must equal the sum of artifact sizes.');
  }
  const sha256 = requireSha(raw.sha256, 'sha256');
  if (!isRecord(raw.schemaVersions))
    throw new BackupManifestError('schemaVersions must be an object.');
  const schemaVersions: Record<string, string> = {};
  for (const [name, version] of Object.entries(raw.schemaVersions)) {
    if (typeof version !== 'string')
      throw new BackupManifestError(`schemaVersions.${name} must be a string.`);
    schemaVersions[name] = version;
  }
  if (typeof raw.migrationLedgerHead !== 'string' || !/^\d{14}$/.test(raw.migrationLedgerHead)) {
    throw new BackupManifestError('migrationLedgerHead must be a 14-digit migration version.');
  }
  if (typeof raw.pitrState !== 'string' || !PITR_STATES.has(raw.pitrState)) {
    throw new BackupManifestError('pitrState is invalid.');
  }
  const effectiveRecoveryWindowDays = requireNonNegativeInt(
    raw.effectiveRecoveryWindowDays,
    'effectiveRecoveryWindowDays',
  );
  if (effectiveRecoveryWindowDays < 1) {
    throw new BackupManifestError('effectiveRecoveryWindowDays must be at least 1.');
  }
  if (
    !isRecord(raw.encryption) ||
    raw.encryption.algorithm !== 'aes-256-gcm' ||
    typeof raw.encryption.keyId !== 'string' ||
    !/^[a-f0-9]{16}$/.test(raw.encryption.keyId)
  ) {
    throw new BackupManifestError('encryption must be aes-256-gcm with a 16-hex keyId.');
  }
  if (typeof raw.pgDumpVersion !== 'string' || !/\b17\b/.test(raw.pgDumpVersion)) {
    throw new BackupManifestError('pgDumpVersion must record a pg_dump 17 client.');
  }
  if (raw.policyVersion !== 1) throw new BackupManifestError('policyVersion must be 1.');
  let storageObjects: BackupManifest['storageObjects'] = null;
  if (raw.storageObjects !== null && raw.storageObjects !== undefined) {
    if (
      !isRecord(raw.storageObjects) ||
      typeof raw.storageObjects.manifestKey !== 'string' ||
      typeof raw.storageObjects.objectCount !== 'number'
    ) {
      throw new BackupManifestError('storageObjects must carry manifestKey and objectCount.');
    }
    storageObjects = {
      manifestKey: raw.storageObjects.manifestKey,
      objectCount: requireNonNegativeInt(
        raw.storageObjects.objectCount,
        'storageObjects.objectCount',
      ),
    };
  }

  return {
    manifestVersion: BACKUP_MANIFEST_VERSION,
    backupId: raw.backupId,
    createdAt,
    sourceRef: raw.sourceRef,
    target: raw.target,
    identity: { user: raw.identity.user, host: raw.identity.host },
    sizeBytes,
    sha256,
    artifacts,
    schemaVersions,
    migrationLedgerHead: raw.migrationLedgerHead,
    pitrState: raw.pitrState as PitrState,
    effectiveRecoveryWindowDays,
    encryption: { algorithm: 'aes-256-gcm', keyId: raw.encryption.keyId },
    pgDumpVersion: raw.pgDumpVersion,
    policyVersion: 1,
    storageObjects,
  };
}

/** Combined digest across artifacts: sha256 of "<id>:<sha256>\n" lines in artifact order. */
export function combinedArtifactSha256(
  artifacts: readonly BackupArtifact[],
  hash: (data: string) => string,
): string {
  return hash(artifacts.map((artifact) => `${artifact.id}:${artifact.sha256}\n`).join(''));
}
