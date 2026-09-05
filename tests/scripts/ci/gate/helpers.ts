import { readFileSync } from 'node:fs';
import path from 'node:path';

import { formatCiResultDocument, type CiResult } from '@/scripts/ci/gate/ci-result';
import { parsePolicy, type PolicyResolution } from '@/scripts/ci/gate/policy';
import { tupleKey, type CiRequestTuple } from '@/scripts/ci/gate/tuple';

import type { GateRequest } from '@/scripts/ci/gate/evaluate-core';
import type {
  CheckRunRecord,
  CommitRecord,
  CompareRecord,
  CreateCheckRunInput,
  DeploymentRecord,
  DeploymentStatusRecord,
  GateGitHubApi,
  JobRecord,
  PullRequestRecord,
  RepositoryRecord,
  RunApprovalRecord,
  RunArtifactRecord,
  WorkflowRunRecord,
} from '@/scripts/ci/gate/github-api';

export const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const REPO_ID = 123456789;
export const OTHER_REPO_ID = 987654321;
export const LOCAL_APP_ID = 4242;
export const INSTALLATION_ID = 777001;
export const DISPATCH_APP_ID = 4343;
export const ACTIONS_APP_ID = 15368;
export const SECURITY_WORKFLOW_ID = 111;
export const CODEQL_WORKFLOW_ID = 222;
export const FALLBACK_WORKFLOW_ID = 333;
export const OTHER_WORKFLOW_ID = 444;
export const IMAGE_DIGEST = `sha256:${'1'.repeat(64)}`;
export const OTHER_DIGEST = `sha256:${'2'.repeat(64)}`;
export const CONTROLLER_VERSION = '0.1.0';
export const POLICY_VERSION = '2026-09-04.1';
export const HEAD_SHA = 'a'.repeat(40);
export const BASE_SHA = 'b'.repeat(40);
export const MERGE_SHA = 'c'.repeat(40);
export const OTHER_SHA = 'd'.repeat(40);
export const NOW = new Date('2026-09-05T12:00:00.000Z');
export const RECENT = '2026-09-05T11:00:00.000Z';
/** Committer date of HEAD_SHA in every world; runs must be created after it. */
export const HEAD_COMMITTED_AT = '2026-09-05T09:00:00.000Z';
export const RUN_CREATED_AT = '2026-09-05T10:30:00.000Z';
export const STALE = '2026-09-04T12:00:00.000Z';
export const FALLBACK_RUN_ID = 5001;
export const FALLBACK_RUN_URL = `https://github.com/lapeninns/nabatable/actions/runs/${FALLBACK_RUN_ID}`;
export const FALLBACK_ARTIFACT_NAME = `hosted-fallback-evidence-${HEAD_SHA}-1`;

export const PR_SUITE_IDS = [
  'fast-static-gates',
  'migration-integrity',
  'full-vitest-suite',
  'coverage-and-performance-evidence',
  'browser-smoke-packs',
  'shuffle-seed-20260715',
  'shuffle-seed-20260716',
  'shuffle-seed-20260717',
] as const;

export function realPolicyRaw(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(repositoryRoot, 'config/ci/policy.json'), 'utf8'),
  ) as Record<string, unknown>;
}

/** The committed policy with every REPLACE_ME placeholder filled with test identifiers. */
export function configuredPolicyRaw(): Record<string, unknown> {
  const raw = realPolicyRaw();
  raw.repositoryId = REPO_ID;
  raw.localCi = {
    ...(raw.localCi as Record<string, unknown>),
    appId: LOCAL_APP_ID,
    installationId: INSTALLATION_ID,
  };
  raw.dispatch = { ...(raw.dispatch as Record<string, unknown>), appId: DISPATCH_APP_ID };
  raw.allowedImageDigests = [IMAGE_DIGEST];
  raw.requiredHostedWorkflows = {
    'Security guards': {
      id: SECURITY_WORKFLOW_ID,
      requiredJobs: ['Service-role route authorization'],
    },
    'CodeQL security review': {
      id: CODEQL_WORKFLOW_ID,
      requiredJobs: ['CodeQL JavaScript and TypeScript'],
    },
  };
  raw.fallbackWorkflow = {
    ...(raw.fallbackWorkflow as Record<string, unknown>),
    id: FALLBACK_WORKFLOW_ID,
  };
  return raw;
}

