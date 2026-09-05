import { z } from 'zod';

import {
  GitShaSchema,
  IsoTimestampSchema,
  NonNegativeIntSchema,
  PolicyVersionSchema,
  PositiveIntSchema,
  RepositoryIdSchema,
  Sha256DigestSchema,
} from './primitives';
import { ReadinessResponseSchema } from './readiness';
import { rejectCredentialLikeKeys, uniqueStrings } from './validation';

export const EVIDENCE_SCHEMA_VERSION = 1;

export const DEPLOY_ENVIRONMENTS = ['staging', 'production'] as const;
export type DeployEnvironment = (typeof DEPLOY_ENVIRONMENTS)[number];

export const CHECK_CONCLUSIONS = [
  'success',
  'failure',
  'neutral',
  'cancelled',
  'timed_out',
  'action_required',
  'skipped',
  'stale',
] as const;

const EvidenceDigestsSchema = z.record(z.string().min(1), Sha256DigestSchema);

export const CheckEvidenceSchema = z.strictObject({
  name: z.string().min(1),
  conclusion: z.enum(CHECK_CONCLUSIONS),
  headSha: GitShaSchema,
  completedAt: IsoTimestampSchema,
});

/**
 * Produced by `pnpm ci:gate` for a specific source revision. A `pass`
 * verdict is only representable when every check succeeded on that SHA.
 */
export const ReleaseEvidenceSchema = z
  .strictObject({
    version: z.literal(EVIDENCE_SCHEMA_VERSION),
    repositoryId: RepositoryIdSchema,
    sourceRevision: GitShaSchema,
    policyVersion: PolicyVersionSchema,
    evaluatedAt: IsoTimestampSchema,
    gate: z.strictObject({
      checkName: z.literal('Release gate'),
      verdict: z.enum(['pass', 'fail']),
      reasons: z.array(z.string().min(1)),
    }),
    checks: z.array(CheckEvidenceSchema).min(1),
    manifestDigest: Sha256DigestSchema,
    sbomDigest: Sha256DigestSchema,
    evidenceDigests: EvidenceDigestsSchema,
  })
  .superRefine((evidence, ctx) => {
    if (!uniqueStrings(evidence.checks.map((check) => check.name))) {
      ctx.addIssue({ code: 'custom', path: ['checks'], message: 'duplicate check names' });
    }
    const offRevision = evidence.checks.filter(
      (check) => check.headSha !== evidence.sourceRevision,
    );
    if (offRevision.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['checks'],
        message: `checks must be evaluated on sourceRevision: ${offRevision
          .map((check) => check.name)
          .join(', ')}`,
      });
    }
    if (evidence.gate.verdict === 'pass') {
      const notSuccessful = evidence.checks.filter((check) => check.conclusion !== 'success');
      if (notSuccessful.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['gate', 'verdict'],
          message: `pass verdict requires every check to succeed: ${notSuccessful
            .map((check) => check.name)
            .join(', ')}`,
        });
      }
    } else if (evidence.gate.reasons.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['gate', 'reasons'],
        message: 'fail verdict must list at least one reason',
      });
    }
  })
  .superRefine(rejectCredentialLikeKeys);
export type ReleaseEvidence = z.infer<typeof ReleaseEvidenceSchema>;

export const DEPLOY_PROVIDERS = ['vercel', 'cloudflare-workers'] as const;

export const DeploymentEvidenceSchema = z
  .strictObject({
    version: z.literal(EVIDENCE_SCHEMA_VERSION),
    environment: z.enum(DEPLOY_ENVIRONMENTS),
    provider: z.enum(DEPLOY_PROVIDERS),
    service: ReadinessResponseSchema.shape.service,
    sourceRevision: GitShaSchema,
    buildId: z.string().min(1).max(128),
    deployedAt: IsoTimestampSchema,
    /** Digest of the ReleaseEvidence document this deployment was gated on. */
    releaseEvidenceDigest: Sha256DigestSchema,
    readiness: ReadinessResponseSchema,
    evidenceDigests: EvidenceDigestsSchema,
  })
  .superRefine((evidence, ctx) => {
    if (evidence.readiness.revision !== evidence.sourceRevision) {
      ctx.addIssue({
        code: 'custom',
        path: ['readiness', 'revision'],
        message: 'readiness revision must match the deployed sourceRevision',
      });
    }
    if (evidence.readiness.service !== evidence.service) {
      ctx.addIssue({
        code: 'custom',
        path: ['readiness', 'service'],
        message: 'readiness service must match the deployed service',
      });
    }
    if (
      evidence.readiness.buildId !== undefined &&
      evidence.readiness.buildId !== evidence.buildId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['readiness', 'buildId'],
        message: 'readiness buildId must match the deployment buildId',
      });
    }
    if (evidence.readiness.status !== 'ready') {
      ctx.addIssue({
        code: 'custom',
        path: ['readiness', 'status'],
        message: 'deployment evidence requires a ready readiness response',
      });
    }
    if ((evidence.provider === 'vercel') !== (evidence.service === 'web')) {
      ctx.addIssue({
        code: 'custom',
        path: ['provider'],
        message: 'web deploys through vercel; workers deploy through cloudflare-workers',
      });
    }
  })
  .superRefine(rejectCredentialLikeKeys);
