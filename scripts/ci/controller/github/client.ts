import { type KeyObject } from 'node:crypto';

import { createAppJwt, parsePrivateKey } from './jwt';
import { createSilentLogger, type ControllerLogger } from '../log';
import { LOCAL_CI_APP_SLUG, isGitSha } from '../types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GitHubAppCredentials {
  readonly appId: number;
  readonly installationId: number;
  readonly privateKeyPem: string;
}

export interface GitHubAppIdentity {
  /** The App id the operator configured for `nabatable-local-ci`. */
  readonly localAppId: number;
  readonly appSlug?: string;
}

export interface GitHubClientOptions {
  readonly credentials: GitHubAppCredentials;
  readonly identity: GitHubAppIdentity;
  /** Numeric repository id; every request is bound to it. */
  readonly repositoryId: number;
  /**
   * Optional `owner/repo`. When present it must match what GitHub reports for
   * `repositoryId`; when absent it is resolved from the id during
   * `verifyIdentity()`.
   */
  readonly repository?: string;
  readonly fetch?: FetchLike;
  readonly now?: () => Date;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  readonly logger?: ControllerLogger;
  readonly baseUrl?: string;
  readonly maxRetries?: number;
  readonly maxBackoffMs?: number;
  readonly pollIntervalMs?: number;
  readonly pollJitterMs?: number;
}

export interface GitHubAppDescription {
  readonly appId: number;
  readonly appSlug: string;
  readonly installationId: number;
  readonly repositoryId: number;
  readonly repository: string | null;
}

export type ActorType = 'User' | 'Bot' | 'Organization';

export interface PullRequestSummary {
  readonly number: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly mergeCommitSha: string | null;
  readonly mergeable: boolean | null;
  readonly draft: boolean;
  readonly headRepositoryId: number | null;
  readonly baseRepositoryId: number | null;
  readonly headRepositoryIsFork: boolean | null;
  readonly authorAssociation: string;
  readonly author: { readonly login: string; readonly type: ActorType } | null;
  readonly updatedAt: string;
}

export interface CommitSummary {
  readonly sha: string;
  readonly parents: readonly string[];
}

export type CheckRunStatus = 'queued' | 'in_progress' | 'completed';
export type CheckRunConclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'neutral'
  | 'timed_out'
  | 'action_required';

export interface CheckRunOutput {
  readonly title: string;
  readonly summary: string;
  readonly text?: string;
}

export interface CheckRunInput {
  readonly name: string;
  readonly headSha: string;
  readonly status: CheckRunStatus;
  readonly conclusion?: CheckRunConclusion;
  /** Tuple key of the request; stored as GitHub `external_id` so the gate can bind evidence. */
  readonly externalId?: string;
  readonly output?: CheckRunOutput;
  readonly detailsUrl?: string;
}

export interface CheckRunSummary {
  readonly id: number;
  readonly name: string;
  readonly headSha: string;
  readonly status: CheckRunStatus;
  readonly conclusion: CheckRunConclusion | null;
  readonly externalId: string | null;
  readonly appId: number | null;
}

export interface GitHubClient {
  describe(): GitHubAppDescription;
  toJSON(): GitHubAppDescription;
  /** Verifies App id/slug and repository id; resolves `owner/repo`. Must run before any repository call. */
  verifyIdentity(): Promise<GitHubAppDescription>;
  listOpenPullRequests(): Promise<readonly PullRequestSummary[]>;
  getPullRequest(number: number): Promise<PullRequestSummary>;
  getBranchHead(branch: string): Promise<CommitSummary>;
  listBranchCommits(branch: string, limit: number): Promise<readonly CommitSummary[]>;
  createCheckRun(input: CheckRunInput): Promise<CheckRunSummary>;
  updateCheckRun(id: number, input: Partial<CheckRunInput>): Promise<CheckRunSummary>;
  listCheckRunsForSha(sha: string, checkName?: string): Promise<readonly CheckRunSummary[]>;
  /** Jittered polling delay (30s ± 10s by default). */
  pollDelayMs(): number;
}

export class GitHubIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubIdentityError';
  }
}

export class GitHubRequestError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(`GitHub ${path} failed with ${status}: ${message}`);
    this.name = 'GitHubRequestError';
  }
}

interface InstallationToken {
  readonly token: string;
  readonly expiresAtMs: number;
}

interface CachedResponse {
  readonly etag: string;
  readonly body: unknown;
  readonly link: string | null;
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH';
  readonly body?: unknown;
  readonly auth: 'app' | 'installation';
  readonly conditional?: boolean;
}

interface RequestResult {
  readonly body: unknown;
  readonly link: string | null;
  readonly status: number;
}

