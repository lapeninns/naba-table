/**
 * Narrow, injectable GitHub REST surface for the release gate. The production
 * implementation uses global `fetch` with the workflow-provided GITHUB_TOKEN;
 * tests provide in-memory fakes. Only the fields the gate reasons about are
 * mapped so that fixtures stay small and refusals stay explainable.
 */

export type RepositoryRecord = { id: number; fullName: string; defaultBranch: string };

export type PullRequestRecord = {
  number: number;
  state: 'open' | 'closed';
  draft: boolean;
  headSha: string;
  headRepoId: number | null;
  baseSha: string;
  baseRef: string;
  baseRepoId: number;
  mergeCommitSha: string | null;
};

export type CommitRecord = { sha: string; parents: string[]; committedAt: string | null };

export type CompareRecord = { status: 'identical' | 'ahead' | 'behind' | 'diverged' };

export type CheckRunRecord = {
  id: number;
  name: string;
  headSha: string;
  externalId: string | null;
  status: string;
  conclusion: string | null;
  completedAt: string | null;
  appId: number | null;
  appSlug: string | null;
  detailsUrl: string | null;
  outputText: string | null;
};

export type WorkflowRunRecord = {
  id: number;
  workflowId: number;
  headSha: string;
  event: string;
  status: string;
  conclusion: string | null;
  runAttempt: number;
  runNumber: number;
  createdAt: string | null;
  updatedAt: string;
};

export type JobRecord = { id: number; name: string; status: string; conclusion: string | null };

export type RunArtifactRecord = { id: number; name: string; expired: boolean };

export type RunApprovalRecord = { state: string; environments: string[] };

export type DeploymentRecord = { id: number; environment: string; sha: string; ref: string };

export type DeploymentStatusRecord = { state: string; logUrl: string | null };

export type CheckRunConclusion = 'success' | 'failure';

export type CreateCheckRunInput = {
  name: string;
  headSha: string;
  externalId: string;
  conclusion: CheckRunConclusion;
  title: string;
  summary: string;
  text?: string;
  detailsUrl?: string;
};

export interface GateGitHubApi {
  getRepository(): Promise<RepositoryRecord>;
  getPullRequest(prNumber: number): Promise<PullRequestRecord | null>;
  getCommit(sha: string): Promise<CommitRecord | null>;
  compareCommits(base: string, head: string): Promise<CompareRecord | null>;
  listCheckRuns(ref: string, checkName: string): Promise<CheckRunRecord[]>;
  listWorkflowRuns(workflowId: number, headSha: string): Promise<WorkflowRunRecord[]>;
  getWorkflowRun(runId: number): Promise<WorkflowRunRecord | null>;
  listJobs(runId: number): Promise<JobRecord[]>;
  listRunArtifacts(runId: number): Promise<RunArtifactRecord[]>;
  listRunApprovals(runId: number): Promise<RunApprovalRecord[]>;
  listDeployments(environment: string): Promise<DeploymentRecord[]>;
  listDeploymentStatuses(deploymentId: number): Promise<DeploymentStatusRecord[]>;
  createCheckRun(input: CreateCheckRunInput): Promise<{ id: number }>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type GitHubApiOptions = {
  token: string;
  /** owner/repo as provided by GITHUB_REPOSITORY. */
  repository: string;
  apiUrl?: string;
  fetchImpl?: FetchLike;
  userAgent?: string;
};

export class GitHubApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function requireNum(value: unknown, field: string): number {
  const parsed = num(value);
  if (parsed === null) throw new GitHubApiError(`GitHub response missing numeric ${field}`, 502);
  return parsed;
}

function requireStr(value: unknown, field: string): string {
  const parsed = str(value);
  if (parsed === null) throw new GitHubApiError(`GitHub response missing string ${field}`, 502);
  return parsed;
}

function mapWorkflowRun(raw: unknown): WorkflowRunRecord {
  if (!isRecord(raw)) throw new GitHubApiError('workflow run payload malformed', 502);
  return {
    id: requireNum(raw.id, 'id'),
    workflowId: requireNum(raw.workflow_id, 'workflow_id'),
    headSha: requireStr(raw.head_sha, 'head_sha'),
    event: requireStr(raw.event, 'event'),
    status: str(raw.status) ?? 'unknown',
    conclusion: str(raw.conclusion),
    runAttempt: num(raw.run_attempt) ?? 1,
    runNumber: num(raw.run_number) ?? 0,
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at) ?? str(raw.created_at) ?? new Date(0).toISOString(),
  };
}

