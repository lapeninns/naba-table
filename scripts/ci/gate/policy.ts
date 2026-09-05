import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CI_PROFILES, isImageDigest, type CiProfile } from './tuple';

/**
 * Trusted CI policy (config/ci/policy.json). The gate loads it from the
 * protected `main` checkout, never from the candidate revision.
 *
 * Identifiers that can only be known after the GitHub Apps and workflows exist
 * are shipped as `REPLACE_ME_*` placeholders. `resolvePolicy` reports them as
 * unconfigured; the gate refuses to evaluate until every one is replaced.
 */

export const PLACEHOLDER_PATTERN = /^REPLACE_ME_[A-Z0-9_]+$/;
export const DEFAULT_POLICY_PATH = 'config/ci/policy.json';

export type GateMode = 'merge' | 'main-deploy';

/**
 * Suites a profile must evidence. `requiredSuites` must pass; `conditionalSuites`
 * are governed by a changed-path rule in scripts/ci/profiles and may legitimately be
 * skipped, but must still be present in the evidence and must not fail.
 */
export type ProfileSuitePolicy = { requiredSuites: string[]; conditionalSuites: string[] };

export type HostedWorkflowRequirement = {
  displayName: string;
  id: number | null;
  requiredJobs: string[];
};

export type CiPolicy = {
  policyVersion: string;
  repositoryId: number | null;
  protectedBranch: string;
  githubActionsAppId: number;
  localCi: {
    appSlug: string;
    appId: number | null;
    installationId: number | null;
    checkNamePrefix: string;
  };
  dispatch: { appSlug: string; appId: number | null };
  gateCheckName: string;
  allowedControllerVersions: string[];
  allowedImageDigests: string[];
  runtime: { activeRuntime: string; candidateRuntime: string; qualificationNote: string };
  freshnessHours: Record<GateMode, number | null>;
  profiles: Record<CiProfile, ProfileSuitePolicy>;
  suiteInventory: Record<string, string>;
  compatibilityChecks: Record<string, string>;
  requiredHostedWorkflows: HostedWorkflowRequirement[];
  fallbackWorkflow: {
    displayName: string;
    id: number | null;
    environment: string;
    checkNamePrefix: string;
  };
};

export type PolicyResolution = {
  policy: CiPolicy;
  /** Human-readable paths of placeholder values still present. */
  unconfigured: string[];
  /** Structural problems: the file cannot be trusted at all. */
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

type Ctx = { errors: string[]; unconfigured: string[] };

function readString(ctx: Ctx, record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    ctx.errors.push(`${label} must be a non-empty string`);
    return '';
  }
  return value;
}

/** Numeric identifier or REPLACE_ME placeholder. */
function readIdentifier(
  ctx: Ctx,
  record: Record<string, unknown>,
  key: string,
  label: string,
): number | null {
  const value = record[key];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value)) return Number(value);
  if (typeof value === 'string' && PLACEHOLDER_PATTERN.test(value)) {
    ctx.unconfigured.push(label);
    return null;
  }
  ctx.errors.push(`${label} must be a positive integer or a REPLACE_ME_* placeholder`);
  return null;
}

function readFreshness(ctx: Ctx, raw: unknown): Record<GateMode, number | null> {
  const result: Record<GateMode, number | null> = { merge: null, 'main-deploy': null };
  if (!isRecord(raw)) {
    ctx.errors.push('freshnessHours must be an object');
    return result;
  }
  for (const mode of ['merge', 'main-deploy'] as const) {
    const value = raw[mode];
    if (value === null) {
      result[mode] = null;
    } else if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      result[mode] = value;
    } else {
      ctx.errors.push(`freshnessHours.${mode} must be null or a positive number`);
    }
  }
  if (result['main-deploy'] === null) {
    ctx.errors.push('freshnessHours.main-deploy must be bounded (null disables freshness)');
  }
  return result;
}

function readProfiles(ctx: Ctx, raw: unknown): Record<CiProfile, ProfileSuitePolicy> {
  const result = {
    pr: { requiredSuites: [], conditionalSuites: [] },
    main: { requiredSuites: [], conditionalSuites: [] },
    nightly: { requiredSuites: [], conditionalSuites: [] },
  } as Record<CiProfile, ProfileSuitePolicy>;
  if (!isRecord(raw)) {
    ctx.errors.push('profiles must be an object');
    return result;
  }
  for (const profile of CI_PROFILES) {
    const entry = raw[profile];
    if (
      !isRecord(entry) ||
      !isStringArray(entry.requiredSuites) ||
      entry.requiredSuites.length === 0
    ) {
      ctx.errors.push(`profiles.${profile}.requiredSuites must be a non-empty string array`);
      continue;
    }
    const conditionalRaw = entry.conditionalSuites ?? [];
    if (!isStringArray(conditionalRaw)) {
      ctx.errors.push(`profiles.${profile}.conditionalSuites must be a string array when present`);
      continue;
    }
    const required = new Set(entry.requiredSuites);
    for (const suite of conditionalRaw) {
      if (required.has(suite)) {
        ctx.errors.push(`profiles.${profile}: suite "${suite}" is both required and conditional`);
      }
    }
    result[profile] = {
      requiredSuites: [...entry.requiredSuites],
      conditionalSuites: [...conditionalRaw],
    };
  }
  const unknownProfiles = Object.keys(raw).filter(
    (key) => !(CI_PROFILES as readonly string[]).includes(key),
  );
  for (const key of unknownProfiles) ctx.errors.push(`profiles.${key} is not a known profile`);
  return result;
}

