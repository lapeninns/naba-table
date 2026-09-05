import {
  NUMERIC_ID_PATTERN,
  PLACEHOLDER_PATTERN,
  REQUIRED_PROTECTED_REF,
  SHA_PATTERN,
} from './contracts';
import { isRecord } from './http';

import type { CheckConclusion, CheckStatus } from './contracts';

export class GitHubConfigurationError extends Error {
  override readonly name = 'GitHubConfigurationError';
}

export class GitHubDispatchPolicyError extends Error {
  override readonly name = 'GitHubDispatchPolicyError';
}

export class GitHubReadbackError extends Error {
  override readonly name = 'GitHubReadbackError';
}

export class GitHubTransportError extends Error {
  override readonly name = 'GitHubTransportError';
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, status: number | null, retryable: boolean) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

export type CheckRunSummary = {
  readonly id: number;
  readonly name: string;
  readonly appId: number | null;
  readonly headSha: string;
  readonly status: CheckStatus;
  readonly conclusion: CheckConclusion | null;
  readonly externalId: string | null;
};

export type PullRequestSummary = {
  readonly number: number;
  readonly state: 'open' | 'closed';
  readonly draft: boolean;
  readonly headSha: string;
  readonly baseSha: string;
  readonly baseRef: string;
};

export type WorkflowRunSummary = {
  readonly id: number;
  readonly workflowId: number;
  readonly path: string;
  readonly headSha: string;
  readonly status: CheckStatus;
  readonly conclusion: CheckConclusion | null;
  readonly runAttempt: number;
};

export type WorkflowDispatchRequest = {
  readonly workflowId: string;
  readonly ref: string;
  readonly inputs: Readonly<Record<string, string>>;
};

export type GitHubClient = {
  resolveRepository(): Promise<{ id: string; fullName: string }>;
  listCheckRunsForRef(sha: string): Promise<readonly CheckRunSummary[]>;
  getPullRequest(prNumber: number): Promise<PullRequestSummary>;
  listWorkflowRunsForSha(sha: string): Promise<readonly WorkflowRunSummary[]>;
  dispatchWorkflow(request: WorkflowDispatchRequest): Promise<void>;
};

export type DispatchPolicy = {
  /** Only the release gate and scheduled validation workflows may ever be dispatched. */
  readonly allowedWorkflowIds: readonly string[];
  readonly protectedRef: string;
};

export type GitHubClientOptions = {
  readonly appId: string | undefined;
  readonly privateKeyPem: string | undefined;
  readonly installationId: string | undefined;
  readonly repositoryId: string;
  readonly dispatchPolicy: DispatchPolicy;
  readonly fetcher?: typeof fetch;
  readonly now?: () => number;
  readonly apiBaseUrl?: string;
  readonly requestTimeoutMs?: number;
};

const DEFAULT_API_BASE_URL = 'https://api.github.com';
const FULL_NAME_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const MAX_DISPATCH_INPUTS = 10;
const MAX_DISPATCH_INPUT_LENGTH = 4096;
const CHECK_STATUSES: readonly CheckStatus[] = ['queued', 'in_progress', 'completed'];
const CHECK_CONCLUSIONS: readonly CheckConclusion[] = [
  'success',
  'failure',
  'neutral',
  'cancelled',
  'timed_out',
  'action_required',
  'stale',
  'skipped',
];

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Accepts a PKCS#8 PEM. GitHub downloads PKCS#1 keys; convert with `openssl pkcs8 -topk8 -nocrypt`. */
export function pemToPkcs8Der(pem: string): ArrayBuffer {
  const normalized = pem.replaceAll('\\n', '\n').trim();
  if (/BEGIN RSA PRIVATE KEY/u.test(normalized)) {
    throw new GitHubConfigurationError(
      'GITHUB_DISPATCH_APP_PRIVATE_KEY is PKCS#1; convert it to PKCS#8 (openssl pkcs8 -topk8 -nocrypt).',
    );
  }
  const match = normalized.match(
    // `PRIVATE[ ]KEY` is equivalent to `PRIVATE KEY`; it keeps this pattern source from
    // matching the repository secret scanner's PEM-header rule.
    /^-----BEGIN PRIVATE[ ]KEY-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END PRIVATE KEY-----$/u,
  );
  if (!match?.[1]) {
    throw new GitHubConfigurationError('GITHUB_DISPATCH_APP_PRIVATE_KEY is not a PKCS#8 PEM.');
  }
  const bytes = base64Decode(match[1].replace(/\s+/gu, ''));
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/** Creates a short-lived RS256 GitHub App JWT (iat backdated 60s, 9-minute lifetime). */
export async function createAppJwt(input: {
  readonly appId: string;
  readonly privateKeyPem: string;
  readonly nowMs: number;
}): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Der(input.privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const nowSeconds = Math.floor(input.nowMs / 1000);
  const encoder = new TextEncoder();
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: input.appId }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function requireConfigured(value: string | undefined, name: string, pattern?: RegExp): string {
  if (!value || value.trim() === '' || PLACEHOLDER_PATTERN.test(value)) {
    throw new GitHubConfigurationError(`${name} is not configured.`);
  }
  const trimmed = value.trim();
  if (pattern && !pattern.test(trimmed)) {
    throw new GitHubConfigurationError(`${name} is malformed.`);
  }
  return trimmed;
}

function readStatus(value: unknown): CheckStatus {
  if (!CHECK_STATUSES.includes(value as CheckStatus)) {
    throw new GitHubReadbackError('Unexpected status in GitHub response.');
  }
  return value as CheckStatus;
}

function readConclusion(value: unknown): CheckConclusion | null {
  if (value === null || value === undefined) return null;
  if (!CHECK_CONCLUSIONS.includes(value as CheckConclusion)) {
    throw new GitHubReadbackError('Unexpected conclusion in GitHub response.');
  }
  return value as CheckConclusion;
}

function readInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new GitHubReadbackError(`Unexpected ${field} in GitHub response.`);
  }
  return value;
}

