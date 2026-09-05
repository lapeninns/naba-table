import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BACKUP_ID,
  createFakeSteps,
  makeClock,
  manifestFixture,
  PROD_REF,
  SIGNING_KEY,
  TEMP_REF,
} from './recovery-fixtures';
import { validateBackupManifest } from '../../scripts/db/backup/manifest';
import { loadRecoveryPolicy, type RecoveryPolicy } from '../../scripts/db/backup/policy';
import { type SignedRecoveryEvidence } from '../../scripts/db/restore/evidence';
import {
  evaluateRecoveryEvidence,
  EXIT_BLOCK,
  EXIT_OK,
  EXIT_UNCONFIGURED,
  EXIT_WARN,
  exitCodeFor,
  main,
  parseEvidenceCheckArgs,
} from '../../scripts/db/restore/evidence-check';
import { runRestoreDrill } from '../../scripts/db/restore/verify';

import type { Logger } from '../../scripts/db/backup/log';

const policy = loadRecoveryPolicy();
const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const BACKUP_CREATED = '2026-09-04T12:00:00.000Z';
const DRILL_FINISHED_APPROX = '2026-09-04T13:00:00.000Z';

async function passedEvidence(): Promise<SignedRecoveryEvidence> {
  const manifest = validateBackupManifest(manifestFixture());
  const { signed } = await runRestoreDrill(
    {
      drillId: 'drill-1',
      backupId: BACKUP_ID,
      tempProjectRef: TEMP_REF,
      expectedSourceRef: PROD_REF,
      policy,
    },
    {
      steps: createFakeSteps(manifest, []),
      now: makeClock(DRILL_FINISHED_APPROX).now,
      signingKey: SIGNING_KEY,
      logger,
    },
  );
  return signed;
}

function at(iso: string): Date {
  return new Date(iso);
}

function hoursAfter(base: string, hours: number): Date {
  return new Date(Date.parse(base) + hours * 3_600_000);
}