function readStringMap(ctx: Ctx, raw: unknown, label: string): Record<string, string> {
  if (!isRecord(raw)) {
    ctx.errors.push(`${label} must be an object`);
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string' || value.length === 0) {
      ctx.errors.push(`${label}.${key} must be a non-empty string`);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function readHostedWorkflows(ctx: Ctx, raw: unknown): HostedWorkflowRequirement[] {
  if (!isRecord(raw)) {
    ctx.errors.push('requiredHostedWorkflows must be an object keyed by workflow display name');
    return [];
  }
  const result: HostedWorkflowRequirement[] = [];
  for (const [displayName, entry] of Object.entries(raw)) {
    if (!isRecord(entry)) {
      ctx.errors.push(`requiredHostedWorkflows["${displayName}"] must be an object`);
      continue;
    }
    const id = readIdentifier(ctx, entry, 'id', `requiredHostedWorkflows["${displayName}"].id`);
    if (!isStringArray(entry.requiredJobs) || entry.requiredJobs.length === 0) {
      ctx.errors.push(
        `requiredHostedWorkflows["${displayName}"].requiredJobs must be a non-empty array`,
      );
      continue;
    }
    result.push({ displayName, id, requiredJobs: [...entry.requiredJobs] });
  }
  return result;
}

export function parsePolicy(raw: unknown): PolicyResolution {
  const ctx: Ctx = { errors: [], unconfigured: [] };
  const empty: CiPolicy = {
    policyVersion: '',
    repositoryId: null,
    protectedBranch: 'main',
    githubActionsAppId: 0,
    localCi: { appSlug: '', appId: null, installationId: null, checkNamePrefix: '' },
    dispatch: { appSlug: '', appId: null },
    gateCheckName: '',
    allowedControllerVersions: [],
    allowedImageDigests: [],
    runtime: { activeRuntime: '', candidateRuntime: '', qualificationNote: '' },
    freshnessHours: { merge: null, 'main-deploy': null },
    profiles: {
      pr: { requiredSuites: [], conditionalSuites: [] },
      main: { requiredSuites: [], conditionalSuites: [] },
      nightly: { requiredSuites: [], conditionalSuites: [] },
    },
    suiteInventory: {},
    compatibilityChecks: {},
    requiredHostedWorkflows: [],
    fallbackWorkflow: { displayName: '', id: null, environment: '', checkNamePrefix: '' },
  };
  if (!isRecord(raw)) {
    return { policy: empty, unconfigured: [], errors: ['policy must be a JSON object'] };
  }

  const localCiRaw = isRecord(raw.localCi) ? raw.localCi : {};
  const dispatchRaw = isRecord(raw.dispatch) ? raw.dispatch : {};
  const runtimeRaw = isRecord(raw.runtime) ? raw.runtime : {};
  const fallbackRaw = isRecord(raw.fallbackWorkflow) ? raw.fallbackWorkflow : {};
  if (!isRecord(raw.localCi)) ctx.errors.push('localCi must be an object');
  if (!isRecord(raw.dispatch)) ctx.errors.push('dispatch must be an object');
  if (!isRecord(raw.runtime)) ctx.errors.push('runtime must be an object');
  if (!isRecord(raw.fallbackWorkflow)) ctx.errors.push('fallbackWorkflow must be an object');

  const githubActionsAppId = raw.githubActionsAppId;
  if (typeof githubActionsAppId !== 'number' || !Number.isSafeInteger(githubActionsAppId)) {
    ctx.errors.push('githubActionsAppId must be an integer');
  }

  const allowedControllerVersions = isStringArray(raw.allowedControllerVersions)
    ? raw.allowedControllerVersions
    : [];
  if (allowedControllerVersions.length === 0) {
    ctx.errors.push('allowedControllerVersions must be a non-empty string array');
  }

  const allowedImageDigestsRaw = isStringArray(raw.allowedImageDigests)
    ? raw.allowedImageDigests
    : [];
  if (allowedImageDigestsRaw.length === 0) {
    ctx.errors.push('allowedImageDigests must be a non-empty string array');
  }
  const allowedImageDigests: string[] = [];
  allowedImageDigestsRaw.forEach((digest, index) => {
    if (isImageDigest(digest)) allowedImageDigests.push(digest);
    else if (PLACEHOLDER_PATTERN.test(digest))
      ctx.unconfigured.push(`allowedImageDigests[${index}]`);
    else ctx.errors.push(`allowedImageDigests[${index}] must be sha256:<64 hex> or a placeholder`);
  });

  const activeRuntime = readString(ctx, runtimeRaw, 'activeRuntime', 'runtime.activeRuntime');
  if (activeRuntime !== '' && activeRuntime !== 'node22') {
    ctx.errors.push('runtime.activeRuntime must remain node22 until node24 is qualified');
  }

  const policy: CiPolicy = {
    policyVersion: readString(ctx, raw, 'policyVersion', 'policyVersion'),
    repositoryId: readIdentifier(ctx, raw, 'repositoryId', 'repositoryId'),
    protectedBranch: readString(ctx, raw, 'protectedBranch', 'protectedBranch'),
    githubActionsAppId: typeof githubActionsAppId === 'number' ? githubActionsAppId : 0,
    localCi: {
      appSlug: readString(ctx, localCiRaw, 'appSlug', 'localCi.appSlug'),
      appId: readIdentifier(ctx, localCiRaw, 'appId', 'localCi.appId'),
      installationId: readIdentifier(ctx, localCiRaw, 'installationId', 'localCi.installationId'),
      checkNamePrefix: readString(ctx, localCiRaw, 'checkNamePrefix', 'localCi.checkNamePrefix'),
    },
    dispatch: {
      appSlug: readString(ctx, dispatchRaw, 'appSlug', 'dispatch.appSlug'),
      appId: readIdentifier(ctx, dispatchRaw, 'appId', 'dispatch.appId'),
    },
    gateCheckName: readString(ctx, raw, 'gateCheckName', 'gateCheckName'),
    allowedControllerVersions,
    allowedImageDigests,
    runtime: {
      activeRuntime,
      candidateRuntime: readString(ctx, runtimeRaw, 'candidateRuntime', 'runtime.candidateRuntime'),
      qualificationNote: readString(
        ctx,
        runtimeRaw,
        'qualificationNote',
        'runtime.qualificationNote',
      ),
    },
    freshnessHours: readFreshness(ctx, raw.freshnessHours),
    profiles: readProfiles(ctx, raw.profiles),
    suiteInventory: readStringMap(ctx, raw.suiteInventory, 'suiteInventory'),
    compatibilityChecks: readStringMap(ctx, raw.compatibilityChecks, 'compatibilityChecks'),
    requiredHostedWorkflows: readHostedWorkflows(ctx, raw.requiredHostedWorkflows),
    fallbackWorkflow: {
      displayName: readString(ctx, fallbackRaw, 'displayName', 'fallbackWorkflow.displayName'),
      id: readIdentifier(ctx, fallbackRaw, 'id', 'fallbackWorkflow.id'),
      environment: readString(ctx, fallbackRaw, 'environment', 'fallbackWorkflow.environment'),
      checkNamePrefix: readString(
        ctx,
        fallbackRaw,
        'checkNamePrefix',
        'fallbackWorkflow.checkNamePrefix',
      ),
    },
  };

  // Cross-field consistency: every required suite and compatibility target must be inventoried.
  for (const profile of CI_PROFILES) {
    const entry = policy.profiles[profile];
    for (const suite of [...entry.requiredSuites, ...entry.conditionalSuites]) {
      if (!(suite in policy.suiteInventory)) {
        ctx.errors.push(`profiles.${profile} references unknown suite "${suite}"`);
      }
    }
  }
  for (const [checkName, suite] of Object.entries(policy.compatibilityChecks)) {
    if (!(suite in policy.suiteInventory)) {
      ctx.errors.push(`compatibilityChecks["${checkName}"] targets unknown suite "${suite}"`);
    }
  }
  if (policy.requiredHostedWorkflows.length === 0) {
    ctx.errors.push('requiredHostedWorkflows must list at least one hosted workflow');
  }

  return { policy, unconfigured: ctx.unconfigured, errors: ctx.errors };
}

export function loadPolicy(
  repositoryRoot: string,
  relativePath = DEFAULT_POLICY_PATH,
): PolicyResolution {
  const filePath = path.resolve(repositoryRoot, relativePath);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return parsePolicyFailure(`cannot read ${relativePath}: ${message}`);
  }
  return parsePolicy(raw);
}

function parsePolicyFailure(message: string): PolicyResolution {
  const resolution = parsePolicy(null);
  return { ...resolution, errors: [message] };
}

/**
 * Compatibility check names mapped to the suite each one mirrors, for one profile.
 * `conditional` marks suites that a changed-path rule may skip without failing the gate.
 */
export function compatibilityChecksForProfile(
  policy: CiPolicy,
  profile: CiProfile,
): Array<{ checkName: string; suiteId: string; conditional: boolean }> {
  const required = new Set(policy.profiles[profile].requiredSuites);
  const conditional = new Set(policy.profiles[profile].conditionalSuites);
  return Object.entries(policy.compatibilityChecks)
    .filter(([, suiteId]) => required.has(suiteId) || conditional.has(suiteId))
    .map(([checkName, suiteId]) => ({ checkName, suiteId, conditional: conditional.has(suiteId) }));
}