const DEFAULT_BASE_URL = 'https://api.github.com';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_POLL_JITTER_MS = 10_000;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function repositoryId(value: unknown): number | null {
  return isRecord(value) ? asInteger(value.id) : null;
}

function repositoryIsFork(value: unknown): boolean | null {
  return isRecord(value) && typeof value.fork === 'boolean' ? value.fork : null;
}

function parseActor(value: unknown): PullRequestSummary['author'] {
  if (!isRecord(value) || typeof value.login !== 'string' || value.login.length === 0) return null;
  const type = value.type;
  if (type !== 'User' && type !== 'Bot' && type !== 'Organization') return null;
  return { login: value.login, type };
}

export function parsePullRequest(value: unknown): PullRequestSummary {
  if (!isRecord(value) || !isRecord(value.head) || !isRecord(value.base)) {
    throw new Error('GitHub pull request payload missing head/base');
  }
  const number = asInteger(value.number);
  const headSha: unknown = value.head.sha;
  const baseSha: unknown = value.base.sha;
  if (number === null || !isGitSha(headSha) || !isGitSha(baseSha)) {
    throw new Error('GitHub pull request payload has invalid number or SHAs');
  }
  const mergeCommitSha: unknown = value.merge_commit_sha;
  return {
    number,
    headSha,
    baseSha,
    mergeCommitSha: isGitSha(mergeCommitSha) ? mergeCommitSha : null,
    mergeable: typeof value.mergeable === 'boolean' ? value.mergeable : null,
    draft: value.draft === true,
    headRepositoryId: repositoryId(value.head.repo),
    baseRepositoryId: repositoryId(value.base.repo),
    headRepositoryIsFork: repositoryIsFork(value.head.repo),
    authorAssociation: asString(value.author_association, 'NONE'),
    author: parseActor(value.user),
    updatedAt: asString(value.updated_at),
  };
}

function parseCommit(value: unknown): CommitSummary {
  if (!isRecord(value)) throw new Error('GitHub commit payload is not an object');
  const sha: unknown = value.sha;
  if (!isGitSha(sha)) throw new Error('GitHub commit payload has an invalid sha');
  const parents: string[] = [];
  if (Array.isArray(value.parents)) {
    for (const parent of value.parents as unknown[]) {
      if (isRecord(parent)) {
        const parentSha: unknown = parent.sha;
        if (isGitSha(parentSha)) parents.push(parentSha);
      }
    }
  }
  return { sha, parents };
}

const CONCLUSIONS: readonly CheckRunConclusion[] = [
  'success',
  'failure',
  'cancelled',
  'neutral',
  'timed_out',
  'action_required',
];

function parseCheckRun(value: unknown): CheckRunSummary {
  if (!isRecord(value)) throw new Error('GitHub check run payload is not an object');
  const id = asInteger(value.id);
  const status = value.status;
  if (id === null || (status !== 'queued' && status !== 'in_progress' && status !== 'completed')) {
    throw new Error('GitHub check run payload has an invalid id or status');
  }
  const conclusion = CONCLUSIONS.find((candidate) => candidate === value.conclusion) ?? null;
  return {
    id,
    name: asString(value.name),
    headSha: asString(value.head_sha),
    status,
    conclusion,
    externalId:
      typeof value.external_id === 'string' && value.external_id !== '' ? value.external_id : null,
    appId: isRecord(value.app) ? asInteger(value.app.id) : null,
  };
}

function parseLinkNext(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = /<([^>]+)>;\s*rel="next"/u.exec(part.trim());
    if (match?.[1]) return match[1];
  }
  return null;
}

function checkRunBody(input: Partial<CheckRunInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.headSha !== undefined) body.head_sha = input.headSha;
  if (input.status !== undefined) body.status = input.status;
  if (input.conclusion !== undefined) body.conclusion = input.conclusion;
  if (input.externalId !== undefined) body.external_id = input.externalId;
  if (input.detailsUrl !== undefined) body.details_url = input.detailsUrl;
  if (input.output !== undefined) {
    body.output = {
      title: input.output.title,
      summary: input.output.summary,
      ...(input.output.text === undefined ? {} : { text: input.output.text }),
    };
  }
  return body;
}

