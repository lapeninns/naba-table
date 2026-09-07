import { NUMERIC_ID_PATTERN, PLACEHOLDER_PATTERN, SHA_PATTERN } from './contracts';
import { createAppJwt } from './github';
import { isBearerAuthorized, isRecord, json, withTimeout } from './http';
import { observePostDeployment, requestPostDeployJson } from '../../shared/post-deploy';

import type { OperationalControlEnv, EvidenceBucket } from './contracts';
import type { ObservationResult } from '../../shared/post-deploy';

export const PRODUCTION_TARGETS = [
  { service: 'nabatable-web', url: 'https://app.nabatable.com/api/ready' },
  { service: 'booking-short-links', url: 'https://go.nabatable.com/ready' },
  {
    service: 'email-queue-gateway',
    url: 'https://nabatable-email-queue-gateway.amanshresthaaaaa.workers.dev/ready',
  },
  {
    service: 'sms-summary-gateway',
    url: 'https://nabatable-sms-summary-gateway.amanshresthaaaaa.workers.dev/ready',
  },
] as const;
export const DEPLOYMENT_LATEST_KEY = 'post-deploy/v1/latest.json';
const MAX_AGE_MS = 75 * 60_000;
const TIMEOUT_MS = 5_000;
const MAX_EVIDENCE_BYTES = 16 * 1024;
const REPOSITORY = 'lapeninns/nabatable';
const REPOSITORY_ID = 1105219228;
const FAILURES = [
  'missing_token',
  'invalid_config',
  'untrusted_event',
  'main_unavailable',
  'main_changed',
  'request_failed',
  'http_error',
  'invalid_readiness',
  'revision_mismatch',
  'github_jwt_failed',
  'github_token_mint_failed',
  'github_token_absent',
  'invalid_token_scope',
  'github_observation_failed',
  'github_token_revoke_failed',
] as const;
type Failure = (typeof FAILURES)[number];
export type DeploymentEvidence = Omit<ObservationResult, 'failures'> & {
  schemaVersion: 1;
  repository: typeof REPOSITORY;
  environment: 'production';
  scheduledAt: string;
  failures: Failure[];
};

function configured(value: string | undefined): value is string {
  return !!value?.trim() && !PLACEHOLDER_PATTERN.test(value);
}
function enabled(env: OperationalControlEnv): boolean {
  return env.POST_DEPLOY_OBSERVER_ENABLED === 'true' && env.DEPLOYMENT_ENVIRONMENT === 'production';
}
function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join(',') === [...expected].sort().join(',');
}
function validEvidenceTargets(
  targets: unknown,
  expectedSha: unknown,
): targets is ObservationResult['targets'] {
  if (!Array.isArray(targets) || targets.length !== PRODUCTION_TARGETS.length) return false;
  const services = new Set<string>();
  for (const target of targets as unknown[]) {
    if (!isRecord(target) || !keys(target, ['service', 'status', 'observedSha'])) return false;
    if (
      !PRODUCTION_TARGETS.some((item) => item.service === target.service) ||
      typeof target.service !== 'string' ||
      services.has(target.service)
    )
      return false;
    services.add(target.service);
    if (
      target.status !== 'ok' &&
      !['request_failed', 'http_error', 'invalid_readiness', 'revision_mismatch'].includes(
        String(target.status),
      )
    )
      return false;
    if (
      target.observedSha !== null &&
      (typeof target.observedSha !== 'string' || !SHA_PATTERN.test(target.observedSha))
    )
      return false;
    if (target.status === 'ok' && (!expectedSha || target.observedSha !== expectedSha))
      return false;
  }
  return true;
}

function isoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

