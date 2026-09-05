import { describe, expect, it } from 'vitest';

import {
  findCredentialLikeKeys,
  isCredentialLikeKey,
} from '@/scripts/ci/contracts/credential-guard';
import {
  DeploymentEvidenceSchema,
  RecoveryEvidenceSchema,
  ReleaseEvidenceSchema,
  isRecoveryEvidenceAcceptable,
} from '@/scripts/ci/contracts/evidence';
import {
  ControllerHeartbeatSchema,
  isHeartbeatStale,
  isHeartbeatWithinSkew,
} from '@/scripts/ci/contracts/heartbeat';
import { CiProfileSchema, SanitizedEnvSchema } from '@/scripts/ci/contracts/profile';
import { ReadinessResponseSchema } from '@/scripts/ci/contracts/readiness';
import { CiRequestSchema } from '@/scripts/ci/contracts/request';
import { CiResultSchema } from '@/scripts/ci/contracts/result';
import {
  ContractValidationError,
  assertWith,
  toJsonSchema,
  validateWith,
} from '@/scripts/ci/contracts/validation';
import { prProfile } from '@/scripts/ci/profiles/pr';

import {
  DIGEST_1,
  NOW,
  SHA_A,
  SHA_B,
  ciResult,
  deploymentEvidence,
  heartbeat,
  mainRequest,
  prRequest,
  readiness,
  recoveryEvidence,
  releaseEvidence,
} from './fixtures';

