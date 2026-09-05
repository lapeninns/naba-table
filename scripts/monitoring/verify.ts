import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_MONITORING_CONFIG_PATH,
  findMissingAlertRefs,
  listAlertKeys,
  loadMonitoringConfig,
  parseIntervalMs,
} from './config';

import type { MonitoringConfig, MonitoringTarget } from './config';

/**
 * `pnpm ops:verify` — hourly hosted verification of the three monitoring
 * sources: authenticated readiness of every target, GitHub evidence
 * freshness (backup + recovery drill), and the control-plane configuration
 * audit (required workflow files, required checks). Depends only on node
 * built-ins so it runs in the Monitoring environment with `tsx` alone.
 *
 * The heartbeat is emitted only after a fully valid cycle; a stale heartbeat
 * is therefore itself an alert. Output is a redacted JSON summary: no URLs
 * with tokens, no headers, no provider payloads.
 */

export type MonitoringFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type VerifyEnvironment = Readonly<Record<string, string | undefined>>;

export type VerifyDependencies = {
  readonly config: MonitoringConfig;
  readonly env: VerifyEnvironment;
  readonly fetcher: MonitoringFetch;
  readonly now: () => Date;
  /** Checks whether a workflow file exists in the checked-out tree (relative to `.github/workflows`). */
  readonly workflowFileExists: (fileName: string) => boolean;
  readonly alertKeys: ReadonlySet<string>;
  readonly skipHeartbeat?: boolean;
};

export type TargetProbeStatus =
  | 'ok'
  | 'degraded'
  | 'down'
  | 'unauthorized'
  | 'unconfigured'
  | 'invalid'
  | 'timeout'
  | 'error';

export type TargetResult = {
  readonly name: string;
  readonly service: string;
  readonly kind: MonitoringTarget['kind'];
  readonly intervalMs: number;
  readonly status: TargetProbeStatus;
  readonly httpStatus: number | null;
  readonly latencyMs: number | null;
  readonly revision: string | null;
  readonly deploymentId: string | null;
  /** `latencyMs` is null for control-plane checks, which report `ok` booleans without timings. */
  readonly checks: ReadonlyArray<{ name: string; status: string; latencyMs: number | null }>;
};

export type EvidenceFreshness = {
  readonly workflowFile: string;
  readonly status: 'fresh' | 'warning' | 'stale' | 'missing' | 'unknown';
  readonly ageHours: number | null;
  readonly lastSuccessAt: string | null;
};

export type RequiredChecksResult = {
  readonly status: 'ok' | 'missing' | 'unavailable' | 'skipped';
  readonly missingContexts: ReadonlyArray<string>;
};

export type VerifyResult = {
  readonly ok: boolean;
  readonly observedAt: string;
  readonly runtime: MonitoringConfig['runtime'];
  readonly targets: ReadonlyArray<TargetResult>;
  readonly evidence: {
    readonly backup: EvidenceFreshness;
    readonly drill: EvidenceFreshness;
    readonly missingWorkflowFiles: ReadonlyArray<string>;
    readonly missingAlertRefs: ReadonlyArray<string>;
  };
  readonly requiredChecks: RequiredChecksResult;
  readonly heartbeat: { readonly configured: boolean; readonly sent: boolean };
  readonly failures: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
};

const GITHUB_API = 'https://api.github.com';

function resolveBaseUrl(target: MonitoringTarget, env: VerifyEnvironment): string | null {
  const fromEnv = target.baseUrlEnv ? env[target.baseUrlEnv]?.trim() : undefined;
  const candidate = fromEnv && fromEnv.length > 0 ? fromEnv : target.baseUrl;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(Math.max(1, ms));
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

type ReadinessBody = {
  service?: unknown;
  status?: unknown;
  revision?: unknown;
  deploymentId?: unknown;
  checks?: unknown;
};

/**
 * Accepts the shared Worker/web shape (`[{ name, status, latencyMs }]`) and the
 * operational-control shape (`{ <name>: { ok: boolean, ... } }`), normalizing the
 * latter to `ok`/`down` entries without timings. Anything else is `invalid`.
 */
function parseChecks(value: unknown): TargetResult['checks'] | null {
  const checks: Array<{ name: string; status: string; latencyMs: number | null }> = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry !== 'object' || entry === null) return null;
      const record = entry as Record<string, unknown>;
      if (
        typeof record.name !== 'string' ||
        typeof record.status !== 'string' ||
        typeof record.latencyMs !== 'number'
      ) {
        return null;
      }
      checks.push({ name: record.name, status: record.status, latencyMs: record.latencyMs });
    }
    return checks;
  }
  if (typeof value !== 'object' || value === null) return null;
  for (const [name, entry] of Object.entries(value)) {
    if (typeof entry !== 'object' || entry === null) return null;
    const ok = (entry as Record<string, unknown>).ok;
    if (typeof ok !== 'boolean') return null;
    checks.push({ name, status: ok ? 'ok' : 'down', latencyMs: null });
  }
  return checks;
}