describe('evaluateRecoveryEvidence thresholds', () => {
  it('is ok with a fresh drill and a fresh backup', async () => {
    const evidence = await passedEvidence();
    const manifest = validateBackupManifest(manifestFixture());
    const result = evaluateRecoveryEvidence({
      evidence,
      signatureValid: true,
      backupManifest: manifest,
      policy,
      now: hoursAfter(BACKUP_CREATED, 6),
    });
    expect(result.status).toBe('ok');
    expect(result.findings.map((finding) => finding.level)).not.toContain('block');
    expect(
      result.findings.some(
        (finding) => finding.message === 'PITR: not enabled (disabled, optional add-on)',
      ),
    ).toBe(true);
  });

  it('warns at 18h and blocks at 24h backup age', async () => {
    const evidence = await passedEvidence();
    const manifest = validateBackupManifest(manifestFixture());
    expect(
      evaluateRecoveryEvidence({
        evidence,
        signatureValid: true,
        backupManifest: manifest,
        policy,
        now: hoursAfter(BACKUP_CREATED, 19),
      }).status,
    ).toBe('warn');
    expect(
      evaluateRecoveryEvidence({
        evidence,
        signatureValid: true,
        backupManifest: manifest,
        policy,
        now: hoursAfter(BACKUP_CREATED, 25),
      }).status,
    ).toBe('block');
    expect(
      evaluateRecoveryEvidence({
        evidence,
        signatureValid: true,
        backupManifest: null,
        policy,
        now: hoursAfter(BACKUP_CREATED, 1),
      }).status,
    ).toBe('block');
  });

  it('warns at 21 days and blocks at 30 days drill age (with a fresh backup)', async () => {
    const evidence = await passedEvidence();
    const fresh = (now: Date) =>
      validateBackupManifest(
        manifestFixture({ createdAt: new Date(now.getTime() - 3_600_000).toISOString() }),
      );
    const day22 = hoursAfter(DRILL_FINISHED_APPROX, 22 * 24);
    const day31 = hoursAfter(DRILL_FINISHED_APPROX, 31 * 24);
    const day10 = hoursAfter(DRILL_FINISHED_APPROX, 10 * 24);
    expect(
      evaluateRecoveryEvidence({
        evidence,
        signatureValid: true,
        backupManifest: fresh(day10),
        policy,
        now: day10,
      }).status,
    ).toBe('ok');
    expect(
      evaluateRecoveryEvidence({
        evidence,
        signatureValid: true,
        backupManifest: fresh(day22),
        policy,
        now: day22,
      }).status,
    ).toBe('warn');
    expect(
      evaluateRecoveryEvidence({
        evidence,
        signatureValid: true,
        backupManifest: fresh(day31),
        policy,
        now: day31,
      }).status,
    ).toBe('block');
  });

  it('blocks on missing, unsigned, failed, uncleaned or future evidence', async () => {
    const evidence = await passedEvidence();
    const manifest = validateBackupManifest(manifestFixture());
    const now = hoursAfter(BACKUP_CREATED, 2);
    expect(
      evaluateRecoveryEvidence({
        evidence: null,
        signatureValid: false,
        backupManifest: manifest,
        policy,
        now,
      }).status,
    ).toBe('block');
    expect(
      evaluateRecoveryEvidence({
        evidence,
        signatureValid: false,
        backupManifest: manifest,
        policy,
        now,
      }).findings[0]?.message,
    ).toMatch(/signature is invalid/);
    const failed = { ...evidence, evidence: { ...evidence.evidence, outcome: 'failed' as const } };
    expect(
      evaluateRecoveryEvidence({
        evidence: failed,
        signatureValid: true,
        backupManifest: manifest,
        policy,
        now,
      }).findings[0]?.message,
    ).toMatch(/did not pass/);
    const uncleaned = {
      ...evidence,
      evidence: { ...evidence.evidence, cleanup: { ran: true, succeeded: false, detail: {} } },
    };
    expect(
      evaluateRecoveryEvidence({
        evidence: uncleaned,
        signatureValid: true,
        backupManifest: manifest,
        policy,
        now,
      }).findings[0]?.message,
    ).toMatch(/clean up/);
    const loadedFirst = {
      ...evidence,
      evidence: { ...evidence.evidence, schedulesDisabledBeforeLoad: false },
    };
    expect(
      evaluateRecoveryEvidence({
        evidence: loadedFirst,
        signatureValid: true,
        backupManifest: manifest,
        policy,
        now,
      }).findings[0]?.message,
    ).toMatch(/before disabling outbound schedules/);
    expect(
      evaluateRecoveryEvidence({
        evidence,
        signatureValid: true,
        backupManifest: manifest,
        policy,
        now: at('2026-09-01T00:00:00Z'),
      }).status,
    ).toBe('block');
  });

  it('blocks when the PITR state is misrepresented and never accepts an uninspected enabled rendering', async () => {
    const evidence = await passedEvidence();
    const manifest = validateBackupManifest(manifestFixture());
    const now = hoursAfter(BACKUP_CREATED, 2);
    const claimsEnabled = {
      ...evidence,
      evidence: { ...evidence.evidence, pitrRendered: 'PITR: enabled' },
    };
    const result = evaluateRecoveryEvidence({
      evidence: claimsEnabled,
      signatureValid: true,
      backupManifest: manifest,
      policy,
      now,
    });
    expect(
      result.findings.some(
        (finding) =>
          finding.level === 'block' && /misrepresents the PITR state/.test(finding.message),
      ),
    ).toBe(true);

    const enabledButUninspected: RecoveryPolicy = {
      ...policy,
      pitr: { ...policy.pitr, state: 'enabled' },
    };
    const enabledEvidence = {
      ...evidence,
      evidence: {
        ...evidence.evidence,
        pitrState: 'enabled' as const,
        pitrRendered: 'PITR: not enabled (claimed enabled but never inspected)',
      },
    };
    const enabledManifest = validateBackupManifest(manifestFixture({ pitrState: 'enabled' }));
    const uninspected = evaluateRecoveryEvidence({
      evidence: enabledEvidence,
      signatureValid: true,
      backupManifest: enabledManifest,
      policy: enabledButUninspected,
      now,
    });
    expect(uninspected.findings.some((finding) => finding.message.includes('not enabled'))).toBe(
      true,
    );
    expect(uninspected.findings.some((finding) => /misrepresents/.test(finding.message))).toBe(
      false,
    );
    const disagreeing = evaluateRecoveryEvidence({
      evidence,
      signatureValid: true,
      backupManifest: enabledManifest,
      policy,
      now,
    });
    expect(
      disagreeing.findings.some((finding) =>
        /disagrees with the policy PITR state/.test(finding.message),
      ),
    ).toBe(true);
  });

  it('maps statuses to the documented exit codes', () => {
    expect(exitCodeFor('ok')).toBe(EXIT_OK);
    expect(exitCodeFor('warn')).toBe(EXIT_WARN);
    expect(exitCodeFor('block')).toBe(EXIT_BLOCK);
    expect(
      parseEvidenceCheckArgs(['--evidence', 'a.json', '--backup-manifest', 'b.json', '--json']),
    ).toEqual({ kind: 'run', evidencePath: 'a.json', manifestPath: 'b.json', json: true });
    expect(parseEvidenceCheckArgs(['--bogus'])).toMatchObject({ kind: 'refusal' });
  });
});

