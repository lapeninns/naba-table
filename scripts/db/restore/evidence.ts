import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { redactValue } from '../backup/log';
import type { PitrState } from '../backup/policy';

/** Recovery drill evidence: redacted, canonical JSON, HMAC-SHA256 signed. */

export const RECOVERY_EVIDENCE_VERSION = 1;
export const RECOVERY_EVIDENCE_KEY_ENV = 'RECOVERY_EVIDENCE_HMAC_KEY';

export type DrillStepId =
  | 'verify_backup'
  | 'disable_outbound'
  | 'restore_data'
  | 'verify_schema'
  | 'verify_data'
  | 'verify_storage'
  | 'isolation_proofs'
  | 'measure_readiness'
  | 'destroy'
  | 'emit_evidence';

export const DRILL_STEP_ORDER: readonly DrillStepId[] = [
  'verify_backup',
  'disable_outbound',
  'restore_data',
  'verify_schema',
  'verify_data',
  'verify_storage',
  'isolation_proofs',
  'measure_readiness',
  'destroy',
  'emit_evidence',
];

export type DrillStepStatus = 'passed' | 'failed' | 'skipped';

export type DrillStepRecord = {
  readonly order: number;
  readonly id: DrillStepId;
  readonly status: DrillStepStatus;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly detail: Record<string, unknown>;
};

export type RecoveryEvidence = {
  readonly evidenceVersion: number;
  readonly drillId: string;
  readonly backupId: string;
  readonly sourceRef: string;
  readonly tempProjectRef: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly readinessSeconds: number | null;
  readonly rtoHours: number;
  readonly withinRto: boolean;
  readonly schedulesDisabledBeforeLoad: boolean;
  readonly steps: readonly DrillStepRecord[];
  readonly cleanup: {
    readonly ran: boolean;
    readonly succeeded: boolean;
    readonly detail: Record<string, unknown>;
  };
  readonly pitrState: PitrState;
  readonly pitrRendered: string;
  readonly outcome: 'passed' | 'failed';
  readonly policyVersion: number;
  readonly activeRuntime: 'node22';
  readonly candidateRuntime: 'node24';
};

export type SignedRecoveryEvidence = {
  readonly evidence: RecoveryEvidence;
  readonly signature: {
    readonly algorithm: 'hmac-sha256';
    readonly keyId: string;
    readonly value: string;
  };
};

export class RecoveryEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryEvidenceError';
  }
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function redactEvidence(evidence: RecoveryEvidence): RecoveryEvidence {
  return redactValue(evidence) as RecoveryEvidence;
}

export function evidenceKeyId(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function parseEvidenceSigningKey(raw: string | undefined): Buffer {
  const value = raw?.trim() ?? '';
  if (!value) throw new RecoveryEvidenceError(`${RECOVERY_EVIDENCE_KEY_ENV} is not set.`);
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length < 32) {
    throw new RecoveryEvidenceError(
      `${RECOVERY_EVIDENCE_KEY_ENV} must decode to at least 32 bytes.`,
    );
  }
  return key;
}

export function signRecoveryEvidence(
  evidence: RecoveryEvidence,
  key: Buffer,
): SignedRecoveryEvidence {
  const redacted = redactEvidence(evidence);
  const value = createHmac('sha256', key).update(canonicalJson(redacted), 'utf8').digest('hex');
  return {
    evidence: redacted,
    signature: { algorithm: 'hmac-sha256', keyId: evidenceKeyId(key), value },
  };
}

export function verifyRecoveryEvidenceSignature(
  signed: SignedRecoveryEvidence,
  key: Buffer,
): boolean {
  if (signed.signature.algorithm !== 'hmac-sha256') return false;
  if (signed.signature.keyId !== evidenceKeyId(key)) return false;
  const expected = createHmac('sha256', key)
    .update(canonicalJson(signed.evidence), 'utf8')
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signed.signature.value, 'hex');
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural validation of an evidence document read from disk or the bucket. */
export function parseSignedRecoveryEvidence(raw: unknown): SignedRecoveryEvidence {
  if (!isRecord(raw) || !isRecord(raw.evidence) || !isRecord(raw.signature)) {
    throw new RecoveryEvidenceError('Evidence document must carry evidence and signature.');
  }
  const evidence = raw.evidence;
  const requiredStrings = [
    'drillId',
    'backupId',
    'sourceRef',
    'tempProjectRef',
    'startedAt',
    'finishedAt',
    'pitrState',
    'pitrRendered',
    'outcome',
  ];
  for (const field of requiredStrings) {
    if (typeof evidence[field] !== 'string') {
      throw new RecoveryEvidenceError(`Evidence field ${field} is missing.`);
    }
  }
  if (evidence.evidenceVersion !== RECOVERY_EVIDENCE_VERSION) {
    throw new RecoveryEvidenceError('Unsupported evidenceVersion.');
  }
  if (
    typeof evidence.withinRto !== 'boolean' ||
    typeof evidence.schedulesDisabledBeforeLoad !== 'boolean'
  ) {
    throw new RecoveryEvidenceError('Evidence booleans are missing.');
  }
  if (
    !isRecord(evidence.cleanup) ||
    typeof evidence.cleanup.succeeded !== 'boolean' ||
    typeof evidence.cleanup.ran !== 'boolean'
  ) {
    throw new RecoveryEvidenceError('Evidence cleanup record is missing.');
  }
  if (!Array.isArray(evidence.steps))
    throw new RecoveryEvidenceError('Evidence steps are missing.');
  if (
    raw.signature.algorithm !== 'hmac-sha256' ||
    typeof raw.signature.keyId !== 'string' ||
    typeof raw.signature.value !== 'string' ||
    !/^[a-f0-9]{64}$/.test(raw.signature.value)
  ) {
    throw new RecoveryEvidenceError('Evidence signature is malformed.');
  }
  return raw as unknown as SignedRecoveryEvidence;
}

