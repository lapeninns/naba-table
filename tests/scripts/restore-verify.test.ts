import { describe, expect, it } from 'vitest';

import {
  BACKUP_ID,
  createFakeSteps,
  makeClock,
  manifestFixture,
  PROD_REF,
  SIGNING_KEY,
  STAGING_REF,
  TEMP_REF,
} from './recovery-fixtures';
import { validateBackupManifest } from '../../scripts/db/backup/manifest';
import { loadRecoveryPolicy } from '../../scripts/db/backup/policy';
import {
  DRILL_STEP_ORDER,
  verifyRecoveryEvidenceSignature,
} from '../../scripts/db/restore/evidence';
import { pickLatestBackupId } from '../../scripts/db/restore/latest-backup';
import {
  assertDisposableProjectRef,
  parseVerifyCliArgs,
  resolveProjectRef,
  resolveVerifyRuntime,
  RestoreRefusal,
  runRestoreDrill,
} from '../../scripts/db/restore/verify';

import type { Logger } from '../../scripts/db/backup/log';

const policy = loadRecoveryPolicy();
const manifest = validateBackupManifest(manifestFixture());
const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

describe('disposable project ref guard', () => {
  it('refuses production, staging, denylisted and malformed refs', () => {
    expect(() => assertDisposableProjectRef(PROD_REF, policy, {})).toThrow(/production project/);
    expect(() => assertDisposableProjectRef(PROD_REF.toUpperCase(), policy, {})).toThrow(
      RestoreRefusal,
    );
    expect(() => assertDisposableProjectRef(STAGING_REF, policy, {})).toThrow(/staging project/);
    expect(() =>
      assertDisposableProjectRef(TEMP_REF, policy, {
        RESTORE_PROJECT_REF_DENYLIST: `zzz, ${TEMP_REF}`,
      }),
    ).toThrow(/listed in RESTORE_PROJECT_REF_DENYLIST/);
    expect(() => assertDisposableProjectRef('short', policy, {})).toThrow(/20-character/);
    expect(assertDisposableProjectRef(` ${TEMP_REF.toUpperCase()} `, policy, {})).toBe(TEMP_REF);
  });

  it('falls back to RESTORE_VERIFY_PROJECT_REF and still refuses protected refs', () => {
    const request = {
      kind: 'run',
      backupId: null,
      projectRef: null,
      dryRun: false,
      fixturesDir: 'x',
      evidenceOut: null,
      source: 'production',
    } as const;
    expect(resolveProjectRef(request, { RESTORE_VERIFY_PROJECT_REF: TEMP_REF }, policy)).toBe(
      TEMP_REF,
    );
    expect(() =>
      resolveProjectRef(request, { RESTORE_VERIFY_PROJECT_REF: PROD_REF }, policy),
    ).toThrow(/production/);
    expect(() => resolveProjectRef(request, {}, policy)).toThrow(
      /disposable project ref is required/,
    );
  });

  it('refuses to build a runtime when the bucket is a placeholder (never guesses)', async () => {
    const request = {
      kind: 'run',
      backupId: BACKUP_ID,
      projectRef: TEMP_REF,
      dryRun: false,
      fixturesDir: 'x',
      evidenceOut: null,
      source: 'production',
    } as const;
    await expect(
      resolveVerifyRuntime(
        request,
        {
          RECOVERY_EVIDENCE_HMAC_KEY: SIGNING_KEY.toString('hex'),
          BACKUP_ENCRYPTION_KEY: SIGNING_KEY.toString('hex'),
        },
        policy,
      ),
    ).rejects.toThrow(/placeholder/);
    await expect(
      resolveVerifyRuntime({ ...request, projectRef: PROD_REF }, {}, policy),
    ).rejects.toThrow(/production/);
  });
});