export function configuredPolicy(
  mutate?: (raw: Record<string, unknown>) => void,
): PolicyResolution {
  const raw = configuredPolicyRaw();
  mutate?.(raw);
  return parsePolicy(raw);
}

export function prTuple(overrides: Partial<CiRequestTuple> = {}): CiRequestTuple {
  return {
    repositoryId: REPO_ID,
    profile: 'pr',
    prNumber: 42,
    headSha: HEAD_SHA,
    baseSha: BASE_SHA,
    testedSha: MERGE_SHA,
    policyVersion: POLICY_VERSION,
    imageDigest: IMAGE_DIGEST,
    controllerVersion: CONTROLLER_VERSION,
    attempt: 1,
    ...overrides,
  };
}

export function mainTuple(overrides: Partial<CiRequestTuple> = {}): CiRequestTuple {
  return {
    repositoryId: REPO_ID,
    profile: 'main',
    headSha: HEAD_SHA,
    baseSha: BASE_SHA,
    testedSha: HEAD_SHA,
    policyVersion: POLICY_VERSION,
    imageDigest: IMAGE_DIGEST,
    controllerVersion: CONTROLLER_VERSION,
    attempt: 1,
    ...overrides,
  };
}

export function prRequest(overrides: Partial<GateRequest> = {}): GateRequest {
  return {
    repositoryId: REPO_ID,
    profile: 'pr',
    prNumber: 42,
    headSha: HEAD_SHA,
    baseSha: BASE_SHA,
    testedSha: MERGE_SHA,
    attempt: 1,
    ...overrides,
  };
}

export function mainRequest(overrides: Partial<GateRequest> = {}): GateRequest {
  return {
    repositoryId: REPO_ID,
    profile: 'main',
    headSha: HEAD_SHA,
    baseSha: BASE_SHA,
    testedSha: HEAD_SHA,
    attempt: 1,
    ...overrides,
  };
}

export type SuiteOverride = Partial<CiResult['suites'][number]>;

export function suiteResults(
  overrides: Record<string, SuiteOverride> = {},
  suiteIds: readonly string[] = PR_SUITE_IDS,
): CiResult['suites'] {
  return suiteIds.map((id, index) => ({
    id,
    name: id,
    status: 'passed' as const,
    evidenceDigest: `sha256:${(index + 3).toString(16).padStart(64, '0')}`,
    durationMs: 60_000,
    ...overrides[id],
  }));
}

export function localResult(
  tuple: CiRequestTuple = prTuple(),
  overrides: Partial<CiResult> = {},
): CiResult {
  return {
    schema: 'nabatable.ci-result/v1',
    source: 'local',
    tuple,
    installationId: INSTALLATION_ID,
    suites: suiteResults(),
    coverage: { status: 'passed', evidenceDigest: `sha256:${'e'.repeat(64)}` },
    evidence: { bundleDigest: `sha256:${'f'.repeat(64)}`, location: 'https://evidence.example/1' },
    startedAt: '2026-09-05T10:00:00.000Z',
    completedAt: RECENT,
    ...overrides,
  };
}

export function fallbackResult(
  tuple: CiRequestTuple = prTuple(),
  overrides: Partial<CiResult> = {},
): CiResult {
  const base = localResult(tuple, overrides);
  delete base.installationId;
  return { ...base, source: 'hosted-fallback', runId: FALLBACK_RUN_ID, ...overrides };
}

export function checkRun(
  result: CiResult,
  overrides: Partial<CheckRunRecord> = {},
): CheckRunRecord {
  const local = result.source === 'local';
  return {
    id: local ? 9001 : 9002,
    name: `${local ? 'Local CI / ' : 'Hosted profile fallback / '}${result.tuple.profile}`,
    headSha: result.tuple.headSha,
    externalId: tupleKey(result.tuple),
    status: 'completed',
    conclusion: 'success',
    completedAt: result.completedAt,
    appId: local ? LOCAL_APP_ID : ACTIONS_APP_ID,
    appSlug: local ? 'nabatable-local-ci' : 'github-actions',
    detailsUrl: local ? 'https://evidence.example/1' : FALLBACK_RUN_URL,
    outputText: formatCiResultDocument(result),
    ...overrides,
  };
}