/** Explicit wait requested by GitHub (Retry-After or a depleted primary quota). */
export function retryAfterMs(headers: Headers, nowMs: number): number | null {
  const retryAfter = headers.get('retry-after');
  if (retryAfter && /^\d+$/u.test(retryAfter)) return Number(retryAfter) * 1000;
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  if (remaining === '0' && reset && /^\d+$/u.test(reset)) {
    return Math.max(0, Number(reset) * 1000 - nowMs);
  }
  return null;
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  const appSlug = options.identity.appSlug ?? LOCAL_CI_APP_SLUG;
  const { appId, installationId } = options.credentials;
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new GitHubIdentityError('GitHub App id must be a positive integer');
  }
  if (!Number.isInteger(options.identity.localAppId) || options.identity.localAppId <= 0) {
    throw new GitHubIdentityError(
      'Local CI App id is unconfigured; refusing to build a GitHub client',
    );
  }
  if (appId !== options.identity.localAppId) {
    throw new GitHubIdentityError(
      `Refusing to use GitHub App ${appId}: the controller only operates as ${appSlug} (App ${options.identity.localAppId})`,
    );
  }
  if (!Number.isInteger(installationId) || installationId <= 0) {
    throw new GitHubIdentityError('GitHub App installation id must be a positive integer');
  }
  if (!Number.isInteger(options.repositoryId) || options.repositoryId <= 0) {
    throw new GitHubIdentityError('Repository id must be a positive integer');
  }
  if (options.repository !== undefined && !REPOSITORY_PATTERN.test(options.repository)) {
    throw new GitHubIdentityError('Repository must be owner/repo when provided');
  }

  // The key lives only inside this closure; nothing on the returned object
  // references it, so JSON.stringify / heartbeats / logs cannot leak it.
  const privateKey: KeyObject = parsePrivateKey(options.credentials.privateKeyPem);
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const logger = options.logger ?? createSilentLogger();
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/u, '');
  const maxRetries = options.maxRetries ?? 4;
  const maxBackoffMs = options.maxBackoffMs ?? 15 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const pollJitterMs = options.pollJitterMs ?? DEFAULT_POLL_JITTER_MS;
  const etagCache = new Map<string, CachedResponse>();
  let installationToken: InstallationToken | null = null;
  let repository: string | null = null;

  const description = (): GitHubAppDescription => ({
    appId,
    appSlug,
    installationId,
    repositoryId: options.repositoryId,
    repository,
  });

  const repoPath = (): string => {
    if (repository === null) {
      throw new GitHubIdentityError(
        'Repository identity has not been verified; call verifyIdentity() first',
      );
    }
    const [owner, name] = repository.split('/') as [string, string];
    return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  };

  const appJwt = (): string => createAppJwt({ appId, privateKey, now: now() });

  const fetchInstallationToken = async (): Promise<InstallationToken> => {
    const result = await requestRaw(`/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      auth: 'app',
    });
    if (!isRecord(result.body) || typeof result.body.token !== 'string') {
      throw new Error('GitHub installation token response is malformed');
    }
    const expiresAt = Date.parse(asString(result.body.expires_at));
    return {
      token: result.body.token,
      expiresAtMs: Number.isNaN(expiresAt) ? now().getTime() + 55 * 60 * 1000 : expiresAt,
    };
  };

  const currentInstallationToken = async (force = false): Promise<string> => {
    if (
      force ||
      installationToken === null ||
      installationToken.expiresAtMs - TOKEN_REFRESH_MARGIN_MS <= now().getTime()
    ) {
      installationToken = await fetchInstallationToken();
    }
    return installationToken.token;
  };

  const authorization = async (
    auth: RequestOptions['auth'],
    forceRefresh: boolean,
  ): Promise<string> =>
    auth === 'app'
      ? `Bearer ${appJwt()}`
      : `Bearer ${await currentInstallationToken(forceRefresh)}`;

  const backoffFor = (explicit: number | null, attempt: number): number => {
    const base = explicit ?? Math.min(maxBackoffMs, 1000 * 2 ** attempt);
    const jitter = Math.floor(random() * 1000);
    return Math.min(maxBackoffMs, base + jitter);
  };

  async function requestRaw(path: string, request: RequestOptions): Promise<RequestResult> {
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
    const method = request.method ?? 'GET';
    const cached =
      request.conditional === false || method !== 'GET' ? undefined : etagCache.get(url);
    let forceRefresh = false;
    for (let attempt = 0; ; attempt += 1) {
      const headers: Record<string, string> = {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': `${appSlug}-controller`,
        authorization: await authorization(request.auth, forceRefresh),
      };
      if (cached) headers['if-none-match'] = cached.etag;
      if (request.body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetchImpl(url, {
        method,
        headers,
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      });
      if (response.status === 304 && cached) {
        return { body: cached.body, link: cached.link, status: 304 };
      }
      if (response.status === 401 && request.auth === 'installation' && !forceRefresh) {
        forceRefresh = true;
        continue;
      }
      const explicitWait = retryAfterMs(response.headers, now().getTime());
      const rateLimited =
        response.status === 429 || (response.status === 403 && explicitWait !== null);
      if (rateLimited && attempt < maxRetries) {
        const waitMs = backoffFor(explicitWait, attempt);
        logger.warn('github.rate_limited', { path, status: response.status, waitMs, attempt });
        await sleep(waitMs);
        continue;
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new GitHubRequestError(response.status, path, text.slice(0, 200));
      }
      const link = response.headers.get('link');
      const body: unknown = response.status === 204 ? null : await response.json();
      const etag = response.headers.get('etag');
      if (method === 'GET' && etag && request.conditional !== false) {
        etagCache.set(url, { etag, body, link });
      }
      return { body, link, status: response.status };
    }
  }

  const paginate = async (path: string, pick: (page: unknown) => unknown[]): Promise<unknown[]> => {
    const items: unknown[] = [];
    let next: string | null = path;
    while (next) {
      const result: RequestResult = await requestRaw(next, { auth: 'installation' });
      items.push(...pick(result.body));
      next = parseLinkNext(result.link);
    }
    return items;
  };

  const client: GitHubClient = {
    describe: description,
    toJSON: description,
    verifyIdentity: async () => {
      const app = await requestRaw('/app', { auth: 'app', conditional: false });
      if (!isRecord(app.body) || asInteger(app.body.id) !== appId || app.body.slug !== appSlug) {
        throw new GitHubIdentityError(
          `GitHub App identity mismatch: expected ${appSlug} (App ${appId})`,
        );
      }
      const repo = await requestRaw(`/repositories/${options.repositoryId}`, {
        auth: 'installation',
        conditional: false,
      });
      if (!isRecord(repo.body) || asInteger(repo.body.id) !== options.repositoryId) {
        throw new GitHubIdentityError(
          `Repository id mismatch: GitHub did not return repository ${options.repositoryId}`,
        );
      }
      const fullName = asString(repo.body.full_name);
      if (!REPOSITORY_PATTERN.test(fullName)) {
        throw new GitHubIdentityError('Repository payload has no usable full_name');
      }
      if (options.repository !== undefined && options.repository !== fullName) {
        throw new GitHubIdentityError(
          `Repository ${options.repositoryId} is ${fullName}, not the configured ${options.repository}`,
        );
      }
      repository = fullName;
      return description();
    },
    listOpenPullRequests: async () => {
      const items = await paginate(`${repoPath()}/pulls?state=open&per_page=100`, (page) =>
        Array.isArray(page) ? (page as unknown[]) : [],
      );
      return items.map(parsePullRequest);
    },
    getPullRequest: async (number) => {
      const result = await requestRaw(`${repoPath()}/pulls/${number}`, { auth: 'installation' });
      return parsePullRequest(result.body);
    },
    getBranchHead: async (branch) => {
      const result = await requestRaw(`${repoPath()}/branches/${encodeURIComponent(branch)}`, {
        auth: 'installation',
      });
      if (!isRecord(result.body) || !isRecord(result.body.commit)) {
        throw new Error(`GitHub branch payload for ${branch} is malformed`);
      }
      return parseCommit(result.body.commit);
    },
    listBranchCommits: async (branch, limit) => {
      const perPage = Math.min(100, Math.max(1, limit));
      const result = await requestRaw(
        `${repoPath()}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}`,
        { auth: 'installation' },
      );
      const page = Array.isArray(result.body) ? (result.body as unknown[]) : [];
      return page.slice(0, limit).map(parseCommit);
    },
    createCheckRun: async (input) => {
      const result = await requestRaw(`${repoPath()}/check-runs`, {
        method: 'POST',
        auth: 'installation',
        body: checkRunBody(input),
      });
      return parseCheckRun(result.body);
    },
    updateCheckRun: async (id, input) => {
      const result = await requestRaw(`${repoPath()}/check-runs/${id}`, {
        method: 'PATCH',
        auth: 'installation',
        body: checkRunBody(input),
      });
      return parseCheckRun(result.body);
    },
    listCheckRunsForSha: async (sha, checkName) => {
      if (!isGitSha(sha)) throw new Error('listCheckRunsForSha requires a full 40-char sha');
      const query = new URLSearchParams({ per_page: '100', app_id: String(appId) });
      if (checkName) query.set('check_name', checkName);
      const items = await paginate(
        `${repoPath()}/commits/${sha}/check-runs?${query.toString()}`,
        (page) =>
          isRecord(page) && Array.isArray(page.check_runs) ? (page.check_runs as unknown[]) : [],
      );
      return items.map(parseCheckRun);
    },
    pollDelayMs: () => {
      const jitter = (random() * 2 - 1) * pollJitterMs;
      return Math.max(1000, Math.round(pollIntervalMs + jitter));
    },
  };
  return client;
}