describe('verify CLI arguments', () => {
  it('accepts the delegated shape, optional backup id and refuses malformed ids', () => {
    expect(parseVerifyCliArgs(['--backup-id', BACKUP_ID, '--project-ref', TEMP_REF])).toMatchObject(
      {
        kind: 'run',
        backupId: BACKUP_ID,
        projectRef: TEMP_REF,
        source: 'production',
        fixturesDir: 'tests/db/fixtures',
      },
    );
    expect(parseVerifyCliArgs(['--project-ref', TEMP_REF])).toMatchObject({
      kind: 'run',
      backupId: null,
    });
    expect(parseVerifyCliArgs(['--backup-id', 'latest'])).toMatchObject({ kind: 'refusal' });
    expect(parseVerifyCliArgs(['--source', 'prod'])).toMatchObject({ kind: 'refusal' });
    expect(parseVerifyCliArgs(['--what', 'x'])).toMatchObject({ kind: 'refusal' });
  });

  it('picks the newest backup id from bucket keys', () => {
    expect(
      pickLatestBackupId([
        'backups/bk-20260904T000000Z-aaaaaaaa/manifest.json',
        'backups/bk-20260904T120000Z-bbbbbbbb/manifest.json',
        'backups/bk-20260904T120000Z-bbbbbbbb/core.dump.enc',
        'backups/garbage/manifest.json',
      ]),
    ).toBe('bk-20260904T120000Z-bbbbbbbb');
    expect(pickLatestBackupId([])).toBeNull();
  });
});

function drillInput(drillId = 'drill-1') {
  return {
    drillId,
    backupId: BACKUP_ID,
    tempProjectRef: TEMP_REF,
    expectedSourceRef: PROD_REF,
    policy,
  };
}