/** Validate storage as untrusted input; never return arbitrary provider or stored fields. */
export function validDeploymentEvidence(value: unknown): value is DeploymentEvidence {
  if (
    !isRecord(value) ||
    !keys(value, [
      'schemaVersion',
      'repository',
      'environment',
      'scheduledAt',
      'observedAt',
      'expectedSha',
      'ok',
      'targets',
      'failures',
    ])
  )
    return false;
  if (
    value.schemaVersion !== 1 ||
    value.repository !== REPOSITORY ||
    value.environment !== 'production' ||
    typeof value.ok !== 'boolean'
  )
    return false;
  if (!isoTimestamp(value.observedAt) || !isoTimestamp(value.scheduledAt)) return false;
  if (Date.parse(value.scheduledAt) > Date.parse(value.observedAt)) return false;
  if (
    value.expectedSha !== null &&
    (typeof value.expectedSha !== 'string' || !SHA_PATTERN.test(value.expectedSha))
  )
    return false;
  if (
    !Array.isArray(value.failures) ||
    value.failures.length > FAILURES.length ||
    value.failures.some((failure: unknown) => !FAILURES.includes(failure as Failure))
  )
    return false;
  if (!validEvidenceTargets(value.targets, value.expectedSha)) return false;
  const allHealthy = value.targets.every((target: { status: string }) => target.status === 'ok');
  return value.ok === (value.failures.length === 0 && allHealthy && value.expectedSha !== null);
}

async function readEvidence(
  bucket: EvidenceBucket,
): Promise<{ evidence: DeploymentEvidence; etag: string } | null> {
  const object = await withTimeout(bucket.get(DEPLOYMENT_LATEST_KEY), TIMEOUT_MS, 'evidence read');
  if (!object) return null;
  if (!object.etag || object.size === undefined || object.size > MAX_EVIDENCE_BYTES)
    throw new Error('invalid_evidence');
  const body = await withTimeout(object.text(), TIMEOUT_MS, 'evidence body');
  if (new TextEncoder().encode(body).byteLength > MAX_EVIDENCE_BYTES)
    throw new Error('invalid_evidence');
  const evidence: unknown = JSON.parse(body);
  if (!validDeploymentEvidence(evidence)) throw new Error('invalid_evidence');
  return { evidence, etag: object.etag };
}

/** History is immutable per invocation. Latest uses R2 conditional writes to defeat completion races. */
export async function writeDeploymentEvidence(
  bucket: EvidenceBucket,
  evidence: DeploymentEvidence,
): Promise<void> {
  if (!validDeploymentEvidence(evidence)) throw new Error('invalid_evidence');
  const body = JSON.stringify(evidence);
  await withTimeout(
    bucket.put(`post-deploy/v1/history/${evidence.scheduledAt}/${crypto.randomUUID()}.json`, body, {
      httpMetadata: { contentType: 'application/json' },
    }),
    TIMEOUT_MS,
    'evidence history',
  );
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readEvidence(bucket);
    if (current && Date.parse(current.evidence.scheduledAt) >= Date.parse(evidence.scheduledAt))
      return;
    const written = await withTimeout(
      bucket.put(DEPLOYMENT_LATEST_KEY, body, {
        httpMetadata: { contentType: 'application/json' },
        onlyIf: current ? { etagMatches: current.etag } : { etagDoesNotMatch: '*' },
      }),
      TIMEOUT_MS,
      'evidence latest',
    );
    if (written !== null) return;
  }
  throw new Error('evidence_write_conflict');
}