export async function probeTarget(
  target: MonitoringTarget,
  deps: Pick<VerifyDependencies, 'config' | 'env' | 'fetcher'>,
  token: string,
): Promise<TargetResult> {
  const intervalMs = parseIntervalMs(deps.config.intervals[target.interval] ?? '5m');
  const base: Omit<TargetResult, 'status' | 'httpStatus' | 'latencyMs'> = {
    name: target.name,
    service: target.service,
    kind: target.kind,
    intervalMs,
    revision: null,
    deploymentId: null,
    checks: [],
  };
  const baseUrl = resolveBaseUrl(target, deps.env);
  if (!baseUrl || !target.readyPath) {
    return { ...base, status: 'unconfigured', httpStatus: null, latencyMs: null };
  }

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await deps.fetcher(`${baseUrl}${target.readyPath}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      redirect: 'manual',
      signal: withTimeout(deps.config.timeouts.readyRequestMs),
    });
  } catch (error) {
    return {
      ...base,
      status: isTimeoutError(error) ? 'timeout' : 'error',
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
    };
  }
  const latencyMs = Date.now() - startedAt;

  if (response.status === 401 || response.status === 403) {
    return { ...base, status: 'unauthorized', httpStatus: response.status, latencyMs };
  }
  if (response.status !== 200 && response.status !== 503) {
    return { ...base, status: 'error', httpStatus: response.status, latencyMs };
  }

  let body: ReadinessBody;
  try {
    body = (await response.json()) as ReadinessBody;
  } catch {
    return { ...base, status: 'invalid', httpStatus: response.status, latencyMs };
  }
  const checks = parseChecks(body.checks);
  if (
    body.service !== target.service ||
    (body.status !== 'ok' && body.status !== 'degraded' && body.status !== 'down') ||
    !checks
  ) {
    return { ...base, status: 'invalid', httpStatus: response.status, latencyMs };
  }

  return {
    ...base,
    // A 503 is "not ready" by definition even when the body says `degraded` (the control-plane
    // Worker answers 503/degraded while its coordinator or evidence bucket is unavailable).
    status: response.status === 503 ? 'down' : body.status,
    httpStatus: response.status,
    latencyMs,
    revision: typeof body.revision === 'string' ? body.revision : null,
    deploymentId: typeof body.deploymentId === 'string' ? body.deploymentId : null,
    checks,
  };
}

type WorkflowRunsBody = {
  workflow_runs?: Array<{ conclusion?: unknown; updated_at?: unknown; run_started_at?: unknown }>;
};

async function fetchLatestSuccessfulRun(
  deps: Pick<VerifyDependencies, 'config' | 'fetcher'>,
  githubToken: string,
  workflowFile: string,
  branch: string,
): Promise<{ status: 'found' | 'missing' | 'unknown'; at: string | null }> {
  const url = `${GITHUB_API}/repos/${deps.config.repository}/actions/workflows/${encodeURIComponent(
    workflowFile,
  )}/runs?status=success&branch=${encodeURIComponent(branch)}&per_page=1`;
  try {
    const response = await deps.fetcher(url, {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${githubToken}`,
        'user-agent': 'nabatable-ops-verify',
        'x-github-api-version': '2022-11-28',
      },
      signal: withTimeout(deps.config.timeouts.githubRequestMs),
    });
    if (response.status === 404) return { status: 'missing', at: null };
    if (!response.ok) return { status: 'unknown', at: null };
    const body = (await response.json()) as WorkflowRunsBody;
    const run = body.workflow_runs?.[0];
    if (!run) return { status: 'missing', at: null };
    const at =
      typeof run.run_started_at === 'string'
        ? run.run_started_at
        : typeof run.updated_at === 'string'
          ? run.updated_at
          : null;
    return at ? { status: 'found', at } : { status: 'unknown', at: null };
  } catch {
    return { status: 'unknown', at: null };
  }
}

