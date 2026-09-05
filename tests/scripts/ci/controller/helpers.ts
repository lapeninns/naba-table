import { dedupKey, type TrustPolicy } from '@/scripts/ci/contracts';
import { DEFAULT_ALLOCATIONS } from '@/scripts/ci/controller/admission/policy';
import { londonClock } from '@/scripts/ci/controller/admission/probes';

import { DIGEST_1, DIGEST_2, POLICY, ciResult } from '../contracts/fixtures';

import type {
  AdmissionDecision,
  AdmissionEvaluator,
} from '@/scripts/ci/controller/admission/policy';
import type { SleepAssertion } from '@/scripts/ci/controller/caffeinate';
import type { ControllerConfig } from '@/scripts/ci/controller/controller';
import type {
  CheckRunInput,
  CheckRunSummary,
  CommitSummary,
  GitHubAppDescription,
  GitHubClient,
  PullRequestSummary,
} from '@/scripts/ci/controller/github/client';
import type { HeartbeatEmitter } from '@/scripts/ci/controller/heartbeat';
import type {
  AdmissionMode,
  CiRequest,
  CiResult,
  ControllerHeartbeatPayload,
  Runner,
  RunnerJob,
} from '@/scripts/ci/controller/types';

export const REPO_ID = 123456789;
export const APP_ID = 4242;
export const INSTALLATION_ID = 777001;
export const CONTROLLER_VERSION = '0.1.0';

export const SHA_MAIN_A = '1'.repeat(40);
export const SHA_MAIN_B = '2'.repeat(40);
export const SHA_MAIN_C = '3'.repeat(40);
export const SHA_MAIN_PARENT = '0'.repeat(39) + '9';
export const SHA_PR_HEAD_X = 'a'.repeat(40);
export const SHA_PR_HEAD_Y = 'b'.repeat(40);
export const SHA_PR_MERGE_X = 'c'.repeat(40);
export const SHA_PR_MERGE_Y = 'd'.repeat(40);
export const SHA_PR2_HEAD = 'e'.repeat(40);
export const SHA_PR2_MERGE = 'f'.repeat(40);

export function trustPolicy(overrides: Partial<TrustPolicy> = {}): TrustPolicy {
  return {
    version: 1,
    trustedRepositoryId: REPO_ID,
    actorPolicy: {
      localActors: ['alice', 'bob'],
      automationIdentities: ['dependabot[bot]'],
      automationRoute: 'hosted',
      unknownActorRoute: 'hosted',
    },
    ignoredSignals: ['labels', 'branchNames', 'commitMessages', 'pullRequestTitles'],
    ...overrides,
  };
}

export function controllerConfig(overrides: Partial<ControllerConfig> = {}): ControllerConfig {
  return {
    controllerId: 'test-controller',
    controllerVersion: CONTROLLER_VERSION,
    repositoryId: REPO_ID,
    installationId: INSTALLATION_ID,
    defaultBranch: 'main',
    policyVersions: { pr: POLICY, main: POLICY, nightly: POLICY },
    imageDigest: DIGEST_1,
    leaseTtlMs: 60_000,
    maxAttempts: 2,
    nightlyHourLondon: 2,
    skipDraftPullRequests: true,
    trustPolicy: trustPolicy(),
    ...overrides,
  };
}

export interface PullRequestOptions {
  readonly headSha?: string;
  readonly baseSha?: string;
  readonly mergeCommitSha?: string | null;
  readonly headRepositoryId?: number | null;
  readonly baseRepositoryId?: number | null;
  readonly headRepositoryIsFork?: boolean | null;
  readonly author?: PullRequestSummary['author'];
  readonly draft?: boolean;
  readonly mergeable?: boolean | null;
}

export function pullRequest(number: number, options: PullRequestOptions = {}): PullRequestSummary {
  return {
    number,
    headSha: options.headSha ?? SHA_PR_HEAD_X,
    baseSha: options.baseSha ?? SHA_MAIN_A,
    mergeCommitSha: options.mergeCommitSha === undefined ? SHA_PR_MERGE_X : options.mergeCommitSha,
    mergeable: options.mergeable === undefined ? true : options.mergeable,
    draft: options.draft ?? false,
    headRepositoryId: options.headRepositoryId === undefined ? REPO_ID : options.headRepositoryId,
    baseRepositoryId: options.baseRepositoryId === undefined ? REPO_ID : options.baseRepositoryId,
    headRepositoryIsFork:
      options.headRepositoryIsFork === undefined ? false : options.headRepositoryIsFork,
    authorAssociation: 'MEMBER',
    author: options.author === undefined ? { login: 'alice', type: 'User' } : options.author,
    updatedAt: '2026-09-04T09:00:00.000Z',
  };
}

