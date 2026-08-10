import { DateTime } from 'luxon';

const MAX_CONTENT_TTL_DAYS = 28;
const RECOVERY_ENVELOPE_DAYS = 30;
const RECOVERY_MARGIN_DAYS = 1;
const EVIDENCE_HASH = /^[a-f0-9]{64}$/;

export type RetentionReadinessEvidence = {
  readonly backupWindowDays: number;
  readonly liveContentTtlDays: number;
  readonly backupRestoreVerifiedAt: string;
  readonly pitrVerifiedAt: string;
  readonly policyApprovedAt: string;
  readonly transformedContentApprovedAt: string | null;
  readonly validUntil: string;
  readonly evidenceHash: string;
};

export type RetentionReadiness =
  | { readonly eligible: true; readonly ttlDays: number; readonly evidenceHash: string }
  | {
      readonly eligible: false;
      readonly reason:
        | 'evidence_missing'
        | 'evidence_expired'
        | 'evidence_invalid'
        | 'transformed_content_policy_missing';
    };

export class RetentionPolicyError extends Error {
  constructor(readonly code: 'INVALID_BACKUP_WINDOW') {
    super('Backup/PITR window does not leave a practical positive TTL');
    this.name = 'RetentionPolicyError';
  }
}

export function computeContentTtlDays(backupWindowDays: number): number {
  const ttlDays = Math.min(
    MAX_CONTENT_TTL_DAYS,
    RECOVERY_ENVELOPE_DAYS - backupWindowDays - RECOVERY_MARGIN_DAYS,
  );
  if (!Number.isInteger(backupWindowDays) || backupWindowDays < 1 || ttlDays < 1) {
    throw new RetentionPolicyError('INVALID_BACKUP_WINDOW');
  }
  return ttlDays;
}

function isTimestamp(value: string): boolean {
  return DateTime.fromISO(value, { setZone: true }).isValid;
}

function timestampMs(value: string): number {
  return DateTime.fromISO(value, { setZone: true }).toMillis();
}

export function retentionReadiness(
  evidence: RetentionReadinessEvidence | null,
  now: Date,
): RetentionReadiness {
  if (!evidence) return { eligible: false, reason: 'evidence_missing' };
  if (!evidence.transformedContentApprovedAt) {
    return { eligible: false, reason: 'transformed_content_policy_missing' };
  }
  if (timestampMs(evidence.validUntil) <= now.getTime()) {
    return { eligible: false, reason: 'evidence_expired' };
  }

  let ttlDays: number;
  try {
    ttlDays = computeContentTtlDays(evidence.backupWindowDays);
  } catch (error) {
    if (error instanceof RetentionPolicyError) {
      return { eligible: false, reason: 'evidence_invalid' };
    }
    throw error;
  }
  const proofTimes = [
    evidence.backupRestoreVerifiedAt,
    evidence.pitrVerifiedAt,
    evidence.policyApprovedAt,
    evidence.transformedContentApprovedAt,
    evidence.validUntil,
  ];
  const backupProofs = [evidence.backupRestoreVerifiedAt, evidence.pitrVerifiedAt].map((value) =>
    timestampMs(value),
  );
  const nowMs = now.getTime();
  const oldestCurrentProofMs = nowMs - RECOVERY_ENVELOPE_DAYS * 24 * 60 * 60 * 1_000;
  if (
    evidence.liveContentTtlDays !== ttlDays ||
    !EVIDENCE_HASH.test(evidence.evidenceHash) ||
    !proofTimes.every(isTimestamp) ||
    backupProofs.some((proof) => proof > nowMs || proof < oldestCurrentProofMs) ||
    timestampMs(evidence.policyApprovedAt) > nowMs ||
    timestampMs(evidence.transformedContentApprovedAt) > nowMs
  ) {
    return { eligible: false, reason: 'evidence_invalid' };
  }
  return { eligible: true, ttlDays, evidenceHash: evidence.evidenceHash };
}

export type ProviderObservation = {
  readonly observedAt: string;
  readonly expiresAt: string;
  readonly externalProfileRowId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
};

export function inheritProviderObservation(observation: ProviderObservation): ProviderObservation {
  return { ...observation };
}