export function hostedRun(
  workflowId: number,
  overrides: Partial<WorkflowRunRecord> = {},
): WorkflowRunRecord {
  return {
    id: workflowId * 10,
    workflowId,
    headSha: HEAD_SHA,
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    runAttempt: 1,
    runNumber: 1,
    createdAt: RUN_CREATED_AT,
    updatedAt: RECENT,
    ...overrides,
  };
}

export type FakeGitHubState = {
  repository: RepositoryRecord;
  pullRequests: Map<number, PullRequestRecord>;
  commits: Map<string, CommitRecord>;
  compares: Map<string, CompareRecord>;
  checkRuns: CheckRunRecord[];
  workflowRuns: WorkflowRunRecord[];
  jobs: Map<number, JobRecord[]>;
  artifacts: Map<number, RunArtifactRecord[]>;
  approvals: Map<number, RunApprovalRecord[]>;
  deployments: DeploymentRecord[];
  deploymentStatuses: Map<number, DeploymentStatusRecord[]>;
  failures: Set<keyof GateGitHubApi>;
  created: CreateCheckRunInput[];
  calls: string[];
};

export class FakeGitHub implements GateGitHubApi {
  readonly state: FakeGitHubState;

  constructor(state: Partial<FakeGitHubState> = {}) {
    this.state = {
      repository: { id: REPO_ID, fullName: 'lapeninns/nabatable', defaultBranch: 'main' },
      pullRequests: new Map(),
      commits: new Map(),
      compares: new Map(),
      checkRuns: [],
      workflowRuns: [],
      jobs: new Map(),
      artifacts: new Map(),
      approvals: new Map(),
      deployments: [],
      deploymentStatuses: new Map(),
      failures: new Set(),
      created: [],
      calls: [],
      ...state,
    };
  }

  private guard(method: keyof GateGitHubApi): void {
    this.state.calls.push(method);
    if (this.state.failures.has(method)) throw new Error(`${method} unavailable (503)`);
  }

  async getRepository(): Promise<RepositoryRecord> {
    this.guard('getRepository');
    return this.state.repository;
  }

  async getPullRequest(prNumber: number): Promise<PullRequestRecord | null> {
    this.guard('getPullRequest');
    return this.state.pullRequests.get(prNumber) ?? null;
  }

  async getCommit(sha: string): Promise<CommitRecord | null> {
    this.guard('getCommit');
    return this.state.commits.get(sha) ?? null;
  }

  async compareCommits(base: string, head: string): Promise<CompareRecord | null> {
    this.guard('compareCommits');
    return this.state.compares.get(`${base}...${head}`) ?? null;
  }

  async listCheckRuns(ref: string, checkName: string): Promise<CheckRunRecord[]> {
    this.guard('listCheckRuns');
    return this.state.checkRuns.filter((run) => run.headSha === ref && run.name === checkName);
  }

  async listWorkflowRuns(workflowId: number, headSha: string): Promise<WorkflowRunRecord[]> {
    this.guard('listWorkflowRuns');
    return this.state.workflowRuns.filter(
      (run) => run.workflowId === workflowId && run.headSha === headSha,
    );
  }

  async getWorkflowRun(runId: number): Promise<WorkflowRunRecord | null> {
    this.guard('getWorkflowRun');
    return this.state.workflowRuns.find((run) => run.id === runId) ?? null;
  }

  async listJobs(runId: number): Promise<JobRecord[]> {
    this.guard('listJobs');
    return this.state.jobs.get(runId) ?? [];
  }

  async listRunArtifacts(runId: number): Promise<RunArtifactRecord[]> {
    this.guard('listRunArtifacts');
    return this.state.artifacts.get(runId) ?? [];
  }

  async listRunApprovals(runId: number): Promise<RunApprovalRecord[]> {
    this.guard('listRunApprovals');
    return this.state.approvals.get(runId) ?? [];
  }

  async listDeployments(environment: string): Promise<DeploymentRecord[]> {
    this.guard('listDeployments');
    return this.state.deployments.filter((deployment) => deployment.environment === environment);
  }

