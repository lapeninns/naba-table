import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { ENVIRONMENTS, TARGET_IDENTITY_ENV_KEYS } from './environments';
import { isRecord, parseDeployTarget, writeJsonEvidence, type DeployTarget } from './evidence';
import { flagBoolean, flagString, parseFlags } from './exec';
import { isProductionHostname, parseHostname } from './staging-hosts';
import {
  DEPLOYABLE_WORKERS,
  environmentSection,
  flattenLeaves,
  parseJsonc,
  productionSection,
  wranglerConfigPath,
  type CustomerWorker,
  type FlattenedLeaf,
} from './wrangler-config';

/**
 * Unconfigured placeholders. Cloudflare rejects upper-case R2 bucket names at config-parse
 * time, so bucket placeholders are spelled `replace-me-*`; both spellings are unconfigured.
 */
export const PLACEHOLDER_PATTERN = /replace[-_]me/iu;

/**
 * Config paths that are expected to be identical between staging and production:
 * binding names, Durable Object classes, third-party endpoints and non-identity settings.
 * Everything else that is a string is treated as an identity that must differ.
 */
export const SHARED_PATH_ALLOWLIST: readonly RegExp[] = [
  /^main$/u,
  /^compatibility_date$/u,
  /^compatibility_flags\[\]$/u,
  /^upload_source_maps$/u,
  /^workers_dev$/u,
  /^version_metadata\.binding$/u,
  /^migrations\[\]\./u,
  /^triggers\.crons\[\]$/u,
  /^observability\./u,
  /\.binding$/u,
  /^durable_objects\.bindings\[\]\.name$/u,
  /\.class_name$/u,
  /\.migrations_dir$/u,
  /\.max_batch_size$/u,
  /\.max_batch_timeout$/u,
  /\.max_retries$/u,
  /^vars\.POSTHOG_HOST$/u,
  /^vars\.ALLOWED_REVIEW_DESTINATION_HOSTS$/u,
  /^vars\.DELIVERY_MODE$/u,
  /^vars\.PROTECTED_REF$/u,
  /^githubEnvironment$/u,
  /^vercelTargetFlag\[\]$/u,
];

export type SeparationFindingReason =
  | 'placeholder'
  | 'inherited'
  | 'production-identity'
  | 'missing-env-block';

export type SeparationFinding = {
  readonly scope: string;
  readonly path: string;
  readonly reason: SeparationFindingReason;
  readonly detail: string;
};

export type WorkerConfigInput = {
  readonly worker: CustomerWorker;
  readonly config: Record<string, unknown>;
  readonly source: string;
};

/**
 * vercel.json is shared by both targets (the Vercel project pins environments, not the
 * file), so it may only contain target-neutral settings: cron paths/schedules and build
 * settings. Any host or project identity in it is a separation failure for staging.
 */
export type VercelConfigInput = {
  readonly config: Record<string, unknown>;
  readonly source: string;
};

export const VERCEL_NEUTRAL_PATHS: readonly RegExp[] = [
  /^\$schema$/u,
  /^crons\[\]\.path$/u,
  /^crons\[\]\.schedule$/u,
  /^framework$/u,
  /^buildCommand$/u,
  /^installCommand$/u,
  /^outputDirectory$/u,
  /^regions\[\]$/u,
  /^functions\./u,
  /^headers\[\]\./u,
  /^cleanUrls$/u,
  /^trailingSlash$/u,
];

/** vercel.json keys that bind a deployment to a host or project and must stay out of git. */
export const VERCEL_IDENTITY_KEYS: readonly string[] = ['alias', 'env', 'build', 'scope', 'name'];

export type SeparationInput = {
  readonly scope?: 'all' | 'workers';
  readonly target: DeployTarget;
  readonly workers: readonly WorkerConfigInput[];
  readonly vercel?: VercelConfigInput | null;
  readonly environments?: typeof ENVIRONMENTS;
  readonly processEnv?: NodeJS.ProcessEnv;
};