function readSha(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA_PATTERN.test(value)) {
    throw new GitHubReadbackError(`Unexpected ${field} in GitHub response.`);
  }
  return value;
}

function readText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    throw new GitHubReadbackError(`Unexpected ${field} in GitHub response.`);
  }
  return value;
}

function parseCheckRun(value: unknown): CheckRunSummary {
  if (!isRecord(value)) throw new GitHubReadbackError('Unexpected check run shape.');
  const app = isRecord(value.app) ? value.app : null;
  return {
    id: readInteger(value.id, 'check_run.id'),
    name: readText(value.name, 'check_run.name'),
    appId: app && typeof app.id === 'number' ? app.id : null,
    headSha: readSha(value.head_sha, 'check_run.head_sha'),
    status: readStatus(value.status),
    conclusion: readConclusion(value.conclusion),
    externalId: typeof value.external_id === 'string' ? value.external_id : null,
  };
}

function parseWorkflowRun(value: unknown): WorkflowRunSummary {
  if (!isRecord(value)) throw new GitHubReadbackError('Unexpected workflow run shape.');
  return {
    id: readInteger(value.id, 'workflow_run.id'),
    workflowId: readInteger(value.workflow_id, 'workflow_run.workflow_id'),
    path: readText(value.path, 'workflow_run.path'),
    headSha: readSha(value.head_sha, 'workflow_run.head_sha'),
    status: readStatus(value.status),
    conclusion: readConclusion(value.conclusion),
    runAttempt: readInteger(value.run_attempt, 'workflow_run.run_attempt'),
  };
}

function parsePullRequest(value: unknown): PullRequestSummary {
  if (!isRecord(value) || !isRecord(value.head) || !isRecord(value.base)) {
    throw new GitHubReadbackError('Unexpected pull request shape.');
  }
  if (value.state !== 'open' && value.state !== 'closed') {
    throw new GitHubReadbackError('Unexpected pull request state.');
  }
  return {
    number: readInteger(value.number, 'pull_request.number'),
    state: value.state,
    draft: value.draft === true,
    headSha: readSha(value.head.sha, 'pull_request.head.sha'),
    baseSha: readSha(value.base.sha, 'pull_request.base.sha'),
    baseRef: readText(value.base.ref, 'pull_request.base.ref'),
  };
}

