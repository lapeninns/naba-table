import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import {
  isBucketConfigured,
  isPitrEffectivelyEnabled,
  loadRecoveryPolicy,
  parseRecoveryPolicy,
  RecoveryPolicyError,
  renderPitrState,
} from '../../scripts/db/backup/policy';
import { computeEffectiveRecoveryWindowDays } from '../../scripts/db/backup/recovery-window';
import {
  loadRestoreManifest,
  parseRestoreManifest,
} from '../../scripts/db/backup/restore-manifest';

function rawPolicy(): Record<string, unknown> {
  return parse(fs.readFileSync(path.join('config', 'recovery', 'policy.yaml'), 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('config/recovery/policy.yaml', () => {
  it('validates and carries the agreed objectives', () => {
    const policy = loadRecoveryPolicy();
    expect(policy.rpoHours).toBe(24);
    expect(policy.rtoHours).toBe(4);
    expect(policy.nativeBackup).toBe('supabase-daily-physical');
    expect(policy.independentBackup).toEqual({
      intervalHours: 12,
      retentionDays: 7,
      maxAgeHours: 24,
      warnAtHours: 18,
    });
    expect(policy.pitr.state).toBe('disabled_optional');
    expect(policy.pitr.inspectedAt).toBe('REPLACE_ME_PITR_INSPECTED_AT');
    expect(policy.drill).toEqual({ intervalDays: 14, maxSuccessfulAgeDays: 30, warnAtDays: 21 });
    expect(policy.bucket).toBe('REPLACE_ME_ENCRYPTED_BACKUP_BUCKET');
    expect(isBucketConfigured(policy.bucket)).toBe(false);
    expect(policy.bucket).not.toBe(policy.ciEvidenceBucket);
    expect(policy.protectedProjectRefs).toEqual({
      production: 'vrdiqfudmwydclqpydee',
      staging: 'ndxmivcrehsacuerwxtm',
    });
  });

  it('computes a 9-day effective recovery window from the policy values', () => {
    const policy = loadRecoveryPolicy();
    expect(
      computeEffectiveRecoveryWindowDays({
        nativeRetentionDays: policy.nativeRetentionDays,
        independentRetentionDays: policy.independentBackup.retentionDays,
        intervalHours: policy.independentBackup.intervalHours,
        overhangDays: policy.recoveryWindow.overhangDays,
      }),
    ).toBe(9);
  });

  it.each([
    [
      'bucket equal to ci bucket',
      (raw: Record<string, unknown>) => ({ ...raw, ciEvidenceBucket: raw.bucket }),
    ],
    [
      'altered pitr rule',
      (raw: Record<string, unknown>) => ({
        ...raw,
        pitr: { ...(raw.pitr as object), rule: 'anything' },
      }),
    ],
    [
      'warn >= max hours',
      (raw: Record<string, unknown>) => ({
        ...raw,
        independentBackup: { ...(raw.independentBackup as object), warnAtHours: 24 },
      }),
    ],
    [
      'interval > rpo',
      (raw: Record<string, unknown>) => ({
        ...raw,
        independentBackup: { ...(raw.independentBackup as object), intervalHours: 48 },
      }),
    ],
    [
      'drill warn >= block',
      (raw: Record<string, unknown>) => ({
        ...raw,
        drill: { ...(raw.drill as object), warnAtDays: 30 },
      }),
    ],
    [
      'unknown pitr state',
      (raw: Record<string, unknown>) => ({
        ...raw,
        pitr: { ...(raw.pitr as object), state: 'on' },
      }),
    ],
    ['wrong native backup', (raw: Record<string, unknown>) => ({ ...raw, nativeBackup: 'none' })],
    [
      'same prod and staging refs',
      (raw: Record<string, unknown>) => ({
        ...raw,
        protectedProjectRefs: {
          production: 'vrdiqfudmwydclqpydee',
          staging: 'vrdiqfudmwydclqpydee',
        },
      }),
    ],
    ['bad bucket name', (raw: Record<string, unknown>) => ({ ...raw, bucket: 'Not A Bucket' })],
  ])('fails closed on %s', (_label, mutate) => {
    expect(() => parseRecoveryPolicy(mutate(rawPolicy()))).toThrow(RecoveryPolicyError);
  });

  it('recognises a configured bucket only when it is a real bucket name', () => {
    expect(isBucketConfigured('nabatable-encrypted-backups')).toBe(true);
    expect(isBucketConfigured('REPLACE_ME_X')).toBe(false);
    expect(isBucketConfigured('x')).toBe(false);
  });
});

describe('PITR rendering', () => {
  it('never renders disabled_optional or unknown as enabled', () => {
    expect(renderPitrState('disabled_optional', 'REPLACE_ME_PITR_INSPECTED_AT')).toBe(
      'PITR: not enabled (disabled, optional add-on)',
    );
    expect(renderPitrState('unknown', '2026-09-01T00:00:00Z')).toBe(
      'PITR: not enabled (state unknown)',
    );
    expect(renderPitrState('enabled', 'REPLACE_ME_PITR_INSPECTED_AT')).toMatch(/not enabled/);
    expect(isPitrEffectivelyEnabled('disabled_optional', '2026-09-01T00:00:00Z')).toBe(false);
    expect(isPitrEffectivelyEnabled('enabled', 'REPLACE_ME_PITR_INSPECTED_AT')).toBe(false);
  });

  it('renders enabled only for an inspected enabled state', () => {
    expect(renderPitrState('enabled', '2026-09-01T00:00:00Z')).toBe(
      'PITR: enabled (inspected 2026-09-01T00:00:00Z)',
    );
    expect(isPitrEffectivelyEnabled('enabled', '2026-09-01T00:00:00Z')).toBe(true);
  });
});

describe('config/recovery/restore-manifest.yaml', () => {
  it('captures the application, auth, migration ledger and cron definitions', () => {
    const manifest = loadRestoreManifest();
    expect(manifest.schemas.map((schema) => schema.name)).toEqual([
      'public',
      'auth',
      'supabase_migrations',
      'cron',
    ]);
    expect(manifest.sqlExports.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        'grants',
        'extensions',
        'cron_jobs',
        'migration_ledger',
        'row_counts',
      ]),
    );
    expect(
      manifest.providerManaged.every((entry) =>
        entry.restore.startsWith('restore via supported procedure'),
      ),
    ).toBe(true);
    expect(manifest.providerManaged.map((entry) => entry.name)).toContain('storage');
  });

  it('refuses a schema that is both dumped and provider-managed', () => {
    const raw = parse(
      fs.readFileSync(path.join('config', 'recovery', 'restore-manifest.yaml'), 'utf8'),
    ) as Record<string, unknown>;
    const providerManaged = [
      ...(raw.providerManaged as unknown[]),
      { name: 'public', restore: 'restore via supported procedure' },
    ];
    expect(() => parseRestoreManifest({ ...raw, providerManaged })).toThrow(
      /both dumped and provider-managed/,
    );
  });

  it('refuses non-SELECT or multi-statement exports', () => {
    const raw = parse(
      fs.readFileSync(path.join('config', 'recovery', 'restore-manifest.yaml'), 'utf8'),
    ) as Record<string, unknown>;
    const sqlExports = [
      ...(raw.sqlExports as unknown[]),
      { id: 'evil', query: 'select 1; drop table x' },
    ];
    expect(() => parseRestoreManifest({ ...raw, sqlExports })).toThrow(/must not contain/);
  });
});