describe('evidence-check CLI', () => {
  it('reads local files, verifies the signature and exits with the threshold code', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nabatable-evidence-'));
    try {
      const evidence = await passedEvidence();
      const evidencePath = path.join(dir, 'evidence.json');
      const manifestPath = path.join(dir, 'manifest.json');
      fs.writeFileSync(evidencePath, JSON.stringify(evidence));
      fs.writeFileSync(manifestPath, JSON.stringify(manifestFixture()));
      const env = { RECOVERY_EVIDENCE_HMAC_KEY: SIGNING_KEY.toString('hex') };
      const out: string[] = [];
      const io = (now: Date) => ({
        stdout: (line: string) => out.push(line),
        logger,
        now: () => now,
      });
      expect(
        await main(
          ['--evidence', evidencePath, '--backup-manifest', manifestPath],
          env,
          io(hoursAfter(BACKUP_CREATED, 3)),
        ),
      ).toBe(EXIT_OK);
      expect(
        await main(
          ['--evidence', evidencePath, '--backup-manifest', manifestPath],
          env,
          io(hoursAfter(BACKUP_CREATED, 20)),
        ),
      ).toBe(EXIT_WARN);
      expect(
        await main(
          ['--evidence', evidencePath, '--backup-manifest', manifestPath, '--json'],
          env,
          io(hoursAfter(BACKUP_CREATED, 30)),
        ),
      ).toBe(EXIT_BLOCK);
      expect(
        await main(
          ['--evidence', evidencePath, '--backup-manifest', manifestPath],
          { RECOVERY_EVIDENCE_HMAC_KEY: Buffer.alloc(32, 9).toString('hex') },
          io(hoursAfter(BACKUP_CREATED, 3)),
        ),
      ).toBe(EXIT_BLOCK);
      expect(
        await main(
          ['--evidence', evidencePath, '--backup-manifest', manifestPath],
          {},
          io(hoursAfter(BACKUP_CREATED, 3)),
        ),
      ).toBe(EXIT_UNCONFIGURED);
      // Without files and without bucket credentials the check is unconfigured, never ok.
      expect(await main([], env, io(hoursAfter(BACKUP_CREATED, 3)))).toBe(EXIT_UNCONFIGURED);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