export function mainHead(sha: string, parent: string = SHA_MAIN_PARENT): CommitSummary {
  return { sha, parents: [parent] };
}

/** A complete, gate-compatible result bound to `request` by dedup key and attempt. */
export function completeResultFor(request: CiRequest, overrides: Partial<CiResult> = {}): CiResult {
  return ciResult({
    dedupKey: dedupKey(request),
    attempt: request.attempt,
    evidenceDigests: { 'fast-static-gates': DIGEST_2 },
    ...overrides,
  });
}

export function failingResultFor(request: CiRequest): CiResult {
  return completeResultFor(request, {
    supervisorOutcome: 'failed',
    testInventory: {
      discoveredIds: ['tests/a.test.ts::passes', 'tests/b.test.ts::fails'],
      counts: { discovered: 2, passed: 1, failed: 1, skipped: 0, todo: 0 },
    },
    timings: {
      startedAt: '2026-09-04T10:00:00.000Z',
      finishedAt: '2026-09-04T10:30:00.000Z',
      durationMs: 1_800_000,
      suites: [
        {
          suiteId: 'fast-static-gates',
          outcome: 'failed',
          durationMs: 600_000,
          p95BudgetExceeded: false,
        },
      ],
    },
  });
}

export function cancelledResultFor(request: CiRequest): CiResult {
  return completeResultFor(request, {
    supervisorOutcome: 'cancelled',
    timings: {
      startedAt: '2026-09-04T10:00:00.000Z',
      finishedAt: '2026-09-04T10:05:00.000Z',
      durationMs: 300_000,
      suites: [
        {
          suiteId: 'fast-static-gates',
          outcome: 'cancelled',
          durationMs: 300_000,
          p95BudgetExceeded: false,
        },
      ],
    },
  });
}

export interface RecordedCheckRun {
  readonly id: number;
  input: Partial<CheckRunInput>;
  history: Partial<CheckRunInput>[];
}

/** In-memory GitHub double. Records every call so tests can assert what was (not) fetched. */
export class FakeGitHub implements GitHubClient {
  pulls: PullRequestSummary[] = [];
  head: CommitSummary = mainHead(SHA_MAIN_A);
  calls: string[] = [];
  checkRuns = new Map<number, RecordedCheckRun>();
  existingRunsForSha = new Map<string, CheckRunSummary[]>();
  failNext: Error | null = null;
  private nextId = 100;

  private description: GitHubAppDescription = {
    appId: APP_ID,
    appSlug: 'nabatable-local-ci',
    installationId: INSTALLATION_ID,
    repositoryId: REPO_ID,
    repository: 'nabatable/nabatable',
  };

  private failIfArmed(): void {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
  }

  describe(): GitHubAppDescription {
    return this.description;
  }

  toJSON(): GitHubAppDescription {
    return this.description;
  }

  async verifyIdentity(): Promise<GitHubAppDescription> {
    this.calls.push('verifyIdentity');
    return this.description;
  }

  async listOpenPullRequests(): Promise<readonly PullRequestSummary[]> {
    this.calls.push('listOpenPullRequests');
    this.failIfArmed();
    return [...this.pulls];
  }

  async getPullRequest(number: number): Promise<PullRequestSummary> {
    this.calls.push(`getPullRequest:${number}`);
    const found = this.pulls.find((pr) => pr.number === number);
    if (!found) throw new Error(`no such PR ${number}`);
    return found;
  }

  async getBranchHead(branch: string): Promise<CommitSummary> {
    this.calls.push(`getBranchHead:${branch}`);
    this.failIfArmed();
    return this.head;
  }

  async listBranchCommits(branch: string): Promise<readonly CommitSummary[]> {
    this.calls.push(`listBranchCommits:${branch}`);
    return [this.head];
  }