export function classifyFreshness(input: {
  readonly workflowFile: string;
  readonly lookup: { status: 'found' | 'missing' | 'unknown'; at: string | null };
  readonly now: Date;
  readonly warningHours: number;
  readonly maxHours: number;
}): EvidenceFreshness {
  if (input.lookup.status !== 'found' || !input.lookup.at) {
    return {
      workflowFile: input.workflowFile,
      status: input.lookup.status === 'missing' ? 'missing' : 'unknown',
      ageHours: null,
      lastSuccessAt: null,
    };
  }
  const atMs = Date.parse(input.lookup.at);
  if (!Number.isFinite(atMs)) {
    return {
      workflowFile: input.workflowFile,
      status: 'unknown',
      ageHours: null,
      lastSuccessAt: null,
    };
  }
  const ageHours = Math.max(0, (input.now.getTime() - atMs) / 3_600_000);
  const status: EvidenceFreshness['status'] =
    ageHours > input.maxHours ? 'stale' : ageHours > input.warningHours ? 'warning' : 'fresh';
  return {
    workflowFile: input.workflowFile,
    status,
    ageHours: Math.round(ageHours * 100) / 100,
    lastSuccessAt: input.lookup.at,
  };
}

type ProtectionBody = {
  contexts?: unknown;
  checks?: Array<{ context?: unknown }>;
};