export type SeparationReport = {
  readonly kind: 'separation-validation';
  readonly scope: 'all' | 'workers';
  readonly target: DeployTarget;
  readonly ok: boolean;
  readonly findings: readonly SeparationFinding[];
  readonly checkedFields: number;
  readonly configDigest: string;
  readonly vercelConfigDigest: string | null;
  readonly workers: readonly { readonly worker: CustomerWorker; readonly workerName: string }[];
  readonly checkedAt: string;
};

function normalizePath(leafPath: string): string {
  return leafPath.replace(/\[\d+\]/gu, '[]');
}

function isSharedPath(leafPath: string): boolean {
  const normalized = normalizePath(leafPath);
  return SHARED_PATH_ALLOWLIST.some((pattern) => pattern.test(normalized));
}

function identityLeaves(section: Record<string, unknown>): FlattenedLeaf[] {
  return flattenLeaves(section).filter(
    (leaf) => typeof leaf.value === 'string' && !isSharedPath(leaf.path),
  );
}

function hostsIn(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseHostname);
}

function compareSections(params: {
  readonly scope: string;
  readonly target: DeployTarget;
  readonly targetSection: Record<string, unknown>;
  readonly otherSection: Record<string, unknown>;
}): { findings: SeparationFinding[]; checked: number } {
  const findings: SeparationFinding[] = [];
  const targetLeaves = identityLeaves(params.targetSection);
  const otherValues = new Map<string, string>();
  for (const leaf of identityLeaves(params.otherSection)) {
    otherValues.set(String(leaf.value), leaf.path);
  }

  for (const leaf of targetLeaves) {
    const value = String(leaf.value);
    if (PLACEHOLDER_PATTERN.test(value)) {
      findings.push({
        scope: params.scope,
        path: leaf.path,
        reason: 'placeholder',
        detail: `"${value}" is an unconfigured placeholder; provision the ${params.target} resource and record its real value.`,
      });
      continue;
    }
    // These GitHub resources govern the same repository in both environments.
    // Keep placeholder checks above and restrict the exception to numeric control-plane IDs.
    if (
      params.scope === 'operational-control' &&
      /^vars\.(REPOSITORY_ID|LOCAL_CI_APP_ID|GATE_WORKFLOW_ID|FALLBACK_WORKFLOW_ID|SCHEDULED_VALIDATION_WORKFLOW_ID)$/u.test(
        leaf.path,
      ) &&
      /^[1-9][0-9]*$/u.test(value)
    )
      continue;
    // This is a feature switch, not a resource identity. Restrict the exception to
    // the control plane and its two exact boolean string values.
    if (
      params.scope === 'operational-control' &&
      leaf.path === 'vars.POST_DEPLOY_OBSERVER_ENABLED' &&
      (value === 'true' || value === 'false')
    )
      continue;
    const otherPath = otherValues.get(value);
    if (otherPath !== undefined) {
      findings.push({
        scope: params.scope,
        path: leaf.path,
        reason: 'inherited',
        detail: `value is shared with the other environment at ${otherPath}; ${params.target} must use its own resource.`,
      });
    }
    if (params.target === 'staging' && hostsIn(value).some(isProductionHostname)) {
      findings.push({
        scope: params.scope,
        path: leaf.path,
        reason: 'production-identity',
        detail: `"${value}" references a production host or project; staging may not point at production.`,
      });
    }
  }
  return { findings, checked: targetLeaves.length };
}

export function digestWorkerConfigs(workers: readonly WorkerConfigInput[]): string {
  const hash = createHash('sha256');
  for (const entry of [...workers].sort((a, b) => a.worker.localeCompare(b.worker))) {
    hash.update(entry.worker);
    hash.update('\0');
    hash.update(JSON.stringify(entry.config));
    hash.update('\n');
  }
  return hash.digest('hex');
}

