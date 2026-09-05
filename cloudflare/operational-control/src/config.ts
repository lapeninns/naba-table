import {
  DEFAULT_REQUIRED_HOSTED_WORKFLOWS,
  NUMERIC_ID_PATTERN,
  PLACEHOLDER_PATTERN,
  REQUIRED_PROTECTED_REF,
} from './contracts';

import type { OperationalControlEnv } from './contracts';

export type ControlPlaneConfig = {
  readonly repositoryId: string;
  readonly localCiAppId: number;
  readonly gateWorkflowId: string;
  readonly fallbackWorkflowId: string;
  readonly scheduledValidationWorkflowId: string;
  readonly protectedRef: string;
  readonly requiredHostedWorkflows: readonly string[];
};

export type ConfigResult =
  | { readonly ok: true; readonly config: ControlPlaneConfig }
  | { readonly ok: false; readonly missing: readonly string[] };

const WORKFLOW_PATH_PATTERN = /^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/u;

export function isConfiguredValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER_PATTERN.test(value);
}

function configuredNumericId(value: string | undefined): string | null {
  if (!isConfiguredValue(value)) return null;
  const trimmed = value.trim();
  return NUMERIC_ID_PATTERN.test(trimmed) ? trimmed : null;
}

function parseRequiredHostedWorkflows(value: string | undefined): readonly string[] | null {
  if (value === undefined || value.trim() === '') return DEFAULT_REQUIRED_HOSTED_WORKFLOWS;
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0 || entries.length > 20) return null;
  if (!entries.every((entry) => WORKFLOW_PATH_PATTERN.test(entry))) return null;
  return Array.from(new Set(entries));
}

/**
 * Resolves the trusted control-plane identity from vars. Every id must be a real numeric
 * GitHub id; placeholders and malformed values report as missing so callers fail closed.
 */
export function resolveControlPlaneConfig(env: OperationalControlEnv): ConfigResult {
  const missing: string[] = [];
  const repositoryId = configuredNumericId(env.REPOSITORY_ID);
  if (!repositoryId) missing.push('REPOSITORY_ID');
  const localCiAppId = configuredNumericId(env.LOCAL_CI_APP_ID);
  if (!localCiAppId) missing.push('LOCAL_CI_APP_ID');
  const gateWorkflowId = configuredNumericId(env.GATE_WORKFLOW_ID);
  if (!gateWorkflowId) missing.push('GATE_WORKFLOW_ID');
  const fallbackWorkflowId = configuredNumericId(env.FALLBACK_WORKFLOW_ID);
  if (!fallbackWorkflowId) missing.push('FALLBACK_WORKFLOW_ID');
  const scheduledValidationWorkflowId = configuredNumericId(env.SCHEDULED_VALIDATION_WORKFLOW_ID);
  if (!scheduledValidationWorkflowId) missing.push('SCHEDULED_VALIDATION_WORKFLOW_ID');
  const protectedRef = env.PROTECTED_REF?.trim();
  if (protectedRef !== REQUIRED_PROTECTED_REF) missing.push('PROTECTED_REF');
  const requiredHostedWorkflows = parseRequiredHostedWorkflows(env.REQUIRED_HOSTED_WORKFLOWS);
  if (!requiredHostedWorkflows) missing.push('REQUIRED_HOSTED_WORKFLOWS');

  const ids = new Set([gateWorkflowId, fallbackWorkflowId, scheduledValidationWorkflowId]);
  if (
    gateWorkflowId &&
    fallbackWorkflowId &&
    scheduledValidationWorkflowId &&
    ids.size !== 3 &&
    !missing.includes('GATE_WORKFLOW_ID')
  ) {
    missing.push('WORKFLOW_IDS_MUST_BE_DISTINCT');
  }

  if (
    missing.length > 0 ||
    !repositoryId ||
    !localCiAppId ||
    !gateWorkflowId ||
    !fallbackWorkflowId ||
    !scheduledValidationWorkflowId ||
    !protectedRef ||
    !requiredHostedWorkflows
  ) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    config: {
      repositoryId,
      localCiAppId: Number(localCiAppId),
      gateWorkflowId,
      fallbackWorkflowId,
      scheduledValidationWorkflowId,
      protectedRef,
      requiredHostedWorkflows,
    },
  };
}