function issuesOf(schema: Parameters<typeof validateWith>[0], input: unknown): string[] {
  const result = validateWith(schema, input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
}

describe('CiRequest', () => {
  it('accepts well-formed pr and main requests', () => {
    expect(validateWith(CiRequestSchema, prRequest()).ok).toBe(true);
    expect(validateWith(CiRequestSchema, mainRequest()).ok).toBe(true);
  });

  it('rejects placeholder digests, short SHAs, and unknown fields', () => {
    expect(issuesOf(CiRequestSchema, prRequest({ imageDigest: 'REPLACE_ME_IMAGE' }))).toEqual([
      expect.stringContaining('imageDigest'),
    ]);
    expect(issuesOf(CiRequestSchema, prRequest({ headSha: 'abc123' }))).toEqual([
      expect.stringContaining('headSha'),
    ]);
    expect(issuesOf(CiRequestSchema, { ...prRequest(), token: 'x' })).toEqual([
      expect.stringContaining('token'),
    ]);
  });

  it('enforces the tested-SHA tuple per profile', () => {
    expect(issuesOf(CiRequestSchema, prRequest({ testedSha: SHA_A }))).toEqual([
      expect.stringContaining('testedSha'),
    ]);
    expect(issuesOf(CiRequestSchema, prRequest({ prNumber: undefined }))).toEqual([
      expect.stringContaining('prNumber'),
    ]);
    expect(issuesOf(CiRequestSchema, mainRequest({ testedSha: SHA_B }))).toEqual([
      expect.stringContaining('testedSha'),
    ]);
    expect(issuesOf(CiRequestSchema, mainRequest({ prNumber: 7 }))).toEqual([
      expect.stringContaining('prNumber'),
    ]);
    expect(issuesOf(CiRequestSchema, prRequest({ attempt: 0 }))).toEqual([
      expect.stringContaining('attempt'),
    ]);
  });
});

describe('CiResult', () => {
  it('accepts a consistent passed result', () => {
    expect(validateWith(CiResultSchema, ciResult()).ok).toBe(true);
  });

  it('rejects inconsistent inventories and passed results with failures', () => {
    expect(
      issuesOf(
        CiResultSchema,
        ciResult({
          testInventory: {
            discoveredIds: ['a'],
            counts: { discovered: 2, passed: 1, failed: 0, skipped: 0, todo: 0 },
          },
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('discovered'),
        expect.stringContaining('counts'),
      ]),
    );
    expect(
      issuesOf(
        CiResultSchema,
        ciResult({
          testInventory: {
            discoveredIds: ['a'],
            counts: { discovered: 1, passed: 0, failed: 1, skipped: 0, todo: 0 },
          },
        }),
      ),
    ).toEqual([expect.stringContaining('supervisorOutcome')]);
    expect(
      issuesOf(
        CiResultSchema,
        ciResult({
          testInventory: {
            discoveredIds: [],
            counts: { discovered: 0, passed: 0, failed: 0, skipped: 0, todo: 0 },
          },
        }),
      ),
    ).toEqual([expect.stringContaining('discovered')]);
  });

  it('rejects credential-like keys inside evidence digests', () => {
    expect(
      issuesOf(CiResultSchema, ciResult({ evidenceDigests: { 'github-token.txt': DIGEST_1 } })),
    ).toEqual([expect.stringContaining('credential-like')]);
  });
});

describe('ControllerHeartbeat', () => {
  it('accepts the flat Worker-compatible heartbeat with and without lastCompletedAt', () => {
    expect(validateWith(ControllerHeartbeatSchema, heartbeat()).ok).toBe(true);
    expect(
      validateWith(
        ControllerHeartbeatSchema,
        heartbeat({
          status: 'busy',
          running: 1,
          maxConcurrent: 2,
          queueDepth: 3,
          lastCompletedAt: '2026-09-04T09:30:00.000Z',
        }),
      ).ok,
    ).toBe(true);
  });

  it.each([
    ['token', 'top level'],
    ['githubToken', 'camel case'],
    ['GITHUB_APP_PRIVATE_KEY', 'upper snake'],
    ['api-key', 'kebab'],
    ['Authorization', 'header name'],
    ['installation_access_token', 'nested name'],
    ['password', 'plain'],
  ])('rejects credential-like key %s (%s)', (key) => {
    const issues = issuesOf(ControllerHeartbeatSchema, { ...heartbeat(), [key]: 'value' });
    expect(issues.join('\n')).toContain(key);
  });

  it('rejects unknown fields, nested values and over-capacity running counts', () => {
    expect(issuesOf(ControllerHeartbeatSchema, { ...heartbeat(), hostname: 'mac' })).toEqual([
      expect.stringContaining('hostname'),
    ]);
    expect(
      issuesOf(ControllerHeartbeatSchema, { ...heartbeat(), details: { freeDiskGiB: 250 } }),
    ).toEqual([expect.stringContaining('details')]);
    expect(
      issuesOf(ControllerHeartbeatSchema, heartbeat({ running: 2, maxConcurrent: 1 })),
    ).toEqual([expect.stringContaining('running')]);
    expect(
      issuesOf(ControllerHeartbeatSchema, heartbeat({ imageDigest: 'sha256:short' })).length,
    ).toBeGreaterThan(0);
  });

  it('flags staleness after the alert window and clock skew beyond the Worker window', () => {
    const now = new Date('2026-09-04T10:16:00.000Z');
    expect(isHeartbeatStale(heartbeat(), now, 15)).toBe(true);
    expect(isHeartbeatStale(heartbeat(), new Date('2026-09-04T10:10:00.000Z'), 15)).toBe(false);
    expect(isHeartbeatWithinSkew(heartbeat(), new Date('2026-09-04T10:04:00.000Z'))).toBe(true);
    expect(isHeartbeatWithinSkew(heartbeat(), new Date('2026-09-04T10:06:00.000Z'))).toBe(false);
  });
});

describe('credential guard', () => {
  it('detects credential-like keys but not benign ones', () => {
    expect(isCredentialLikeKey('imageDigest')).toBe(false);
    expect(isCredentialLikeKey('dedupKey')).toBe(false);
    expect(isCredentialLikeKey('queueDepth')).toBe(false);
    expect(isCredentialLikeKey('sessionCount')).toBe(false);
    expect(isCredentialLikeKey('SUPABASE_SERVICE_ROLE_KEY')).toBe(true);
    expect(isCredentialLikeKey('client_secret')).toBe(true);
    expect(isCredentialLikeKey('bearer')).toBe(true);
    expect(findCredentialLikeKeys({ a: { b: [{ apiKey: 1 }] } })).toEqual(['a.b.0.apiKey']);
  });
});

describe('ReadinessResponse', () => {
  it('accepts a bounded ready response', () => {
    expect(validateWith(ReadinessResponseSchema, readiness()).ok).toBe(true);
  });

  it('rejects unbounded dependency lists, down-but-ready, and credential keys', () => {
    const dependencies = Array.from({ length: 17 }, (_, index) => ({
      name: `dep-${index}`,
      status: 'ok' as const,
    }));
    expect(issuesOf(ReadinessResponseSchema, readiness({ dependencies }))).toEqual([
      expect.stringContaining('dependencies'),
    ]);
    expect(
      issuesOf(
        ReadinessResponseSchema,
        readiness({ dependencies: [{ name: 'supabase', status: 'down' }] }),
      ),
    ).toEqual([expect.stringContaining('status')]);
    expect(issuesOf(ReadinessResponseSchema, { ...readiness(), monitoringToken: 'x' })).toEqual(
      expect.arrayContaining([expect.stringContaining('monitoringToken')]),
    );
  });
});

describe('ReleaseEvidence', () => {
  it('accepts a pass verdict when every check succeeded on the revision', () => {
    expect(validateWith(ReleaseEvidenceSchema, releaseEvidence()).ok).toBe(true);
  });

  it('rejects pass verdicts with failing or off-revision checks and unreasoned failures', () => {
    expect(
      issuesOf(
        ReleaseEvidenceSchema,
        releaseEvidence({
          checks: [
            { name: 'Local CI / main', conclusion: 'failure', headSha: SHA_A, completedAt: NOW },
          ],
        }),
      ),
    ).toEqual([expect.stringContaining('gate.verdict')]);
    expect(
      issuesOf(
        ReleaseEvidenceSchema,
        releaseEvidence({
          checks: [
            { name: 'Local CI / main', conclusion: 'success', headSha: SHA_B, completedAt: NOW },
          ],
        }),
      ),
    ).toEqual([expect.stringContaining('sourceRevision')]);
    expect(
      issuesOf(
        ReleaseEvidenceSchema,
        releaseEvidence({ gate: { checkName: 'Release gate', verdict: 'fail', reasons: [] } }),
      ),
    ).toEqual([expect.stringContaining('reasons')]);
    expect(
      issuesOf(
        ReleaseEvidenceSchema,
        releaseEvidence({
          gate: {
            checkName: 'Release gate',
            verdict: 'fail',
            reasons: ['Local CI / main missing'],
          },
        }),
      ),
    ).toEqual([]);
  });
});

describe('DeploymentEvidence', () => {
  it('accepts a matching readiness response', () => {
    expect(validateWith(DeploymentEvidenceSchema, deploymentEvidence()).ok).toBe(true);
  });

  it('rejects revision, service, build, provider and readiness mismatches', () => {
    expect(
      issuesOf(DeploymentEvidenceSchema, deploymentEvidence({ sourceRevision: SHA_B })),
    ).toEqual([expect.stringContaining('readiness.revision')]);
    expect(
      issuesOf(
        DeploymentEvidenceSchema,
        deploymentEvidence({ readiness: readiness({ service: 'email-queue-gateway' }) }),
      ),
    ).toEqual([expect.stringContaining('readiness.service')]);
    expect(
      issuesOf(
        DeploymentEvidenceSchema,
        deploymentEvidence({ readiness: readiness({ buildId: 'other' }) }),
      ),
    ).toEqual([expect.stringContaining('readiness.buildId')]);
    expect(
      issuesOf(DeploymentEvidenceSchema, deploymentEvidence({ provider: 'cloudflare-workers' })),
    ).toEqual([expect.stringContaining('provider')]);
    expect(
      issuesOf(
        DeploymentEvidenceSchema,
        deploymentEvidence({ readiness: readiness({ status: 'degraded' }) }),
      ),
    ).toEqual([expect.stringContaining('readiness.status')]);
  });
});

describe('RecoveryEvidence', () => {
  it('accepts a verified, cleaned-up drill', () => {
    expect(validateWith(RecoveryEvidenceSchema, recoveryEvidence()).ok).toBe(true);
    expect(isRecoveryEvidenceAcceptable(recoveryEvidence())).toBe(true);
    expect(
      isRecoveryEvidenceAcceptable(
        recoveryEvidence({ cleanup: { ...recoveryEvidence().cleanup, status: 'failed' } }),
      ),
    ).toBe(false);
  });

  it('rejects inconsistent ages, failed checks under a passed verdict, and future backups', () => {
    expect(issuesOf(RecoveryEvidenceSchema, recoveryEvidence({ backupAgeHours: 48 }))).toEqual([
      expect.stringContaining('backupAgeHours'),
    ]);
    expect(
      issuesOf(
        RecoveryEvidenceSchema,
        recoveryEvidence({
          verification: {
            outcome: 'passed',
            checks: [{ name: 'row-counts', outcome: 'failed', detail: 'bookings mismatch' }],
            restoredRowCounts: {},
          },
        }),
      ),
    ).toEqual([expect.stringContaining('verification.outcome')]);
    expect(
      issuesOf(
        RecoveryEvidenceSchema,
        recoveryEvidence({
          backupIdentity: {
            ...recoveryEvidence().backupIdentity,
            createdAt: '2026-09-05T00:00:00.000Z',
          },
        }),
      ),
    ).toEqual([expect.stringContaining('createdAt')]);
    expect(
      issuesOf(RecoveryEvidenceSchema, recoveryEvidence({ pitrState: 'unknown' as never })),
    ).toEqual([expect.stringContaining('pitrState')]);
  });
});

describe('CiProfile and sanitized env', () => {
  it('accepts the shipped pr profile and rejects a real-looking secret', () => {
    expect(validateWith(CiProfileSchema, prProfile).ok).toBe(true);
    expect(
      issuesOf(SanitizedEnvSchema, { ...prProfile.env, RESEND_API_KEY: 're_live_abcdef123456' }),
    ).toEqual([expect.stringContaining('RESEND_API_KEY')]);
    expect(issuesOf(SanitizedEnvSchema, { ...prProfile.env, TZ: 'Europe/London' })).toEqual([
      expect.stringContaining('TZ'),
    ]);
  });

  it('rejects dangling command references and conditional suites without rules', () => {
    const broken = {
      ...prProfile,
      suites: prProfile.suites.map((suite) =>
        suite.id === 'fast-static-gates'
          ? { ...suite, commandIds: [...suite.commandIds, 'ghost'] }
          : suite,
      ),
    };
    expect(issuesOf(CiProfileSchema, broken)).toEqual([expect.stringContaining('ghost')]);
    const orphan = { ...prProfile, conditionalRules: [] };
    expect(issuesOf(CiProfileSchema, orphan)).toEqual(
      expect.arrayContaining([expect.stringContaining('no rule governs')]),
    );
    const openRule = {
      ...prProfile,
      conditionalRules: [{ ...prProfile.conditionalRules[0], whenUnknown: 'skip' }],
    };
    expect(issuesOf(CiProfileSchema, openRule)).toEqual([expect.stringContaining('whenUnknown')]);
  });
});

describe('validation helpers', () => {
  it('assertWith throws a ContractValidationError listing every issue', () => {
    expect(() => assertWith(CiRequestSchema, {}, 'CiRequest')).toThrow(ContractValidationError);
    try {
      assertWith(CiRequestSchema, {}, 'CiRequest');
    } catch (error) {
      expect(error).toBeInstanceOf(ContractValidationError);
      expect((error as ContractValidationError).issues.length).toBeGreaterThan(5);
    }
  });

  it('exports JSON schema projections for every contract', () => {
    for (const schema of [
      CiRequestSchema,
      CiResultSchema,
      ControllerHeartbeatSchema,
      ReadinessResponseSchema,
      ReleaseEvidenceSchema,
      DeploymentEvidenceSchema,
      RecoveryEvidenceSchema,
      CiProfileSchema,
    ]) {
      const json = toJsonSchema(schema);
      expect(json.type).toBe('object');
      expect(json.properties).toBeDefined();
    }
  });
});
