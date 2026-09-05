import { describe, expect, it } from 'vitest';

import { manifestFixture } from './recovery-fixtures';
import {
  backupManifestKey,
  BackupManifestError,
  formatBackupId,
  validateBackupManifest,
} from '../../scripts/db/backup/manifest';

describe('backup manifest', () => {
  it('formats ids and keys deterministically', () => {
    const id = formatBackupId(new Date('2026-09-04T12:00:00.123Z'), '0badcafe');
    expect(id).toBe('bk-20260904T120000Z-0badcafe');
    expect(backupManifestKey(id)).toBe(`backups/${id}/manifest.json`);
    expect(() => backupManifestKey('nope')).toThrow(BackupManifestError);
  });

  it('accepts the documented shape', () => {
    const manifest = validateBackupManifest(manifestFixture());
    expect(manifest.backupId).toBe('bk-20260904T120000Z-0badcafe');
    expect(manifest.effectiveRecoveryWindowDays).toBe(9);
    expect(manifest.storageObjects).toBeNull();
  });

  it.each([
    ['size sum mismatch', { sizeBytes: 999 }],
    ['non-17 pg_dump', { pgDumpVersion: 'pg_dump (PostgreSQL) 16.3' }],
    ['bad ledger head', { migrationLedgerHead: 'latest' }],
    ['unknown pitr state', { pitrState: 'on' }],
    ['window below one day', { effectiveRecoveryWindowDays: 0 }],
    ['identity with URL', { identity: { user: 'postgresql://x:y@h/db', host: 'h' } }],
    ['empty artifacts', { artifacts: [], sizeBytes: 0 }],
    ['wrong policy version', { policyVersion: 2 }],
    ['bad sourceRef', { sourceRef: 'prod' }],
    ['bad keyId', { encryption: { algorithm: 'aes-256-gcm', keyId: 'short' } }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => validateBackupManifest(manifestFixture(overrides))).toThrow(BackupManifestError);
  });
});
