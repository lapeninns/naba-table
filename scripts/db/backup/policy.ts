import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

/**
 * Recovery policy loader/validator for config/recovery/policy.yaml.
 *
 * Every consumer (backup runner, restore drill, evidence check, docs tests) must go
 * through `parseRecoveryPolicy` so that a malformed or partially edited policy fails
 * closed instead of silently relaxing a threshold.
 */

export const PLACEHOLDER_PREFIX = 'REPLACE_ME_';
export const DEFAULT_POLICY_PATH = path.join('config', 'recovery', 'policy.yaml');

export type PitrState = 'disabled_optional' | 'enabled' | 'unknown';

export type RecoveryPolicy = {
  readonly policyVersion: number;
  readonly rpoHours: number;
  readonly rtoHours: number;
  readonly nativeBackup: 'supabase-daily-physical';
  readonly nativeRetentionDays: number;
  readonly independentBackup: {
    readonly intervalHours: number;
    readonly retentionDays: number;
    readonly maxAgeHours: number;
    readonly warnAtHours: number;
  };
  readonly pitr: {
    readonly state: PitrState;
    readonly inspectedAt: string;
    readonly rule: string;
  };
  readonly drill: {
    readonly intervalDays: number;
    readonly maxSuccessfulAgeDays: number;
    readonly warnAtDays: number;
  };
  readonly bucket: string;
  readonly ciEvidenceBucket: string;
  readonly protectedProjectRefs: {
    readonly production: string;
    readonly staging: string;
  };
  readonly recoveryWindow: {
    readonly overhangDays: number;
  };
};