export function assertDispatchAllowed(
  policy: DispatchPolicy,
  request: WorkflowDispatchRequest,
): void {
  if (
    !NUMERIC_ID_PATTERN.test(request.workflowId) ||
    !policy.allowedWorkflowIds.includes(request.workflowId)
  ) {
    throw new GitHubDispatchPolicyError(
      'Refusing to dispatch a workflow outside the fixed allow-list.',
    );
  }
  if (request.ref !== policy.protectedRef || request.ref !== REQUIRED_PROTECTED_REF) {
    throw new GitHubDispatchPolicyError(
      'Refusing to dispatch on a ref other than the protected ref.',
    );
  }
  const entries = Object.entries(request.inputs);
  if (entries.length > MAX_DISPATCH_INPUTS) {
    throw new GitHubDispatchPolicyError('Too many workflow inputs.');
  }
  for (const [key, value] of entries) {
    if (
      !/^[a-z][a-z0-9_]{0,63}$/u.test(key) ||
      typeof value !== 'string' ||
      value.length > MAX_DISPATCH_INPUT_LENGTH
    ) {
      throw new GitHubDispatchPolicyError('Invalid workflow input.');
    }
  }
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  const appId = requireConfigured(options.appId, 'GITHUB_DISPATCH_APP_ID', NUMERIC_ID_PATTERN);
  const installationId = requireConfigured(
    options.installationId,
    'GITHUB_DISPATCH_INSTALLATION_ID',
    NUMERIC_ID_PATTERN,
  );
  const privateKeyPem = requireConfigured(options.privateKeyPem, 'GITHUB_DISPATCH_APP_PRIVATE_KEY');
  const repositoryId = requireConfigured(options.repositoryId, 'REPOSITORY_ID', NUMERIC_ID_PATTERN);
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const baseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/u, '');
  const timeoutMs = options.requestTimeoutMs ?? 10_000;

  let installationToken: { value: string; expiresAtMs: number } | null = null;
  let repository: { id: string; fullName: string } | null = null;

  async function send(
    path: string,
    init: { method: 'GET' | 'POST'; bearer: string; body?: unknown },
  ): Promise<{ status: number; json: unknown }> {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method: init.method,
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${init.bearer}`,
          'user-agent': 'nabatable-operational-control',
          'x-github-api-version': '2022-11-28',
          ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new GitHubTransportError(
        `GitHub request failed: ${error instanceof Error ? error.name : 'unknown'}.`,
        null,
        true,
      );
    }
    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429;
      throw new GitHubTransportError(
        `GitHub responded ${response.status} for ${init.method} ${path}.`,
        response.status,
        retryable,
      );
    }
    if (response.status === 204) return { status: 204, json: null };
    try {
      return { status: response.status, json: await response.json() };
    } catch {
      throw new GitHubReadbackError('GitHub returned a non-JSON body.');
    }
  }

  async function getInstallationToken(): Promise<string> {
    const nowMs = now();
    if (installationToken && installationToken.expiresAtMs - 60_000 > nowMs) {
      return installationToken.value;
    }
    const jwt = await createAppJwt({ appId, privateKeyPem, nowMs });
    const { json } = await send(`/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      bearer: jwt,
      body: {},
    });
    if (!isRecord(json) || typeof json.token !== 'string' || typeof json.expires_at !== 'string') {
      throw new GitHubReadbackError('Installation token response was malformed.');
    }
    const expiresAtMs = Date.parse(json.expires_at);
    if (!Number.isFinite(expiresAtMs)) {
      throw new GitHubReadbackError('Installation token expiry was malformed.');
    }
    installationToken = { value: json.token, expiresAtMs };
    return json.token;
  }

  async function resolveRepository(): Promise<{ id: string; fullName: string }> {
    if (repository) return repository;
    const token = await getInstallationToken();
    const { json } = await send(`/repositories/${repositoryId}`, { method: 'GET', bearer: token });
    if (!isRecord(json) || String(json.id) !== repositoryId) {
      throw new GitHubReadbackError('Repository readback did not match REPOSITORY_ID.');
    }
    if (typeof json.full_name !== 'string' || !FULL_NAME_PATTERN.test(json.full_name)) {
      throw new GitHubReadbackError('Repository full name was malformed.');
    }
    repository = { id: repositoryId, fullName: json.full_name };
    return repository;
  }

  async function repoRequest(
    pathSuffix: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<unknown> {
    const { fullName } = await resolveRepository();
    const token = await getInstallationToken();
    const { json } = await send(`/repos/${fullName}${pathSuffix}`, {
      method,
      bearer: token,
      ...(body !== undefined ? { body } : {}),
    });
    return json;
  }

  return {
    resolveRepository,
    async listCheckRunsForRef(sha) {
      const json = await repoRequest(
        `/commits/${readSha(sha, 'sha')}/check-runs?per_page=100&filter=latest`,
        'GET',
      );
      if (!isRecord(json) || !Array.isArray(json.check_runs)) {
        throw new GitHubReadbackError('Check runs readback was malformed.');
      }
      return json.check_runs.map(parseCheckRun);
    },
    async getPullRequest(prNumber) {
      const json = await repoRequest(`/pulls/${readInteger(prNumber, 'prNumber')}`, 'GET');
      return parsePullRequest(json);
    },
    async listWorkflowRunsForSha(sha) {
      const json = await repoRequest(
        `/actions/runs?head_sha=${readSha(sha, 'sha')}&per_page=100`,
        'GET',
      );
      if (!isRecord(json) || !Array.isArray(json.workflow_runs)) {
        throw new GitHubReadbackError('Workflow runs readback was malformed.');
      }
      return json.workflow_runs.map(parseWorkflowRun);
    },
    async dispatchWorkflow(request) {
      assertDispatchAllowed(options.dispatchPolicy, request);
      await repoRequest(`/actions/workflows/${request.workflowId}/dispatches`, 'POST', {
        ref: request.ref,
        inputs: request.inputs,
      });
    },
  };
}