function isVercelNeutralPath(leafPath: string): boolean {
  const normalized = normalizePath(leafPath);
  return VERCEL_NEUTRAL_PATHS.some((pattern) => pattern.test(normalized));
}

export function checkVercelConfig(params: {
  readonly target: DeployTarget;
  readonly vercel: VercelConfigInput;
  readonly environments: typeof ENVIRONMENTS;
}): { findings: SeparationFinding[]; checked: number } {
  const findings: SeparationFinding[] = [];
  const scope = 'vercel.json';
  for (const key of VERCEL_IDENTITY_KEYS) {
    if (key in params.vercel.config) {
      findings.push({
        scope,
        path: key,
        reason: 'production-identity',
        detail: `"${key}" binds vercel.json to a project/host; environment identity must come from the Vercel project (deploy --target), not from the shared file.`,
      });
    }
  }
  const otherIdentities = new Set<string>();
  for (const target of Object.keys(params.environments) as DeployTarget[]) {
    if (target === params.target) continue;
    for (const leaf of identityLeaves(
      params.environments[target] as unknown as Record<string, unknown>,
    )) {
      otherIdentities.add(String(leaf.value));
    }
  }
  const leaves = flattenLeaves(params.vercel.config).filter(
    (leaf) => typeof leaf.value === 'string' && !isVercelNeutralPath(leaf.path),
  );
  for (const leaf of leaves) {
    const value = String(leaf.value);
    if (PLACEHOLDER_PATTERN.test(value)) {
      findings.push({
        scope,
        path: leaf.path,
        reason: 'placeholder',
        detail: `"${value}" is an unconfigured placeholder.`,
      });
      continue;
    }
    if (otherIdentities.has(value)) {
      findings.push({
        scope,
        path: leaf.path,
        reason: 'inherited',
        detail: `value belongs to the other environment; vercel.json must stay target-neutral.`,
      });
    }
    if (params.target === 'staging' && hostsIn(value).some(isProductionHostname)) {
      findings.push({
        scope,
        path: leaf.path,
        reason: 'production-identity',
        detail: `"${value}" references a production host while validating staging.`,
      });
    }
  }
  return { findings, checked: leaves.length + VERCEL_IDENTITY_KEYS.length };
}

export function digestVercelConfig(vercel: VercelConfigInput | null | undefined): string | null {
  if (!vercel) return null;
  return createHash('sha256').update(JSON.stringify(vercel.config)).digest('hex');
}