/**
 * Bridge to the trusted CI contract (`scripts/ci/contracts/evidence.ts`
 * RecoveryEvidenceSchema). Kept structural on purpose: the recovery tooling must not
 * import CI code, so this adapter emits the exact field set the gate validates and a
 * test asserts compatibility against the real schema.
 */
export type GateRecoveryEvidence = {
  readonly version: 1;
  readonly drillId: string;
  readonly environment: 'staging' | 'production';
  readonly performedAt: string;
  readonly backupIdentity: {
    readonly backupId: string;
    readonly createdAt: string;
    readonly sizeBytes: number;
    readonly digest: string;
  };
  readonly backupAgeHours: number;
  readonly effectiveRecoveryWindowDays: number;
  readonly pitrState: 'enabled' | 'disabled_optional';
  readonly verification: {
    readonly outcome: 'passed' | 'failed';
    readonly checks: readonly {
      readonly name: string;
      readonly outcome: 'passed' | 'failed';
      readonly detail?: string;
    }[];
    readonly restoredRowCounts: Readonly<Record<string, number>>;
  };
  readonly rtoMinutes: number;
  readonly cleanup: {
    readonly status: 'completed' | 'failed';
    readonly resourcesRemoved: readonly string[];
    readonly verifiedAt: string;
  };
  readonly evidenceDigests: Readonly<Record<string, string>>;
};

export type GateBackupSummary = {
  readonly backupId: string;
  readonly createdAt: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly effectiveRecoveryWindowDays: number;
  readonly pitrState: PitrState;
};

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.length > 0 && typeof entry === 'number' && Number.isInteger(entry) && entry >= 0) {
      result[key] = entry;
    }
  }
  return result;
}

export function toGateRecoveryEvidence(input: {
  readonly signed: SignedRecoveryEvidence;
  readonly backup: GateBackupSummary;
  readonly environment: 'staging' | 'production';
}): GateRecoveryEvidence {
  const { evidence } = input.signed;
  if (input.backup.pitrState === 'unknown') {
    throw new RecoveryEvidenceError(
      'PITR state is unknown; refusing to emit gate evidence that would have to guess.',
    );
  }
  if (evidence.backupId !== input.backup.backupId) {
    throw new RecoveryEvidenceError('Gate evidence backup summary does not match the drill.');
  }
  const performedAtMs = Date.parse(evidence.finishedAt);
  const startedAtMs = Date.parse(evidence.startedAt);
  const createdAtMs = Date.parse(input.backup.createdAt);
  if ([performedAtMs, startedAtMs, createdAtMs].some((value) => Number.isNaN(value))) {
    throw new RecoveryEvidenceError('Gate evidence timestamps are invalid.');
  }
  const backupAgeMs = performedAtMs - createdAtMs;
  if (backupAgeMs < 0) {
    throw new RecoveryEvidenceError('Backup cannot be newer than the drill that verified it.');
  }
  const verifyData = evidence.steps.find((step) => step.id === 'verify_data');
  const checks = evidence.steps.map((step) => {
    const reason = step.detail.error ?? step.detail.reason;
    const detail = typeof reason === 'string' ? reason.slice(0, 512) : undefined;
    return {
      name: step.id,
      outcome: step.status === 'passed' ? ('passed' as const) : ('failed' as const),
      ...(detail ? { detail } : {}),
    };
  });
  const rtoMinutes =
    evidence.readinessSeconds !== null
      ? evidence.readinessSeconds / 60
      : Math.max(0, (performedAtMs - startedAtMs) / 60_000);
  return {
    version: 1,
    drillId: evidence.drillId,
    environment: input.environment,
    performedAt: evidence.finishedAt,
    backupIdentity: {
      backupId: input.backup.backupId,
      createdAt: input.backup.createdAt,
      sizeBytes: input.backup.sizeBytes,
      digest: `sha256:${input.backup.sha256}`,
    },
    backupAgeHours: backupAgeMs / 3_600_000,
    effectiveRecoveryWindowDays: input.backup.effectiveRecoveryWindowDays,
    pitrState: input.backup.pitrState,
    verification: {
      outcome: evidence.outcome,
      checks,
      restoredRowCounts: numberRecord(verifyData?.detail.rowCounts),
    },
    rtoMinutes,
    cleanup: {
      status: evidence.cleanup.succeeded ? 'completed' : 'failed',
      resourcesRemoved: stringArray(evidence.cleanup.detail.resourcesDestroyed),
      verifiedAt: evidence.finishedAt,
    },
    evidenceDigests: {
      'recovery-evidence': `sha256:${createHash('sha256').update(canonicalJson(input.signed), 'utf8').digest('hex')}`,
      'backup-manifest': `sha256:${input.backup.sha256}`,
    },
  };
}
