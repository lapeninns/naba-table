import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { observePostDeployment, requestPostDeployJson } from '../../cloudflare/shared/post-deploy';
import type { Service, Diagnostic } from '../../cloudflare/shared/post-deploy';

import { loadMonitoringConfig } from './config';
import type { MonitoringConfig } from './config';

/** Read-only Option A evidence. Never deploys, sends heartbeats, or evaluates backup freshness. */
type Environment = Readonly<Record<string, string | undefined>>;
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type PostDeployDependencies = {
  config: MonitoringConfig;
  env: Environment;
  fetcher: Fetcher;
  event?: unknown;
};
const REPOSITORY = 'lapeninns/nabatable';
const REPOSITORY_ID = '1105219228';
const BRANCH_URL = `https://api.github.com/repos/${REPOSITORY}/branches/main`;
const SERVICES = [
  { name: 'web', service: 'nabatable-web', kind: 'web', readyPath: '/api/ready' },
  {
    name: 'booking-short-links',
    service: 'booking-short-links',
    kind: 'worker',
    readyPath: '/ready',
  },
  {
    name: 'email-queue-gateway',
    service: 'email-queue-gateway',
    kind: 'worker',
    readyPath: '/ready',
  },
  {
    name: 'sms-summary-gateway',
    service: 'sms-summary-gateway',
    kind: 'worker',
    readyPath: '/ready',
  },
] as const;
export type PostDeployResult = {
  ok: boolean;
  observedAt: string;
  expectedSha: string | null;
  observedMainSha: string | null;
  targets: Array<{ service: Service; status: Diagnostic; observedSha: string | null }>;
  failures: Diagnostic[];
};
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function fullSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
}

/**
 * Live Vercel deployment events mark Production with production_environment:false and SHA refs.
 * Use protected-main push/schedule/dispatch identity instead; no event URL is ever consumed.
 */
export function validatePostDeployEvent(
  name: string | undefined,
  event: unknown,
  env: Environment,
  expectedSha: string,
): boolean {
  if (
    env.GITHUB_REPOSITORY_ID !== REPOSITORY_ID ||
    env.GITHUB_REF !== 'refs/heads/main' ||
    !fullSha(expectedSha)
  )
    return false;
  if (name === 'workflow_dispatch' || name === 'schedule') return true;
  if (name !== 'push') return false;
  const root = record(event);
  const repository = record(root.repository);
  return (
    repository.id === Number(REPOSITORY_ID) &&
    repository.full_name === REPOSITORY &&
    root.ref === 'refs/heads/main' &&
    fullSha(root.after) &&
    root.after === env.GITHUB_SHA &&
    root.after === expectedSha
  );
}

function targets(
  config: MonitoringConfig,
  env: Environment,
): Array<{ service: Service; url: string }> | null {
  if (
    config.repository !== REPOSITORY ||
    config.auth.tokenEnv !== 'MONITORING_TOKEN' ||
    config.auth.githubTokenEnv !== 'MONITORING_GITHUB_TOKEN'
  )
    return null;
  const resolved: Array<{ service: Service; url: string }> = [];
  for (const expected of SERVICES) {
    const matches = config.targets.filter((t) => t.name === expected.name);
    const target = matches[0];
    if (
      matches.length !== 1 ||
      !target ||
      target.service !== expected.service ||
      target.kind !== expected.kind ||
      target.readyPath !== expected.readyPath
    )
      return null;
    const raw =
      target.baseUrl ??
      (target.name === 'email-queue-gateway'
        ? env.MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL
        : undefined);
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/' ||
        raw.includes('?') ||
        raw.includes('#')
      )
        return null;
      resolved.push({ service: expected.service, url: `${url.origin}${expected.readyPath}` });
    } catch {
      return null;
    }
  }
  return resolved;
}

async function mainSha(deps: PostDeployDependencies, token: string): Promise<string | null> {
  const response = await requestPostDeployJson(
    deps.fetcher,
    BRANCH_URL,
    token,
    deps.config.timeouts.githubRequestMs,
  );
  const body = record(response?.body);
  const sha = record(body.commit).sha;
  return response?.status === 200 && body.name === 'main' && body.protected === true && fullSha(sha)
    ? sha
    : null;
}

export async function runPostDeployVerification(
  deps: PostDeployDependencies,
): Promise<PostDeployResult> {
  const result: PostDeployResult = {
    ok: false,
    observedAt: new Date().toISOString(),
    expectedSha: null,
    observedMainSha: null,
    targets: [],
    failures: [],
  };
  const fail = (diagnostic: Diagnostic) => {
    result.failures.push(diagnostic);
    return result;
  };
  const token = deps.env.MONITORING_TOKEN?.trim();
  const githubToken = deps.env.MONITORING_GITHUB_TOKEN?.trim();
  if (!token || !githubToken) return fail('missing_token');
  const resolved = targets(deps.config, deps.env);
  if (
    !resolved ||
    ![deps.config.timeouts.readyRequestMs, deps.config.timeouts.githubRequestMs].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    return fail('invalid_config');
  // Reject event identity before transmitting either credential, then bind the event to live main below.
  const provisionalSha =
    deps.env.GITHUB_EVENT_NAME === 'push' ? record(deps.event).after : '0'.repeat(40);
  if (
    !fullSha(provisionalSha) ||
    !validatePostDeployEvent(deps.env.GITHUB_EVENT_NAME, deps.event, deps.env, provisionalSha)
  )
    return fail('untrusted_event');
  const expected = await mainSha(deps, githubToken);
  result.expectedSha = expected;
  if (!expected) return fail('main_unavailable');
  if (!validatePostDeployEvent(deps.env.GITHUB_EVENT_NAME, deps.event, deps.env, expected))
    return fail('untrusted_event');
  const observation = await observePostDeployment({
    expectedRepository: REPOSITORY,
    expectedSha: expected,
    targets: resolved,
    token,
    fetcher: deps.fetcher,
    timeoutMs: deps.config.timeouts.readyRequestMs,
  });
  result.targets = observation.targets;
  result.failures = observation.failures;
  result.observedMainSha = await mainSha(deps, githubToken);
  if (!result.observedMainSha) return fail('main_unavailable');
  if (result.observedMainSha !== expected) return fail('main_changed');
  result.ok = result.failures.length === 0;
  return result;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.some((arg) => arg !== '--json')) throw new Error('invalid_arguments');
  const event: unknown =
    process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_EVENT_PATH
      ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      : undefined;
  const result = await runPostDeployVerification({
    config: loadMonitoringConfig(),
    env: process.env,
    event,
    fetcher: (url, init) => fetch(url, init),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      process.stderr.write('{"ok":false,"failures":["invalid_config"]}\n');
      process.exitCode = 2;
    });
}