/** Only this client may mint observation tokens. It does not expose dispatch or mutation APIs. */
async function githubRequest(
  fetcher: typeof fetch,
  path: string,
  bearer: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<unknown> {
  const expectedStatus = method === 'POST' ? 201 : method === 'DELETE' ? 204 : 200;
  const response = await requestPostDeployJson(
    async (url, init) => {
      const result = await fetcher(url, {
        ...init,
        method,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (result.status !== expectedStatus || result.redirected)
        return new Response(null, { status: 502 });
      // The shared reader provides streaming limits and one deadline for headers and body.
      return new Response(method === 'DELETE' ? '{}' : result.body, {
        status: 200,
        headers: result.headers,
      });
    },
    `https://api.github.com${path}`,
    bearer,
    TIMEOUT_MS,
  );
  if (!response || response.status !== 200) throw new Error('github_request_failed');
  return response.body;
}
async function mainSha(fetcher: typeof fetch, token: string): Promise<string> {
  const branch = await githubRequest(fetcher, `/repos/${REPOSITORY}/branches/main`, token, 'GET');
  if (
    !isRecord(branch) ||
    branch.name !== 'main' ||
    branch.protected !== true ||
    !isRecord(branch.commit) ||
    typeof branch.commit.sha !== 'string' ||
    !SHA_PATTERN.test(branch.commit.sha)
  )
    throw new Error('invalid_main');
  return branch.commit.sha;
}

function validMintedScope(minted: unknown, nowMs: number): boolean {
  if (
    !isRecord(minted) ||
    !isRecord(minted.permissions) ||
    minted.permissions.contents !== 'read' ||
    Object.entries(minted.permissions).some(
      ([name, permission]) => !['contents', 'metadata'].includes(name) || permission !== 'read',
    ) ||
    !Array.isArray(minted.repositories) ||
    minted.repositories.length !== 1 ||
    !isRecord(minted.repositories[0]) ||
    minted.repositories[0].id !== REPOSITORY_ID ||
    minted.repositories[0].full_name !== REPOSITORY ||
    typeof minted.expires_at !== 'string' ||
    !(Date.parse(minted.expires_at) > nowMs) ||
    Date.parse(minted.expires_at) > nowMs + 65 * 60_000
  )
    return false;
  return true;
}

// Each observation step throws a fixed marker so a failed run records which step failed.
// Only these enum values are stored: no error text, URL, header or credential reaches the evidence,
// and anything unrecognised still falls back to the original generic reason.
const OBSERVATION_FAILURES = new Map<string, Failure>([
  ['invalid_config', 'invalid_config'],
  ['github_jwt_failed', 'github_jwt_failed'],
  ['github_token_mint_failed', 'github_token_mint_failed'],
  ['github_token_absent', 'github_token_absent'],
  ['invalid_token_scope', 'invalid_token_scope'],
  ['main_unavailable', 'main_unavailable'],
]);
function observationFailure(error: unknown): Failure {
  return (
    (error instanceof Error ? OBSERVATION_FAILURES.get(error.message) : undefined) ??
    'github_observation_failed'
  );
}

export async function runDeploymentObservation(input: {
  env: OperationalControlEnv;
  scheduledTime: number;
  now?: () => number;
  fetcher?: typeof fetch;
}): Promise<void> {
  const { env, scheduledTime } = input;
  // Cron timestamps can include seconds; eligibility follows the intended UTC minute.
  if (
    !enabled(env) ||
    !Number.isFinite(scheduledTime) ||
    new Date(scheduledTime).getUTCMinutes() !== 0
  )
    return;
  const now = input.now ?? Date.now;
  const fetcher = input.fetcher ?? fetch;
  const evidence: DeploymentEvidence = {
    schemaVersion: 1,
    repository: REPOSITORY,
    environment: 'production',
    scheduledAt: new Date(scheduledTime).toISOString(),
    observedAt: new Date(now()).toISOString(),
    ok: false,
    expectedSha: null,
    targets: PRODUCTION_TARGETS.map(({ service }) => ({
      service,
      status: 'request_failed',
      observedSha: null,
    })),
    failures: [],
  };
  let token: string | undefined;
  try {
    if (
      !env.EVIDENCE_BUCKET ||
      env.REPOSITORY_ID !== String(REPOSITORY_ID) ||
      env.PROTECTED_REF !== 'refs/heads/main' ||
      !configured(env.MONITORING_TOKEN) ||
      env.MONITORING_TOKEN.length < 16 ||
      !configured(env.GITHUB_DISPATCH_APP_ID) ||
      !NUMERIC_ID_PATTERN.test(env.GITHUB_DISPATCH_APP_ID) ||
      !configured(env.GITHUB_DISPATCH_INSTALLATION_ID) ||
      !NUMERIC_ID_PATTERN.test(env.GITHUB_DISPATCH_INSTALLATION_ID) ||
      !configured(env.GITHUB_DISPATCH_APP_PRIVATE_KEY)
    )
      throw new Error('invalid_config');
    const jwt = await createAppJwt({
      appId: env.GITHUB_DISPATCH_APP_ID,
      privateKeyPem: env.GITHUB_DISPATCH_APP_PRIVATE_KEY,
      nowMs: now(),
    }).catch(() => {
      throw new Error('github_jwt_failed');
    });
    const minted = await githubRequest(
      fetcher,
      `/app/installations/${env.GITHUB_DISPATCH_INSTALLATION_ID}/access_tokens`,
      jwt,
      'POST',
      {
        repository_ids: [REPOSITORY_ID],
        permissions: { contents: 'read' },
      },
    ).catch(() => {
      throw new Error('github_token_mint_failed');
    });
    // Capture the token before validating scope so even rejected credentials are revoked.
    if (isRecord(minted) && typeof minted.token === 'string' && minted.token.trim())
      token = minted.token;
    // Distinct from the shared missing_token diagnostic, which reports an absent monitoring token.
    if (!token) throw new Error('github_token_absent');
    if (!validMintedScope(minted, now())) throw new Error('invalid_token_scope');
    // Only the first read is attributed here; a failed readback below stays generic so the two
    // protected-main reads remain distinguishable.
    evidence.expectedSha = await mainSha(fetcher, token).catch(() => {
      throw new Error('main_unavailable');
    });
    const result = await observePostDeployment({
      expectedRepository: REPOSITORY,
      expectedSha: evidence.expectedSha,
      targets: PRODUCTION_TARGETS,
      token: env.MONITORING_TOKEN,
      fetcher,
      timeoutMs: TIMEOUT_MS,
    });
    evidence.targets = result.targets;
    evidence.failures = result.failures.filter((failure) => failure !== 'ok');
    if ((await mainSha(fetcher, token)) !== evidence.expectedSha)
      evidence.failures.push('main_changed');
  } catch (error) {
    evidence.failures.push(observationFailure(error));
  } finally {
    if (token) {
      try {
        await githubRequest(fetcher, '/installation/token', token, 'DELETE');
      } catch {
        evidence.failures.push('github_token_revoke_failed');
      }
    }
  }
  evidence.observedAt = new Date(now()).toISOString();
  evidence.ok =
    evidence.failures.length === 0 && evidence.targets.every((target) => target.status === 'ok');
  if (env.EVIDENCE_BUCKET) await writeDeploymentEvidence(env.EVIDENCE_BUCKET, evidence);
}

export async function handleDeploymentVerification(
  request: Request,
  env: OperationalControlEnv,
  now = Date.now(),
): Promise<Response> {
  if (!isBearerAuthorized(request, env.MONITORING_TOKEN))
    return json({ error: 'Unauthorized' }, { status: 401 });
  if (!enabled(env) || !env.EVIDENCE_BUCKET)
    return json({ status: 'unavailable', cached: true }, { status: 503 });
  try {
    const cached = await readEvidence(env.EVIDENCE_BUCKET);
    if (!cached) return json({ status: 'unavailable', cached: true }, { status: 503 });
    const ageMs = now - Date.parse(cached.evidence.observedAt);
    if (
      ageMs < 0 ||
      ageMs > MAX_AGE_MS ||
      now - Date.parse(cached.evidence.scheduledAt) > MAX_AGE_MS
    )
      return json({ status: 'stale', cached: true }, { status: 503 });
    return json(
      {
        status: cached.evidence.ok ? 'ok' : 'failed',
        cached: true,
        ageSeconds: Math.floor(ageMs / 1000),
        evidence: cached.evidence,
      },
      { status: cached.evidence.ok ? 200 : 503 },
    );
  } catch {
    return json({ status: 'unavailable', cached: true }, { status: 503 });
  }
}