async function verifyRequiredChecks(
  deps: Pick<VerifyDependencies, 'config' | 'fetcher'>,
  githubToken: string,
): Promise<RequiredChecksResult> {
  const { branch, contexts } = deps.config.requiredChecks;
  if (contexts.length === 0) return { status: 'skipped', missingContexts: [] };
  const url = `${GITHUB_API}/repos/${deps.config.repository}/branches/${encodeURIComponent(
    branch,
  )}/protection/required_status_checks`;
  let body: ProtectionBody;
  try {
    const response = await deps.fetcher(url, {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${githubToken}`,
        'user-agent': 'nabatable-ops-verify',
        'x-github-api-version': '2022-11-28',
      },
      signal: withTimeout(deps.config.timeouts.githubRequestMs),
    });
    if (!response.ok) return { status: 'unavailable', missingContexts: [...contexts] };
    body = (await response.json()) as ProtectionBody;
  } catch {
    return { status: 'unavailable', missingContexts: [...contexts] };
  }
  const configured = new Set<string>();
  if (Array.isArray(body.contexts)) {
    for (const context of body.contexts) if (typeof context === 'string') configured.add(context);
  }
  for (const check of body.checks ?? []) {
    if (typeof check.context === 'string') configured.add(check.context);
  }
  const missingContexts = contexts.filter((context) => !configured.has(context));
  return { status: missingContexts.length === 0 ? 'ok' : 'missing', missingContexts };
}

async function sendHeartbeat(
  deps: Pick<VerifyDependencies, 'config' | 'env' | 'fetcher'>,
): Promise<{ configured: boolean; sent: boolean }> {
  const raw = deps.env[deps.config.heartbeat.urlEnv]?.trim();
  if (!raw) return { configured: false, sent: false };
  let url: URL;
  try {
    url = new URL(raw);
    if (url.protocol !== 'https:') return { configured: false, sent: false };
  } catch {
    return { configured: false, sent: false };
  }
  try {
    const response = await deps.fetcher(url.toString(), {
      method: 'GET',
      headers: { 'user-agent': 'nabatable-ops-verify' },
      redirect: 'manual',
      signal: withTimeout(deps.config.timeouts.heartbeatRequestMs),
    });
    return { configured: true, sent: response.ok };
  } catch {
    return { configured: true, sent: false };
  }
}

export async function runMonitoringVerification(deps: VerifyDependencies): Promise<VerifyResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const now = deps.now();
  const { config } = deps;

  const missingAlertRefs = findMissingAlertRefs(config, deps.alertKeys);
  for (const ref of missingAlertRefs) failures.push(`threshold references unknown alert: ${ref}`);

  const missingWorkflowFiles = config.evidence.requiredWorkflowFiles.filter(
    (file) => !deps.workflowFileExists(file),
  );
  for (const file of missingWorkflowFiles) failures.push(`required workflow file missing: ${file}`);

  const token = deps.env[config.auth.tokenEnv]?.trim() ?? '';
  const httpTargets = config.targets.filter((target) => target.kind !== 'github');
  let targets: TargetResult[] = [];
  if (token.length === 0) {
    failures.push(`${config.auth.tokenEnv} is not configured; refusing to probe readiness`);
    targets = httpTargets.map((target) => ({
      name: target.name,
      service: target.service,
      kind: target.kind,
      intervalMs: parseIntervalMs(config.intervals[target.interval] ?? '5m'),
      status: 'unconfigured',
      httpStatus: null,
      latencyMs: null,
      revision: null,
      deploymentId: null,
      checks: [],
    }));
  } else {
    targets = await Promise.all(httpTargets.map((target) => probeTarget(target, deps, token)));
  }
  for (const target of targets) {
    if (target.status === 'ok') continue;
    if (target.status === 'degraded') {
      warnings.push(`target ${target.name} is degraded`);
      continue;
    }
    failures.push(`target ${target.name} readiness ${target.status}`);
  }

  const githubToken = deps.env[config.auth.githubTokenEnv]?.trim() ?? '';
  let backup: EvidenceFreshness;
  let drill: EvidenceFreshness;
  let requiredChecks: RequiredChecksResult;
  if (githubToken.length === 0) {
    failures.push(`${config.auth.githubTokenEnv} is not configured; evidence freshness is unknown`);
    backup = {
      workflowFile: config.evidence.backup.workflowFile,
      status: 'unknown',
      ageHours: null,
      lastSuccessAt: null,
    };
    drill = {
      workflowFile: config.evidence.drill.workflowFile,
      status: 'unknown',
      ageHours: null,
      lastSuccessAt: null,
    };
    requiredChecks = {
      status: 'unavailable',
      missingContexts: [...config.requiredChecks.contexts],
    };
  } else {
    const branch = config.requiredChecks.branch;
    const [backupLookup, drillLookup, checks] = await Promise.all([
      fetchLatestSuccessfulRun(deps, githubToken, config.evidence.backup.workflowFile, branch),
      fetchLatestSuccessfulRun(deps, githubToken, config.evidence.drill.workflowFile, branch),
      verifyRequiredChecks(deps, githubToken),
    ]);
    backup = classifyFreshness({
      workflowFile: config.evidence.backup.workflowFile,
      lookup: backupLookup,
      now,
      warningHours: config.evidence.backup.warningHours,
      maxHours: config.evidence.backup.maxHours,
    });
    drill = classifyFreshness({
      workflowFile: config.evidence.drill.workflowFile,
      lookup: drillLookup,
      now,
      warningHours: config.evidence.drill.warningDays * 24,
      maxHours: config.evidence.drill.blockDays * 24,
    });
    requiredChecks = checks;
  }

  for (const [label, freshness] of [
    ['backup', backup],
    ['drill', drill],
  ] as const) {
    if (freshness.status === 'fresh') continue;
    if (freshness.status === 'warning') {
      warnings.push(`${label} evidence is approaching its limit (${freshness.ageHours}h old)`);
      continue;
    }
    failures.push(`${label} evidence is ${freshness.status}`);
  }

  if (requiredChecks.status === 'missing') {
    failures.push(`required checks missing: ${requiredChecks.missingContexts.join(', ')}`);
  } else if (requiredChecks.status === 'unavailable') {
    (config.requiredChecks.enforce ? failures : warnings).push(
      'required checks configuration could not be read',
    );
  }

  const ok = failures.length === 0;
  let heartbeat = { configured: Boolean(deps.env[config.heartbeat.urlEnv]?.trim()), sent: false };
  if (ok && !deps.skipHeartbeat) {
    heartbeat = await sendHeartbeat(deps);
    if (!heartbeat.configured) warnings.push('heartbeat URL is not configured');
    else if (!heartbeat.sent) warnings.push('heartbeat delivery failed');
  }

  return {
    ok,
    observedAt: now.toISOString(),
    runtime: config.runtime,
    targets,
    evidence: { backup, drill, missingWorkflowFiles, missingAlertRefs },
    requiredChecks,
    heartbeat,
    failures,
    warnings,
  };
}

export type VerifyCliOptions = {
  readonly configPath: string;
  readonly alertsPath: string;
  readonly workflowsDir: string;
  readonly skipHeartbeat: boolean;
};

export function parseVerifyArgs(argv: ReadonlyArray<string>): VerifyCliOptions {
  const options = {
    configPath: DEFAULT_MONITORING_CONFIG_PATH,
    alertsPath: path.join('config', 'observability', 'alerts.yaml'),
    workflowsDir: path.join('.github', 'workflows'),
    skipHeartbeat: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--config' && next) {
      options.configPath = next;
      index += 1;
    } else if (arg === '--alerts' && next) {
      options.alertsPath = next;
      index += 1;
    } else if (arg === '--workflows-dir' && next) {
      options.workflowsDir = next;
      index += 1;
    } else if (arg === '--skip-heartbeat') {
      options.skipHeartbeat = true;
    } else if (arg === '--json') {
      // JSON is the only output format; accepted for symmetry with other ci:* commands.
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const options = parseVerifyArgs(argv);
  const config = loadMonitoringConfig(options.configPath);
  const alertKeys = listAlertKeys(readFileSync(options.alertsPath, 'utf8'));
  const result = await runMonitoringVerification({
    config,
    env: process.env,
    fetcher: (url, init) => fetch(url, init),
    now: () => new Date(),
    workflowFileExists: (fileName) => existsSync(path.join(options.workflowsDir, fileName)),
    alertKeys,
    skipHeartbeat: options.skipHeartbeat,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    });
}