describe('runRestoreDrill orchestration', () => {
  it('runs the ten steps in order, disables outbound before loading, and signs passing evidence', async () => {
    const calls: string[] = [];
    const clock = makeClock();
    const { signed, manifest: verified } = await runRestoreDrill(drillInput(), {
      steps: createFakeSteps(manifest, calls),
      now: clock.now,
      signingKey: SIGNING_KEY,
      logger,
    });
    const { evidence } = signed;
    expect(verified?.backupId).toBe(BACKUP_ID);
    expect(calls).toEqual([
      'verifyBackup',
      'disableOutbound',
      'restoreData',
      'verifySchema',
      'verifyData',
      'verifyStorage',
      'runIsolationProofs',
      'destroy',
    ]);
    expect(evidence.steps.map((step) => step.id)).toEqual(DRILL_STEP_ORDER);
    expect(evidence.steps.every((step) => step.status === 'passed')).toBe(true);
    const disable = evidence.steps.find((step) => step.id === 'disable_outbound');
    const restore = evidence.steps.find((step) => step.id === 'restore_data');
    expect(Date.parse(disable?.finishedAt ?? '')).toBeLessThanOrEqual(
      Date.parse(restore?.startedAt ?? ''),
    );
    expect(evidence.schedulesDisabledBeforeLoad).toBe(true);
    expect(evidence.withinRto).toBe(true);
    expect(evidence.readinessSeconds).toBeGreaterThan(0);
    expect(evidence.cleanup).toMatchObject({ ran: true, succeeded: true });
    expect(evidence.outcome).toBe('passed');
    expect(evidence.pitrRendered).toBe('PITR: not enabled (disabled, optional add-on)');
    expect(evidence.activeRuntime).toBe('node22');
    expect(evidence.candidateRuntime).toBe('node24');
    expect(verifyRecoveryEvidenceSignature(signed, SIGNING_KEY)).toBe(true);
    expect(verifyRecoveryEvidenceSignature(signed, Buffer.alloc(32, 4))).toBe(false);
  });

  it('never loads data when outbound schedules could not be disabled', async () => {
    const calls: string[] = [];
    const steps = createFakeSteps(manifest, calls, {
      disableOutbound: async () => {
        calls.push('disableOutbound');
        throw new Error('cron.unschedule failed');
      },
    });
    const { signed } = await runRestoreDrill(drillInput(), {
      steps,
      now: makeClock().now,
      signingKey: SIGNING_KEY,
      logger,
    });
    expect(calls).toEqual(['verifyBackup', 'disableOutbound', 'destroy']);
    const byId = new Map(signed.evidence.steps.map((step) => [step.id, step]));
    expect(byId.get('disable_outbound')?.status).toBe('failed');
    expect(byId.get('restore_data')?.status).toBe('skipped');
    expect(byId.get('destroy')?.status).toBe('passed');
    expect(signed.evidence.schedulesDisabledBeforeLoad).toBe(false);
    expect(signed.evidence.outcome).toBe('failed');
  });

  it('always destroys the temporary project, even when backup verification throws', async () => {
    const calls: string[] = [];
    const steps = createFakeSteps(manifest, calls, {
      verifyBackup: async () => {
        calls.push('verifyBackup');
        throw new Error('Backup is 30.0h old');
      },
    });
    const { signed, manifest: verified } = await runRestoreDrill(drillInput(), {
      steps,
      now: makeClock().now,
      signingKey: SIGNING_KEY,
      logger,
    });
    expect(verified).toBeNull();
    expect(calls).toEqual(['verifyBackup', 'destroy']);
    expect(signed.evidence.cleanup).toMatchObject({ ran: true, succeeded: true });
    expect(signed.evidence.outcome).toBe('failed');
    expect(
      signed.evidence.steps.filter((step) => step.status === 'skipped').map((step) => step.id),
    ).toEqual([
      'disable_outbound',
      'restore_data',
      'verify_schema',
      'verify_data',
      'verify_storage',
      'isolation_proofs',
    ]);
  });

  it('runs cleanup after a mid-drill failure and records the failure', async () => {
    const calls: string[] = [];
    const steps = createFakeSteps(manifest, calls, {
      verifySchema: async () => {
        calls.push('verifySchema');
        throw new Error('Migration ledger head mismatch');
      },
    });
    const { signed } = await runRestoreDrill(drillInput(), {
      steps,
      now: makeClock().now,
      signingKey: SIGNING_KEY,
      logger,
    });
    expect(calls.at(-1)).toBe('destroy');
    expect(calls).not.toContain('verifyData');
    expect(signed.evidence.readinessSeconds).toBeNull();
    expect(signed.evidence.withinRto).toBe(false);
    expect(signed.evidence.outcome).toBe('failed');
  });

  it('fails the drill when cleanup fails, even if every check passed', async () => {
    const calls: string[] = [];
    const steps = createFakeSteps(manifest, calls, {
      destroy: async () => {
        calls.push('destroy');
        throw new Error('Project deletion failed with status 500');
      },
    });
    const { signed } = await runRestoreDrill(drillInput(), {
      steps,
      now: makeClock().now,
      signingKey: SIGNING_KEY,
      logger,
    });
    expect(signed.evidence.cleanup).toEqual({
      ran: true,
      succeeded: false,
      detail: { error: 'Project deletion failed with status 500' },
    });
    expect(signed.evidence.outcome).toBe('failed');
  });

  it('fails when readiness exceeds the 4h RTO', async () => {
    const calls: string[] = [];
    const clock = makeClock();
    const steps = createFakeSteps(manifest, calls, {
      restoreData: async () => {
        calls.push('restoreData');
        clock.jump(5 * 3600 * 1000);
        return { restoredParts: ['dump_core'] };
      },
    });
    const { signed } = await runRestoreDrill(drillInput(), {
      steps,
      now: clock.now,
      signingKey: SIGNING_KEY,
      logger,
    });
    const readiness = signed.evidence.steps.find((step) => step.id === 'measure_readiness');
    expect(readiness?.status).toBe('failed');
    expect(String(readiness?.detail.error)).toMatch(/exceeds RTO/);
    expect(signed.evidence.withinRto).toBe(false);
    expect(signed.evidence.outcome).toBe('failed');
    expect(signed.evidence.cleanup.succeeded).toBe(true);
  });

  it('redacts credential-like material that leaks into step details', async () => {
    const calls: string[] = [];
    const steps = createFakeSteps(manifest, calls, {
      restoreData: async () =>
        ({
          restoredParts: ['dump_core'],
          note: 'postgresql://user:secret@db.example.invalid/postgres owner@example.com',
        }) as never,
    });
    const { signed } = await runRestoreDrill(drillInput(), {
      steps,
      now: makeClock().now,
      signingKey: SIGNING_KEY,
      logger,
    });
    const json = JSON.stringify(signed);
    expect(json).not.toContain('secret@');
    expect(json).not.toContain('owner@example.com');
    expect(verifyRecoveryEvidenceSignature(signed, SIGNING_KEY)).toBe(true);
  });
});
