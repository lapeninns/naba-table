import { dedupKey } from '@/scripts/ci/contracts/request';

import type {
  DeploymentEvidence,
  RecoveryEvidence,
  ReleaseEvidence,
} from '@/scripts/ci/contracts/evidence';
import type { ControllerHeartbeat } from '@/scripts/ci/contracts/heartbeat';
import type { ReadinessResponse } from '@/scripts/ci/contracts/readiness';
import type { CiRequest } from '@/scripts/ci/contracts/request';
import type { CiResult } from '@/scripts/ci/contracts/result';

export const SHA_A = 'a'.repeat(40);
export const SHA_B = 'b'.repeat(40);
export const SHA_C = 'c'.repeat(40);
export const DIGEST_1 = `sha256:${'1'.repeat(64)}`;
export const DIGEST_2 = `sha256:${'2'.repeat(64)}`;
export const POLICY = '2026-09-04.1';
export const NOW = '2026-09-04T10:00:00.000Z';

export function prRequest(overrides: Partial<CiRequest> = {}): CiRequest {
  return {
    repositoryId: 123456789,
    profile: 'pr',
    prNumber: 42,
    headSha: SHA_A,
    baseSha: SHA_B,
    testedSha: SHA_C,
    policyVersion: POLICY,
    imageDigest: DIGEST_1,
    controllerVersion: '0.1.0',
    attempt: 1,
    ...overrides,
  };
}

export function mainRequest(overrides: Partial<CiRequest> = {}): CiRequest {
  return {
    repositoryId: 123456789,
    profile: 'main',
    headSha: SHA_A,
    baseSha: SHA_B,
    testedSha: SHA_A,
    policyVersion: POLICY,
    imageDigest: DIGEST_1,
    controllerVersion: '0.1.0',
    attempt: 1,
    ...overrides,
  };
}

export function ciResult(overrides: Partial<CiResult> = {}): CiResult {
  return {
    version: 1,
    dedupKey: dedupKey(prRequest()),
    supervisorOutcome: 'passed',
    testInventory: {
      discoveredIds: ['tests/a.test.ts::passes', 'tests/b.test.ts::skips'],
      counts: { discovered: 2, passed: 1, failed: 0, skipped: 1, todo: 0 },
    },
    coverage: { lines: 70, branches: 60, functions: 75, statements: 70 },
    runtime: { activeRuntime: 'node22', nodeVersion: '22.23.1', pnpmVersion: '10.34.5' },
    timings: {
      startedAt: NOW,
      finishedAt: '2026-09-04T10:30:00.000Z',
      durationMs: 1_800_000,
      suites: [
        {
          suiteId: 'fast-static-gates',
          outcome: 'passed',
          durationMs: 600_000,
          p95BudgetExceeded: false,
        },
      ],
    },
    evidenceDigests: { 'junit.xml': DIGEST_2 },
    attempt: 1,
    ...overrides,
  };
}

export function heartbeat(overrides: Partial<ControllerHeartbeat> = {}): ControllerHeartbeat {
  return {
    controllerId: 'mac-controller-01',
    controllerVersion: '0.1.0',
    imageDigest: DIGEST_1,
    activeRuntime: 'node22',
    candidateRuntime: 'node24',
    status: 'idle',
    sentAt: NOW,
    queueDepth: 0,
    running: 0,
    maxConcurrent: 1,
    ...overrides,
  };
}

export function readiness(overrides: Partial<ReadinessResponse> = {}): ReadinessResponse {
  return {
    revision: SHA_A,
    service: 'web',
    buildId: 'dpl_123',
    status: 'ready',
    checkedAt: NOW,
    dependencies: [
      { name: 'supabase', status: 'ok', latencyMs: 12 },
      { name: 'resend', status: 'ok' },
    ],
    ...overrides,
  };
}

export function releaseEvidence(overrides: Partial<ReleaseEvidence> = {}): ReleaseEvidence {
  return {
    version: 1,
    repositoryId: 123456789,
    sourceRevision: SHA_A,
    policyVersion: POLICY,
    evaluatedAt: NOW,
    gate: { checkName: 'Release gate', verdict: 'pass', reasons: [] },
    checks: [
      { name: 'Local CI / main', conclusion: 'success', headSha: SHA_A, completedAt: NOW },
      { name: 'Fast static gates', conclusion: 'success', headSha: SHA_A, completedAt: NOW },
    ],
    manifestDigest: DIGEST_1,
    sbomDigest: DIGEST_2,
    evidenceDigests: {},
    ...overrides,
  };
}

export function deploymentEvidence(
  overrides: Partial<DeploymentEvidence> = {},
): DeploymentEvidence {
  return {
    version: 1,
    environment: 'staging',
    provider: 'vercel',
    service: 'web',
    sourceRevision: SHA_A,
    buildId: 'dpl_123',
    deployedAt: NOW,
    releaseEvidenceDigest: DIGEST_1,
    readiness: readiness(),
    evidenceDigests: {},
    ...overrides,
  };
}

export function recoveryEvidence(overrides: Partial<RecoveryEvidence> = {}): RecoveryEvidence {
  return {
    version: 1,
    drillId: 'drill-2026-09-04',
    environment: 'staging',
    performedAt: NOW,
    backupIdentity: {
      backupId: 'backup-2026-09-03',
      createdAt: '2026-09-03T22:00:00.000Z',
      sizeBytes: 1024,
      digest: DIGEST_1,
    },
    backupAgeHours: 12,
    effectiveRecoveryWindowDays: 7,
    pitrState: 'disabled_optional',
    verification: {
      outcome: 'passed',
      checks: [{ name: 'row-counts', outcome: 'passed' }],
      restoredRowCounts: { bookings: 10 },
    },
    rtoMinutes: 25,
    cleanup: {
      status: 'completed',
      resourcesRemoved: ['scratch-db'],
      verifiedAt: '2026-09-04T10:40:00.000Z',
    },
    evidenceDigests: {},
    ...overrides,
  };
}
