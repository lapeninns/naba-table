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
import {
  isRecoveryEvidenceAcceptable,
  RecoveryEvidenceSchema,
} from '../../scripts/ci/contracts/evidence';
import { validateBackupManifest } from '../../scripts/db/backup/manifest';
import { loadRecoveryPolicy } from '../../scripts/db/backup/policy';
import {
  canonicalJson,
  parseEvidenceSigningKey,
  parseSignedRecoveryEvidence,
  RecoveryEvidenceError,
  toGateRecoveryEvidence,
  verifyRecoveryEvidenceSignature,
} from '../../scripts/db/restore/evidence';
import { runRestoreDrill } from '../../scripts/db/restore/verify';

import type { Logger } from '../../scripts/db/backup/log';

const policy = loadRecoveryPolicy();
const manifest = validateBackupManifest(manifestFixture());
const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

async function passedDrill() {
  return runRestoreDrill(
    {
      drillId: 'drill-20260904T130000Z-0000cafe',
      backupId: BACKUP_ID,
      tempProjectRef: TEMP_REF,
      expectedSourceRef: PROD_REF,
      policy,
    },
    { steps: createFakeSteps(manifest, []), now: makeClock().now, signingKey: SIGNING_KEY, logger },
  );
}

describe('recovery evidence signing', () => {
  it('signs canonical JSON and detects tampering or a different key', async () => {
    const { signed } = await passedDrill();
    expect(signed.signature.algorithm).toBe('hmac-sha256');
    expect(verifyRecoveryEvidenceSignature(signed, SIGNING_KEY)).toBe(true);
    const tampered = {
      ...signed,
      evidence: {
        ...signed.evidence,
        outcome: 'passed' as const,
        cleanup: { ...signed.evidence.cleanup, succeeded: true },
        withinRto: true,
        readinessSeconds: 1,
      },
    };
    expect(verifyRecoveryEvidenceSignature(tampered, SIGNING_KEY)).toBe(false);
    expect(verifyRecoveryEvidenceSignature(signed, Buffer.alloc(32, 1))).toBe(false);
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });

  it('parses well-formed documents and rejects malformed ones', async () => {
    const { signed } = await passedDrill();
    const roundTripped = parseSignedRecoveryEvidence(JSON.parse(JSON.stringify(signed)));
    expect(verifyRecoveryEvidenceSignature(roundTripped, SIGNING_KEY)).toBe(true);
    expect(() => parseSignedRecoveryEvidence({})).toThrow(RecoveryEvidenceError);
    expect(() =>
      parseSignedRecoveryEvidence({
        evidence: { ...signed.evidence, evidenceVersion: 9 },
        signature: signed.signature,
      }),
    ).toThrow(/evidenceVersion/);
    expect(() =>
      parseSignedRecoveryEvidence({
        evidence: signed.evidence,
        signature: { ...signed.signature, value: 'zz' },
      }),
    ).toThrow(/malformed/);
  });

  it('requires a signing key of at least 32 bytes', () => {
    expect(() => parseEvidenceSigningKey(undefined)).toThrow(/not set/);
    expect(() => parseEvidenceSigningKey('abc')).toThrow(/at least 32 bytes/);
    expect(parseEvidenceSigningKey(SIGNING_KEY.toString('hex'))).toEqual(SIGNING_KEY);
  });
});

describe('gate-shaped evidence bridge', () => {
  it('emits a document the trusted CI RecoveryEvidenceSchema accepts', async () => {
    const { signed } = await passedDrill();
    const gate = toGateRecoveryEvidence({ signed, backup: manifest, environment: 'production' });
    const parsed = RecoveryEvidenceSchema.safeParse(gate);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    if (parsed.success) {
      expect(isRecoveryEvidenceAcceptable(parsed.data)).toBe(true);
      expect(parsed.data.pitrState).toBe('disabled_optional');
      expect(parsed.data.backupIdentity.digest).toBe(`sha256:${manifest.sha256}`);
      expect(parsed.data.verification.restoredRowCounts).toEqual({ bookings: 3, restaurants: 1 });
      expect(parsed.data.cleanup).toMatchObject({
        status: 'completed',
        resourcesRemoved: [`supabase-project:${TEMP_REF}`],
      });
      expect(parsed.data.effectiveRecoveryWindowDays).toBe(9);
    }
  });

  it('marks failed drills as unacceptable and refuses an unknown PITR state', async () => {
    const failed = await runRestoreDrill(
      {
        drillId: 'drill-2',
        backupId: BACKUP_ID,
        tempProjectRef: TEMP_REF,
        expectedSourceRef: PROD_REF,
        policy,
      },
      {
        steps: createFakeSteps(manifest, [], {
          destroy: async () => {
            throw new Error('boom');
          },
        }),
        now: makeClock().now,
        signingKey: SIGNING_KEY,
        logger,
      },
    );
    const gate = toGateRecoveryEvidence({
      signed: failed.signed,
      backup: manifest,
      environment: 'production',
    });
    const parsed = RecoveryEvidenceSchema.safeParse(gate);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(isRecoveryEvidenceAcceptable(parsed.data)).toBe(false);
    expect(() =>
      toGateRecoveryEvidence({
        signed: failed.signed,
        backup: { ...manifest, pitrState: 'unknown' },
        environment: 'production',
      }),
    ).toThrow(/unknown/);
    expect(() =>
      toGateRecoveryEvidence({
        signed: failed.signed,
        backup: { ...manifest, backupId: 'bk-20260904T120000Z-ffffffff' },
        environment: 'production',
      }),
    ).toThrow(/does not match/);
  });
});