export class RecoveryPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryPolicyError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new RecoveryPolicyError(`${field} must be an object.`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new RecoveryPolicyError(`${field} must be a positive integer.`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RecoveryPolicyError(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function requireProjectRef(value: unknown, field: string): string {
  const ref = requireString(value, field).toLowerCase();
  if (!/^[a-z0-9]{20}$/.test(ref)) {
    throw new RecoveryPolicyError(`${field} must be a 20-character Supabase project ref.`);
  }
  return ref;
}

export function isPlaceholder(value: string): boolean {
  return value.startsWith(PLACEHOLDER_PREFIX);
}

/** A bucket is "configured" only when it carries no placeholder and is a sane S3 name. */
export function isBucketConfigured(bucket: string): boolean {
  return !isPlaceholder(bucket) && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket);
}

const PITR_STATES: readonly PitrState[] = ['disabled_optional', 'enabled', 'unknown'];

function requirePitrState(value: unknown): PitrState {
  if (typeof value !== 'string' || !PITR_STATES.includes(value as PitrState)) {
    throw new RecoveryPolicyError(
      `pitr.state must be one of ${PITR_STATES.join(', ')} (received ${String(value)}).`,
    );
  }
  return value as PitrState;
}

/**
 * Render a PITR state for humans and evidence. `disabled_optional` must never be shown
 * as enabled; `unknown` must never be shown as either. Anything other than an
 * explicitly inspected `enabled` state renders as "not enabled".
 */
export function renderPitrState(state: PitrState, inspectedAt: string): string {
  switch (state) {
    case 'enabled':
      if (isPlaceholder(inspectedAt)) {
        return 'PITR: not enabled (claimed enabled but never inspected)';
      }
      return `PITR: enabled (inspected ${inspectedAt})`;
    case 'disabled_optional':
      return 'PITR: not enabled (disabled, optional add-on)';
    case 'unknown':
      return 'PITR: not enabled (state unknown)';
  }
}

/** True only for an inspected, explicit `enabled` state. Never derived from a placeholder. */
export function isPitrEffectivelyEnabled(state: PitrState, inspectedAt: string): boolean {
  return (
    state === 'enabled' && !isPlaceholder(inspectedAt) && !Number.isNaN(Date.parse(inspectedAt))
  );
}

export function parseRecoveryPolicy(raw: unknown): RecoveryPolicy {
  const root = requireRecord(raw, 'policy');

  const policyVersion = requirePositiveInteger(root.policyVersion, 'policyVersion');
  if (policyVersion !== 1) {
    throw new RecoveryPolicyError(`Unsupported policyVersion ${policyVersion}; expected 1.`);
  }
  const rpoHours = requirePositiveInteger(root.rpoHours, 'rpoHours');
  const rtoHours = requirePositiveInteger(root.rtoHours, 'rtoHours');

  if (root.nativeBackup !== 'supabase-daily-physical') {
    throw new RecoveryPolicyError('nativeBackup must be supabase-daily-physical.');
  }
  const nativeRetentionDays = requirePositiveInteger(
    root.nativeRetentionDays,
    'nativeRetentionDays',
  );

  const independent = requireRecord(root.independentBackup, 'independentBackup');
  const independentBackup = {
    intervalHours: requirePositiveInteger(
      independent.intervalHours,
      'independentBackup.intervalHours',
    ),
    retentionDays: requirePositiveInteger(
      independent.retentionDays,
      'independentBackup.retentionDays',
    ),
    maxAgeHours: requirePositiveInteger(independent.maxAgeHours, 'independentBackup.maxAgeHours'),
    warnAtHours: requirePositiveInteger(independent.warnAtHours, 'independentBackup.warnAtHours'),
  };
  if (independentBackup.intervalHours > rpoHours) {
    throw new RecoveryPolicyError('independentBackup.intervalHours must not exceed rpoHours.');
  }
  if (independentBackup.warnAtHours >= independentBackup.maxAgeHours) {
    throw new RecoveryPolicyError(
      'independentBackup.warnAtHours must be strictly less than independentBackup.maxAgeHours.',
    );
  }
  if (independentBackup.maxAgeHours > rpoHours) {
    throw new RecoveryPolicyError('independentBackup.maxAgeHours must not exceed rpoHours.');
  }

  const pitrRecord = requireRecord(root.pitr, 'pitr');
  const pitr = {
    state: requirePitrState(pitrRecord.state),
    inspectedAt: requireString(pitrRecord.inspectedAt, 'pitr.inspectedAt'),
    rule: requireString(pitrRecord.rule, 'pitr.rule'),
  };
  if (pitr.rule !== 'disabled_optional must never be rendered as enabled') {
    throw new RecoveryPolicyError('pitr.rule text must not be altered.');
  }

  const drillRecord = requireRecord(root.drill, 'drill');
  const drill = {
    intervalDays: requirePositiveInteger(drillRecord.intervalDays, 'drill.intervalDays'),
    maxSuccessfulAgeDays: requirePositiveInteger(
      drillRecord.maxSuccessfulAgeDays,
      'drill.maxSuccessfulAgeDays',
    ),
    warnAtDays: requirePositiveInteger(drillRecord.warnAtDays, 'drill.warnAtDays'),
  };
  if (drill.warnAtDays >= drill.maxSuccessfulAgeDays) {
    throw new RecoveryPolicyError(
      'drill.warnAtDays must be strictly less than drill.maxSuccessfulAgeDays.',
    );
  }
  if (drill.intervalDays > drill.warnAtDays) {
    throw new RecoveryPolicyError('drill.intervalDays must not exceed drill.warnAtDays.');
  }

  const bucket = requireString(root.bucket, 'bucket');
  const ciEvidenceBucket = requireString(root.ciEvidenceBucket, 'ciEvidenceBucket');
  if (bucket === ciEvidenceBucket) {
    throw new RecoveryPolicyError('bucket must be separate from ciEvidenceBucket.');
  }
  if (!isPlaceholder(bucket) && !isBucketConfigured(bucket)) {
    throw new RecoveryPolicyError('bucket is neither a placeholder nor a valid bucket name.');
  }

  const refs = requireRecord(root.protectedProjectRefs, 'protectedProjectRefs');
  const protectedProjectRefs = {
    production: requireProjectRef(refs.production, 'protectedProjectRefs.production'),
    staging: requireProjectRef(refs.staging, 'protectedProjectRefs.staging'),
  };
  if (protectedProjectRefs.production === protectedProjectRefs.staging) {
    throw new RecoveryPolicyError('protectedProjectRefs.production and staging must differ.');
  }

  const windowRecord = requireRecord(root.recoveryWindow, 'recoveryWindow');
  const recoveryWindow = {
    overhangDays: requirePositiveInteger(windowRecord.overhangDays, 'recoveryWindow.overhangDays'),
  };

  return {
    policyVersion,
    rpoHours,
    rtoHours,
    nativeBackup: 'supabase-daily-physical',
    nativeRetentionDays,
    independentBackup,
    pitr,
    drill,
    bucket,
    ciEvidenceBucket,
    protectedProjectRefs,
    recoveryWindow,
  };
}

export function loadRecoveryPolicy(policyPath = DEFAULT_POLICY_PATH): RecoveryPolicy {
  const resolved = path.isAbsolute(policyPath) ? policyPath : path.join(process.cwd(), policyPath);
  let text: string;
  try {
    text = fs.readFileSync(resolved, 'utf8');
  } catch {
    throw new RecoveryPolicyError(`Recovery policy not found at ${resolved}.`);
  }
  return parseRecoveryPolicy(parse(text));
}