  async createCheckRun(input: CheckRunInput): Promise<CheckRunSummary> {
    this.calls.push(`createCheckRun:${input.name}:${input.status}`);
    const id = this.nextId;
    this.nextId += 1;
    this.checkRuns.set(id, { id, input, history: [input] });
    return this.summary(id);
  }

  async updateCheckRun(id: number, input: Partial<CheckRunInput>): Promise<CheckRunSummary> {
    this.calls.push(`updateCheckRun:${id}:${input.status ?? 'patch'}`);
    const existing = this.checkRuns.get(id);
    if (!existing) throw new Error(`no such check run ${id}`);
    existing.input = { ...existing.input, ...input };
    existing.history.push(input);
    return this.summary(id);
  }

  async listCheckRunsForSha(sha: string, checkName?: string): Promise<readonly CheckRunSummary[]> {
    this.calls.push(`listCheckRunsForSha:${sha}:${checkName ?? '*'}`);
    return this.existingRunsForSha.get(sha) ?? [];
  }

  pollDelayMs(): number {
    return 0;
  }

  private summary(id: number): CheckRunSummary {
    const run = this.checkRuns.get(id);
    if (!run) throw new Error(`no such check run ${id}`);
    return {
      id,
      name: run.input.name ?? '',
      headSha: run.input.headSha ?? '',
      status: run.input.status ?? 'queued',
      conclusion: run.input.conclusion ?? null,
      externalId: run.input.externalId ?? null,
      appId: APP_ID,
    };
  }

  /** Every recorded check-run write (creates and updates) in order. */
  writes(): Partial<CheckRunInput>[] {
    return [...this.checkRuns.values()].flatMap((run) => run.history);
  }

  completedConclusions(): (string | undefined)[] {
    return this.writes()
      .filter((write) => write.status === 'completed')
      .map((write) => write.conclusion);
  }
}

export interface ManualRunner {
  readonly runner: Runner;
  readonly jobs: RunnerJob[];
  resolve(attemptId: string, value: unknown): void;
  reject(attemptId: string, error: unknown): void;
}

/** Runner whose jobs are completed by the test, one attempt at a time. */
export function manualRunner(): ManualRunner {
  const jobs: RunnerJob[] = [];
  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();
  const settle = (attemptId: string) => {
    const entry = pending.get(attemptId);
    if (!entry) throw new Error(`no pending job for attempt ${attemptId}`);
    pending.delete(attemptId);
    return entry;
  };
  return {
    jobs,
    runner: (job) =>
      new Promise<unknown>((resolve, reject) => {
        jobs.push(job);
        pending.set(job.attemptId, { resolve, reject });
      }),
    resolve: (attemptId, value) => settle(attemptId).resolve(value),
    reject: (attemptId, error) => settle(attemptId).reject(error),
  };
}

export interface AdmissionState {
  admitted: boolean;
  mode: AdmissionMode;
  reasons: string[];
}

export function fakeAdmission(state: AdmissionState, now: () => Date): AdmissionEvaluator {
  return async (): Promise<AdmissionDecision> => ({
    admitted: state.admitted,
    mode: state.mode,
    allocation: DEFAULT_ALLOCATIONS[state.mode],
    reasons: [...state.reasons],
    clock: londonClock(now()),
  });
}

export function recordingHeartbeat(): HeartbeatEmitter & {
  readonly payloads: ControllerHeartbeatPayload[];
} {
  const payloads: ControllerHeartbeatPayload[] = [];
  return {
    payloads,
    describe: () => ({ url: 'https://ops.example.test/heartbeat' }),
    emit: async (payload) => {
      payloads.push(payload);
      return { ok: true, status: 202 };
    },
  };
}

export function fakeSleepAssertion(): SleepAssertion & { starts: number; stops: number } {
  let active = false;
  const assertion = {
    starts: 0,
    stops: 0,
    start: () => {
      active = true;
      assertion.starts += 1;
    },
    stop: () => {
      active = false;
      assertion.stops += 1;
    },
    isActive: () => active,
  };
  return assertion;
}

export function clock(startIso: string): { now: () => Date; advance: (ms: number) => void } {
  let nowMs = Date.parse(startIso);
  return {
    now: () => new Date(nowMs),
    advance: (ms) => {
      nowMs += ms;
    },
  };
}

/** Lets promise chains (runner settlement) flush before the next assertion. */
export async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}