export function validateSeparation(input: SeparationInput): SeparationReport {
  const environments = input.environments ?? ENVIRONMENTS;
  const other: DeployTarget = input.target === 'staging' ? 'production' : 'staging';
  const findings: SeparationFinding[] = [];
  let checkedFields = 0;
  const workers: { worker: CustomerWorker; workerName: string }[] = [];

  for (const entry of input.workers) {
    const production = productionSection(entry.config);
    const staging = environmentSection(entry.config, 'staging');
    if (!staging) {
      findings.push({
        scope: entry.worker,
        path: 'env.staging',
        reason: 'missing-env-block',
        detail: `${entry.source} has no env.staging block; staging cannot be deployed separately.`,
      });
      continue;
    }
    const targetSection = input.target === 'staging' ? staging : production;
    const otherSection = input.target === 'staging' ? production : staging;
    const workerName = typeof targetSection.name === 'string' ? targetSection.name : '';
    if (!workerName) {
      findings.push({
        scope: entry.worker,
        path: input.target === 'staging' ? 'env.staging.name' : 'name',
        reason: 'placeholder',
        detail: 'worker name is missing; each environment needs an explicit distinct name.',
      });
    }
    workers.push({ worker: entry.worker, workerName });
    const result = compareSections({
      scope: entry.worker,
      target: input.target,
      targetSection,
      otherSection,
    });
    findings.push(...result.findings);
    checkedFields += result.checked;
  }

  if (input.scope !== 'workers') {
    const descriptorResult = compareSections({
      scope: 'environments',
      target: input.target,
      targetSection: environments[input.target] as unknown as Record<string, unknown>,
      otherSection: environments[other] as unknown as Record<string, unknown>,
    });
    findings.push(...descriptorResult.findings);
    checkedFields += descriptorResult.checked;

    if (input.vercel) {
      const vercelResult = checkVercelConfig({
        target: input.target,
        vercel: input.vercel,
        environments,
      });
      findings.push(...vercelResult.findings);
      checkedFields += vercelResult.checked;
    }
  }

  if (input.target === 'staging' && input.processEnv) {
    const productionValues = new Set(
      identityLeaves(environments.production as unknown as Record<string, unknown>).map((leaf) =>
        String(leaf.value),
      ),
    );
    for (const key of TARGET_IDENTITY_ENV_KEYS) {
      const value = input.processEnv[key]?.trim();
      if (!value) continue;
      checkedFields += 1;
      if (productionValues.has(value) || hostsIn(value).some(isProductionHostname)) {
        findings.push({
          scope: 'process.env',
          path: key,
          reason: 'production-identity',
          detail: `${key} resolves to a production identity while validating staging.`,
        });
      }
    }
  }

  return {
    kind: 'separation-validation',
    scope: input.scope ?? 'all',
    target: input.target,
    ok: findings.length === 0,
    findings,
    checkedFields,
    configDigest: digestWorkerConfigs(input.workers),
    vercelConfigDigest: input.scope === 'workers' ? null : digestVercelConfig(input.vercel),
    workers,
    checkedAt: new Date().toISOString(),
  };
}

export function loadWorkerConfigs(rootDir: string): WorkerConfigInput[] {
  return DEPLOYABLE_WORKERS.map((worker) => {
    const source = wranglerConfigPath(rootDir, worker);
    return { worker, config: parseJsonc(readFileSync(source, 'utf8'), source), source };
  });
}

/** Reads vercel.json when present; a missing file is legal (Vercel project defaults). */
export function loadVercelConfig(rootDir: string): VercelConfigInput | null {
  const source = path.join(rootDir, 'vercel.json');
  let raw: string;
  try {
    raw = readFileSync(source, 'utf8');
  } catch {
    return null;
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) throw new Error(`${source}: expected a JSON object at the top level`);
  return { config: parsed, source };
}

export function separationEvidencePath(rootDir: string, target: DeployTarget): string {
  return path.join(rootDir, 'test-results', 'deploy', `separation-${target}.json`);
}

export function formatReport(report: SeparationReport): string {
  const lines = [
    `deploy:validate-separation target=${report.target} fields=${report.checkedFields} digest=${report.configDigest.slice(0, 12)}`,
  ];
  for (const finding of report.findings) {
    lines.push(`  FAIL [${finding.reason}] ${finding.scope}: ${finding.path} -> ${finding.detail}`);
  }
  lines.push(report.ok ? '  OK: no shared identities or placeholders found' : '  RESULT: rejected');
  return lines.join('\n');
}

export function main(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): number {
  const { flags } = parseFlags(argv);
  const target = parseDeployTarget(flagString(flags, 'env'));
  const rootDir = flagString(flags, 'root') ?? process.cwd();
  const report = validateSeparation({
    target,
    scope: flagBoolean(flags, 'workers-only') ? 'workers' : 'all',
    workers: loadWorkerConfigs(rootDir),
    vercel: loadVercelConfig(rootDir),
    processEnv: env,
  });
  const evidencePath = flagString(flags, 'evidence') ?? separationEvidencePath(rootDir, target);
  writeJsonEvidence(evidencePath, report);
  if (flagBoolean(flags, 'json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(report)}\nevidence: ${evidencePath}\n`);
  }
  return report.ok ? 0 : 1;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'validate-separation.ts') {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