function mapCheckRun(raw: unknown): CheckRunRecord {
  if (!isRecord(raw)) throw new GitHubApiError('check run payload malformed', 502);
  const app = isRecord(raw.app) ? raw.app : {};
  const output = isRecord(raw.output) ? raw.output : {};
  return {
    id: requireNum(raw.id, 'id'),
    name: requireStr(raw.name, 'name'),
    headSha: requireStr(raw.head_sha, 'head_sha'),
    externalId: str(raw.external_id),
    status: str(raw.status) ?? 'unknown',
    conclusion: str(raw.conclusion),
    completedAt: str(raw.completed_at),
    appId: num(app.id),
    appSlug: str(app.slug),
    detailsUrl: str(raw.details_url),
    outputText: str(output.text),
  };
}

/**
 * Production adapter. Every request carries an explicit API version header and
 * the token only ever travels in the Authorization header. Responses are
 * mapped defensively; anything malformed becomes a GitHubApiError, which the
 * gate treats as a refusal (fail closed).
 */
export function createGitHubApi(options: GitHubApiOptions): GateGitHubApi {
  const apiUrl = (options.apiUrl ?? 'https://api.github.com').replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const repository = options.repository;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY must look like owner/repo');
  }
  if (!options.token) throw new Error('GITHUB_TOKEN is required');
  const base = `${apiUrl}/repos/${repository}`;

  async function request(
    method: 'GET' | 'POST',
    url: string,
    body?: unknown,
    allowNotFound = false,
  ): Promise<unknown> {
    const response = await fetchImpl(url, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${options.token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': options.userAgent ?? 'nabatable-release-gate',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.status === 404 && allowNotFound) return null;
    if (!response.ok) {
      // Never echo the response body: it may contain request identifiers we do not control.
      throw new GitHubApiError(
        `GitHub API ${method} ${url.replace(apiUrl, '')} -> ${response.status}`,
        response.status,
      );
    }
    return response.json() as Promise<unknown>;
  }

  async function paginate(url: string, key: string): Promise<unknown[]> {
    const items: unknown[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const separator = url.includes('?') ? '&' : '?';
      const payload = await request('GET', `${url}${separator}per_page=100&page=${page}`);
      const list = isRecord(payload) && Array.isArray(payload[key]) ? payload[key] : [];
      items.push(...list);
      if (list.length < 100) break;
    }
    return items;
  }

  return {
    async getRepository() {
      const payload = await request('GET', base);
      if (!isRecord(payload)) throw new GitHubApiError('repository payload malformed', 502);
      return {
        id: requireNum(payload.id, 'id'),
        fullName: requireStr(payload.full_name, 'full_name'),
        defaultBranch: requireStr(payload.default_branch, 'default_branch'),
      };
    },
    async getPullRequest(prNumber) {
      const payload = await request('GET', `${base}/pulls/${prNumber}`, undefined, true);
      if (payload === null) return null;
      if (!isRecord(payload) || !isRecord(payload.head) || !isRecord(payload.base)) {
        throw new GitHubApiError('pull request payload malformed', 502);
      }
      const headRepo = isRecord(payload.head.repo) ? payload.head.repo : {};
      const baseRepo = isRecord(payload.base.repo) ? payload.base.repo : {};
      return {
        number: requireNum(payload.number, 'number'),
        state: payload.state === 'open' ? 'open' : 'closed',
        draft: payload.draft === true,
        headSha: requireStr(payload.head.sha, 'head.sha'),
        headRepoId: num(headRepo.id),
        baseSha: requireStr(payload.base.sha, 'base.sha'),
        baseRef: requireStr(payload.base.ref, 'base.ref'),
        baseRepoId: requireNum(baseRepo.id, 'base.repo.id'),
        mergeCommitSha: str(payload.merge_commit_sha),
      };
    },
    async getCommit(sha) {
      const payload = await request('GET', `${base}/commits/${sha}`, undefined, true);
      if (payload === null) return null;
      if (!isRecord(payload)) throw new GitHubApiError('commit payload malformed', 502);
      const parents = Array.isArray(payload.parents)
        ? payload.parents.map((parent) => (isRecord(parent) ? str(parent.sha) : null))
        : [];
      const commit = isRecord(payload.commit) ? payload.commit : {};
      const committer = isRecord(commit.committer) ? commit.committer : {};
      return {
        sha: requireStr(payload.sha, 'sha'),
        parents: parents.filter((parent): parent is string => parent !== null),
        committedAt: str(committer.date),
      };
    },
    async compareCommits(baseRef, headRef) {
      const payload = await request(
        'GET',
        `${base}/compare/${baseRef}...${headRef}`,
        undefined,
        true,
      );
      if (payload === null) return null;
      if (!isRecord(payload)) throw new GitHubApiError('compare payload malformed', 502);
      const status = payload.status;
      if (
        status !== 'identical' &&
        status !== 'ahead' &&
        status !== 'behind' &&
        status !== 'diverged'
      ) {
        throw new GitHubApiError('compare status malformed', 502);
      }
      return { status };
    },
    async listCheckRuns(ref, checkName) {
      const items = await paginate(
        `${base}/commits/${ref}/check-runs?check_name=${encodeURIComponent(checkName)}&filter=all`,
        'check_runs',
      );
      return items.map(mapCheckRun);
    },
    async listWorkflowRuns(workflowId, headSha) {
      const items = await paginate(
        `${base}/actions/workflows/${workflowId}/runs?head_sha=${headSha}`,
        'workflow_runs',
      );
      return items.map(mapWorkflowRun);
    },
    async getWorkflowRun(runId) {
      const payload = await request('GET', `${base}/actions/runs/${runId}`, undefined, true);
      return payload === null ? null : mapWorkflowRun(payload);
    },
    async listJobs(runId) {
      const items = await paginate(`${base}/actions/runs/${runId}/jobs?filter=latest`, 'jobs');
      return items.map((raw) => {
        if (!isRecord(raw)) throw new GitHubApiError('job payload malformed', 502);
        return {
          id: requireNum(raw.id, 'id'),
          name: requireStr(raw.name, 'name'),
          status: str(raw.status) ?? 'unknown',
          conclusion: str(raw.conclusion),
        };
      });
    },
    async listRunArtifacts(runId) {
      const items = await paginate(`${base}/actions/runs/${runId}/artifacts`, 'artifacts');
      return items.map((raw) => {
        if (!isRecord(raw)) throw new GitHubApiError('artifact payload malformed', 502);
        return {
          id: requireNum(raw.id, 'id'),
          name: requireStr(raw.name, 'name'),
          expired: raw.expired === true,
        };
      });
    },
    async listRunApprovals(runId) {
      const payload = await request('GET', `${base}/actions/runs/${runId}/approvals`);
      const list = Array.isArray(payload) ? payload : [];
      return list.map((raw) => {
        const record = isRecord(raw) ? raw : {};
        const environments = Array.isArray(record.environments)
          ? record.environments
              .map((env) => (isRecord(env) ? str(env.name) : null))
              .filter((name): name is string => name !== null)
          : [];
        return { state: str(record.state) ?? 'unknown', environments };
      });
    },
    async listDeployments(environment) {
      // The deployments endpoint returns a bare array, so it is requested directly.
      const payload = await request(
        'GET',
        `${base}/deployments?environment=${encodeURIComponent(environment)}&per_page=100`,
      );
      const list = Array.isArray(payload) ? payload : [];
      return list.map((raw) => {
        if (!isRecord(raw)) throw new GitHubApiError('deployment payload malformed', 502);
        return {
          id: requireNum(raw.id, 'id'),
          environment: requireStr(raw.environment, 'environment'),
          sha: requireStr(raw.sha, 'sha'),
          ref: requireStr(raw.ref, 'ref'),
        };
      });
    },
    async listDeploymentStatuses(deploymentId) {
      const payload = await request(
        'GET',
        `${base}/deployments/${deploymentId}/statuses?per_page=100`,
      );
      const list = Array.isArray(payload) ? payload : [];
      return list.map((raw) => {
        const record = isRecord(raw) ? raw : {};
        return { state: str(record.state) ?? 'unknown', logUrl: str(record.log_url) };
      });
    },
    async createCheckRun(input) {
      const payload = await request('POST', `${base}/check-runs`, {
        name: input.name,
        head_sha: input.headSha,
        external_id: input.externalId,
        status: 'completed',
        conclusion: input.conclusion,
        details_url: input.detailsUrl,
        output: { title: input.title, summary: input.summary, text: input.text },
      });
      if (!isRecord(payload)) throw new GitHubApiError('check run create payload malformed', 502);
      return { id: requireNum(payload.id, 'id') };
    },
  };
}