export type DeploymentEvidence = z.infer<typeof DeploymentEvidenceSchema>;

export const PITR_STATES = ['enabled', 'disabled_optional'] as const;
export const VERIFICATION_OUTCOMES = ['passed', 'failed'] as const;
export const CLEANUP_STATES = ['completed', 'failed'] as const;

export const RecoveryVerificationCheckSchema = z.strictObject({
  name: z.string().min(1),
  outcome: z.enum(VERIFICATION_OUTCOMES),
  detail: z.string().max(512).optional(),
});

/**
 * Produced by `pnpm recovery:drill`. The drill only counts when the restored
 * copy was verified and the scratch resources were cleaned up again.
 */
export const RecoveryEvidenceSchema = z
  .strictObject({
    version: z.literal(EVIDENCE_SCHEMA_VERSION),
    drillId: z.string().min(1).max(128),
    environment: z.enum(DEPLOY_ENVIRONMENTS),
    performedAt: IsoTimestampSchema,
    backupIdentity: z.strictObject({
      backupId: z.string().min(1).max(256),
      createdAt: IsoTimestampSchema,
      sizeBytes: NonNegativeIntSchema,
      digest: Sha256DigestSchema,
    }),
    backupAgeHours: z.number().nonnegative(),
    effectiveRecoveryWindowDays: PositiveIntSchema,
    pitrState: z.enum(PITR_STATES),
    verification: z.strictObject({
      outcome: z.enum(VERIFICATION_OUTCOMES),
      checks: z.array(RecoveryVerificationCheckSchema).min(1),
      restoredRowCounts: z.record(z.string().min(1), NonNegativeIntSchema),
    }),
    rtoMinutes: z.number().nonnegative(),
    cleanup: z.strictObject({
      status: z.enum(CLEANUP_STATES),
      resourcesRemoved: z.array(z.string().min(1)),
      verifiedAt: IsoTimestampSchema,
    }),
    evidenceDigests: EvidenceDigestsSchema,
  })
  .superRefine((evidence, ctx) => {
    const failedChecks = evidence.verification.checks.filter((check) => check.outcome === 'failed');
    if (evidence.verification.outcome === 'passed' && failedChecks.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['verification', 'outcome'],
        message: `verification cannot pass with failed checks: ${failedChecks
          .map((check) => check.name)
          .join(', ')}`,
      });
    }
    const backupAgeMs =
      Date.parse(evidence.performedAt) - Date.parse(evidence.backupIdentity.createdAt);
    if (backupAgeMs < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['backupIdentity', 'createdAt'],
        message: 'backup cannot be created after the drill was performed',
      });
    } else if (Math.abs(backupAgeMs / 3_600_000 - evidence.backupAgeHours) > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['backupAgeHours'],
        message: 'backupAgeHours must agree with performedAt - backupIdentity.createdAt (±1h)',
      });
    }
    if (evidence.backupAgeHours > evidence.effectiveRecoveryWindowDays * 24) {
      ctx.addIssue({
        code: 'custom',
        path: ['backupAgeHours'],
        message: 'backup is older than the effective recovery window',
      });
    }
    if (Date.parse(evidence.cleanup.verifiedAt) < Date.parse(evidence.performedAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['cleanup', 'verifiedAt'],
        message: 'cleanup cannot be verified before the drill was performed',
      });
    }
  })
  .superRefine(rejectCredentialLikeKeys);
export type RecoveryEvidence = z.infer<typeof RecoveryEvidenceSchema>;

export function isRecoveryEvidenceAcceptable(evidence: RecoveryEvidence): boolean {
  return evidence.verification.outcome === 'passed' && evidence.cleanup.status === 'completed';
}
