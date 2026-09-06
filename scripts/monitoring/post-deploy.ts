import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

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
const REQUIRED_CHECKS = {
  'nabatable-web': ['database', 'storage', 'email-gateway'],
  'booking-short-links': ['d1', 'kv-cache'],
  'email-queue-gateway': ['email-queue-state', 'capacity-version-state'],
  'sms-summary-gateway': ['daily-summary-queue', 'daily-summary-state'],
} as const;
const MAX_RESPONSE_BYTES = 64 * 1024;
type Service = (typeof SERVICES)[number]['service'];
type Diagnostic =
  | 'ok'
  | 'missing_token'
  | 'invalid_config'
  | 'untrusted_event'
  | 'main_unavailable'
  | 'main_changed'
  | 'request_failed'
  | 'http_error'
  | 'invalid_readiness'
  | 'revision_mismatch';
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

function validChecks(value: unknown, service: Service): boolean {
  if (!Array.isArray(value)) return false;
  const names = new Set<string>();
  for (const entry of value) {
    const check = record(entry);
    if (
      typeof check.name !== 'string' ||
      !check.name.trim() ||
      check.status !== 'ok' ||
      names.has(check.name)
    )
      return false;
    names.add(check.name);
  }
  return REQUIRED_CHECKS[service].every((name) => names.has(name));
}

async function request(
  deps: PostDeployDependencies,
  url: string,
  token: string,
  timeout: number,
): Promise<{ status: number; body: unknown } | null> {
  // The timeout covers response headers AND body consumption, including injected fetchers in tests.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await deps.fetcher(url, {
          method: 'GET',
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/json',
            'cache-control': 'no-cache',
            'user-agent': 'nabatable-post-deploy',
            'x-github-api-version': '2022-11-28',
          },
        });
        if (response.status !== 200 || response.redirected)
          return { status: response.redirected ? 302 : response.status, body: null };
        const length = response.headers.get('content-length');
        if (length !== null && (!/^\d+$/u.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
          controller.abort();
          void response.body?.cancel().catch(() => {});
          return null;
        }
        if (!response.body) return null;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.byteLength;
            if (size > MAX_RESPONSE_BYTES) {
              controller.abort();
              void reader.cancel().catch(() => {});
              return null;
            }
            chunks.push(next.value);
          }
        } finally {
          reader.releaseLock();
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return {
          status: response.status,
          body: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown,
        };
      })(),
      new Promise<null>((resolve) => {
        timer = setTimeout(
          () => {
            controller.abort();
            resolve(null);
          },
          Math.min(30_000, Math.max(1, timeout)),
        );
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function mainSha(deps: PostDeployDependencies, token: string): Promise<string | null> {
  const response = await request(deps, BRANCH_URL, token, deps.config.timeouts.githubRequestMs);
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
  result.targets = await Promise.all(
    resolved.map(async (target) => {
      const response = await request(deps, target.url, token, deps.config.timeouts.readyRequestMs);
      const body = record(response?.body);
      const observedSha = fullSha(body.revision) ? body.revision : null;
      let status: Diagnostic = 'ok';
      if (!response) status = 'request_failed';
      else if (response.status !== 200) status = 'http_error';
      else if (
        body.service !== target.service ||
        body.status !== 'ok' ||
        !validChecks(body.checks, target.service)
      )
        status = 'invalid_readiness';
      else if (observedSha !== expected) status = 'revision_mismatch';
      return { service: target.service, status, observedSha };
    }),
  );
  for (const target of result.targets)
    if (target.status !== 'ok' && !result.failures.includes(target.status))
      result.failures.push(target.status);
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