  async listDeploymentStatuses(deploymentId: number): Promise<DeploymentStatusRecord[]> {
    this.guard('listDeploymentStatuses');
    return this.state.deploymentStatuses.get(deploymentId) ?? [];
  }

  async createCheckRun(input: CreateCheckRunInput): Promise<{ id: number }> {
    this.guard('createCheckRun');
    this.state.created.push(input);
    return { id: 70_000 + this.state.created.length };
  }
}

/** A world in which every source agrees: open PR, local evidence, green hosted lanes. */
export function prWorld(
  options: { evidence?: CiResult | null; checkRuns?: CheckRunRecord[] } = {},
) {
  const api = new FakeGitHub();
  api.state.pullRequests.set(42, {
    number: 42,
    state: 'open',
    draft: false,
    headSha: HEAD_SHA,
    headRepoId: REPO_ID,
    baseSha: BASE_SHA,
    baseRef: 'main',
    baseRepoId: REPO_ID,
    mergeCommitSha: MERGE_SHA,
  });
  api.state.commits.set(HEAD_SHA, {
    sha: HEAD_SHA,
    parents: [BASE_SHA],
    committedAt: HEAD_COMMITTED_AT,
  });
  const evidence = options.evidence === undefined ? localResult() : options.evidence;
  if (evidence) api.state.checkRuns.push(checkRun(evidence));
  if (options.checkRuns) api.state.checkRuns.push(...options.checkRuns);
  for (const workflowId of [SECURITY_WORKFLOW_ID, CODEQL_WORKFLOW_ID]) {
    const run = hostedRun(workflowId);
    api.state.workflowRuns.push(run);
    api.state.jobs.set(run.id, [
      {
        id: run.id + 1,
        name:
          workflowId === SECURITY_WORKFLOW_ID
            ? 'Service-role route authorization'
            : 'CodeQL JavaScript and TypeScript',
        status: 'completed',
        conclusion: 'success',
      },
    ]);
  }
  return api;
}

export function mainWorld(options: { evidence?: CiResult | null } = {}) {
  const api = new FakeGitHub();
  api.state.commits.set(HEAD_SHA, {
    sha: HEAD_SHA,
    parents: [BASE_SHA],
    committedAt: HEAD_COMMITTED_AT,
  });
  api.state.compares.set(`${HEAD_SHA}...main`, { status: 'identical' });
  const evidence = options.evidence === undefined ? localResult(mainTuple()) : options.evidence;
  if (evidence) api.state.checkRuns.push(checkRun(evidence));
  for (const workflowId of [SECURITY_WORKFLOW_ID, CODEQL_WORKFLOW_ID]) {
    const run = hostedRun(workflowId, { event: 'push' });
    api.state.workflowRuns.push(run);
    api.state.jobs.set(run.id, [
      {
        id: run.id + 1,
        name:
          workflowId === SECURITY_WORKFLOW_ID
            ? 'Service-role route authorization'
            : 'CodeQL JavaScript and TypeScript',
        status: 'completed',
        conclusion: 'success',
      },
    ]);
  }
  return api;
}

/**
 * Adds an approved "CI fallback" run + deployment record for FALLBACK_RUN_ID,
 * carrying the evidence artifact the trusted workflow uploads for HEAD_SHA attempt 1.
 */
export function approveFallback(api: FakeGitHub, workflowId = FALLBACK_WORKFLOW_ID): void {
  api.state.workflowRuns.push(
    hostedRun(workflowId, {
      id: FALLBACK_RUN_ID,
      event: 'workflow_dispatch',
      headSha: MERGE_SHA,
    }),
  );
  api.state.artifacts.set(FALLBACK_RUN_ID, [
    { id: 8101, name: FALLBACK_ARTIFACT_NAME, expired: false },
    { id: 8102, name: 'playwright-report', expired: false },
  ]);
  api.state.approvals.set(FALLBACK_RUN_ID, [{ state: 'approved', environments: ['CI fallback'] }]);
  api.state.deployments.push({
    id: 61,
    environment: 'CI fallback',
    sha: MERGE_SHA,
    ref: 'main',
  });
  api.state.deploymentStatuses.set(61, [{ state: 'success', logUrl: FALLBACK_RUN_URL }]);
}
