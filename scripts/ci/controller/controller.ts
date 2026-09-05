import type { AdmissionDecision, AdmissionEvaluator } from './admission/policy';
import type { SleepAssertion } from './caffeinate';
import type {
  CheckRunConclusion,
  CheckRunInput,
  CommitSummary,
  GitHubClient,
  PullRequestSummary,
} from './github/client';
import {
  buildEvidenceDocument,
  formatEvidenceDocument,
  tupleKey,
} from './github/evidence-document';
import type { HeartbeatEmitter } from './heartbeat';
import { createSilentLogger, type ControllerLogger } from './log';
import {
  preemptionSignal,
  recordDispatch,
  selectNext,
  supersedeOlderRevisions,
} from './queue/scheduler';
import type { AttemptRecord, QueueStore, RequestInput, RequestRecord } from './queue/store';
import {
  ACTIVE_RUNTIME,
  CANDIDATE_RUNTIME,
  isCompleteCiResult,
  localCheckName,
  type AdmissionMode,
  type Allocation,
  type CiRequest,
  type CiResult,
  type ControllerHealth,
  type ControllerHeartbeatPayload,
  type Runner,
  type RunnerJob,
} from './types';
import { classifyWithReason, dedupKey, type TrustPolicy } from '../contracts';

export interface ControllerConfig {
  readonly controllerId: string;
  readonly controllerVersion: string;
  readonly repositoryId: number;
  /** Installation of `nabatable-local-ci` on the repository; pinned into the evidence document. */
  readonly installationId: number;
  readonly defaultBranch: string;
  /** Policy version stamped into every request tuple, per profile. */
  readonly policyVersions: Readonly<Record<CiRequest['profile'], string>>;
  readonly imageDigest: string;
  readonly leaseTtlMs: number;
  readonly maxAttempts: number;
  /** London hour at which the nightly profile is enqueued once per day. */
  readonly nightlyHourLondon: number;
  readonly skipDraftPullRequests: boolean;
  /** Actor/repository trust policy (config/ci/trust-policy.json). */
  readonly trustPolicy: TrustPolicy;
}

export interface ControllerDeps {
  readonly config: ControllerConfig;
  readonly store: QueueStore;
  readonly github: GitHubClient;
  readonly runner: Runner;
  readonly admission: AdmissionEvaluator;
  readonly heartbeat: HeartbeatEmitter;
  readonly sleepAssertion: SleepAssertion;
  readonly logger?: ControllerLogger;
  readonly now?: () => Date;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Unique per process start; leases from any other owner are stale. */
  readonly ownerToken?: string;
}

export type PullRequestClassification =
  | { readonly kind: 'ready'; readonly input: RequestInput }
  | { readonly kind: 'rejected'; readonly reason: string }
  | { readonly kind: 'skipped'; readonly reason: string };

export interface DiscoveryReport {
  readonly enqueued: number;
  readonly deduplicated: number;
  readonly rejected: readonly { readonly prNumber: number; readonly reason: string }[];
  readonly skipped: readonly { readonly prNumber: number; readonly reason: string }[];
  readonly superseded: number;
  readonly cancelRequested: number;
  readonly error?: string;
}

export interface ReconcileReport {
  readonly staleLeases: number;
  readonly requeued: number;
  readonly publishedFromCollected: number;
  readonly closedPullRequestsCancelled: number;
  readonly adoptedCheckRuns: number;
  readonly discovery: DiscoveryReport;
}

export interface TickReport {
  readonly admission: AdmissionDecision;
  readonly discovery: DiscoveryReport;
  readonly dispatched: { readonly attemptId: string; readonly profile: string } | null;
  readonly deferred: readonly string[];
  readonly collected: string | null;
  readonly preemptRequested: boolean;
  readonly heartbeat: ControllerHeartbeatPayload;
}

export interface ControllerStatus {
  readonly active: {
    readonly attemptId: string;
    readonly requestId: string;
    readonly profile: string;
    readonly prNumber?: number;
    readonly headSha: string;
    readonly mode: AdmissionMode;
    readonly allocation: Allocation;
    readonly startedAt: string;
  } | null;
  readonly mode: AdmissionMode | null;
  readonly health: ControllerHealth;
  readonly lastReconcileAt: string | null;
  readonly lastTickAt: string | null;
  readonly lastCompletedAt: string | null;
}

export interface Controller {
  reconcile(): Promise<ReconcileReport>;
  tick(): Promise<TickReport>;
  run(signal: AbortSignal): Promise<void>;
  waitForIdle(): Promise<void>;
  status(): ControllerStatus;
}

interface ActiveJob {
  readonly attemptId: string;
  readonly request: RequestRecord;
  readonly attempt: AttemptRecord;
  readonly mode: AdmissionMode;
  readonly allocation: Allocation;
  readonly startedAt: string;
  readonly promise: Promise<void>;
  outcome:
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly error: unknown }
    | null;
}

export function classifyPullRequest(
  pr: PullRequestSummary,
  config: Pick<
    ControllerConfig,
    | 'repositoryId'
    | 'policyVersions'
    | 'imageDigest'
    | 'controllerVersion'
    | 'skipDraftPullRequests'
    | 'trustPolicy'
  >,
): PullRequestClassification {
  // Everything here is metadata from the pull-request list. Nothing from the
  // head repository is ever fetched for a rejected or skipped PR.
  if (pr.headRepositoryId === null || pr.baseRepositoryId === null) {
    return { kind: 'rejected', reason: 'head or base repository unknown (deleted fork?)' };
  }
  if (pr.headRepositoryId !== config.repositoryId || pr.headRepositoryIsFork === true) {
    return { kind: 'rejected', reason: `head repository ${pr.headRepositoryId} is a fork` };
  }
  if (pr.baseRepositoryId !== config.repositoryId) {
    return { kind: 'rejected', reason: 'base repository is not the configured repository' };
  }
  if (pr.author === null) {
    return { kind: 'skipped', reason: 'author unknown; routed to hosted CI' };
  }
  let route: ReturnType<typeof classifyWithReason>;
  try {
    route = classifyWithReason(
      {
        baseRepositoryId: pr.baseRepositoryId,
        headRepositoryId: pr.headRepositoryId,
        actor: pr.author,
        event: 'pull_request',
      },
      config.trustPolicy,
    );
  } catch (error) {
    return {
      kind: 'skipped',
      reason: `trust classification failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (route.route === 'reject-fork') return { kind: 'rejected', reason: route.reason };
  if (route.route !== 'local') return { kind: 'skipped', reason: `${route.reason}; routed hosted` };
  if (config.skipDraftPullRequests && pr.draft) return { kind: 'skipped', reason: 'draft' };
  if (pr.mergeable === false) return { kind: 'skipped', reason: 'not mergeable' };
  if (pr.mergeCommitSha === null) return { kind: 'skipped', reason: 'merge commit not ready' };
  if (pr.mergeCommitSha === pr.headSha) {
    return { kind: 'skipped', reason: 'merge commit equals head; synthetic merge not ready' };
  }
  return {
    kind: 'ready',
    input: {
      repositoryId: config.repositoryId,
      profile: 'pr',
      prNumber: pr.number,
      headSha: pr.headSha,
      baseSha: pr.baseSha,
      testedSha: pr.mergeCommitSha,
      policyVersion: config.policyVersions.pr,
      imageDigest: config.imageDigest,
      controllerVersion: config.controllerVersion,
    },
  };
}

export function mainRequestInput(
  head: CommitSummary,
  config: Pick<
    ControllerConfig,
    'repositoryId' | 'policyVersions' | 'imageDigest' | 'controllerVersion'
  >,
): RequestInput {
  return {
    repositoryId: config.repositoryId,
    profile: 'main',
    headSha: head.sha,
    baseSha: head.parents[0] ?? head.sha,
    testedSha: head.sha,
    policyVersion: config.policyVersions.main,
    imageDigest: config.imageDigest,
    controllerVersion: config.controllerVersion,
  };
}

export function nightlyRequestInput(
  head: CommitSummary,
  isoDate: string,
  config: Pick<
    ControllerConfig,
    'repositoryId' | 'policyVersions' | 'imageDigest' | 'controllerVersion'
  >,
): RequestInput {
  return {
    ...mainRequestInput(head, config),
    profile: 'nightly',
    policyVersion: config.policyVersions.nightly,
    dedupScope: isoDate,
  };
}

export function conclusionFor(result: CiResult): CheckRunConclusion {
  if (result.supervisorOutcome === 'passed') return 'success';
  if (result.supervisorOutcome === 'cancelled') return 'cancelled';
  return 'failure';
}

function summaryFor(request: CiRequest, result: CiResult, bundleDigest: string): string {
  const suites = result.timings.suites;
  const passed = suites.filter((suite) => suite.outcome === 'passed').length;
  const failed = suites.filter(
    (suite) => suite.outcome !== 'passed' && suite.outcome !== 'skipped',
  ).length;
  const skipped = suites.filter((suite) => suite.outcome === 'skipped').length;
  const { counts } = result.testInventory;
  return [
    `Outcome: ${result.supervisorOutcome}`,
    `Profile: ${request.profile}`,
    `Tested SHA: ${request.testedSha}`,
    `Head SHA: ${request.headSha}`,
    `Base SHA: ${request.baseSha}`,
    `Policy version: ${request.policyVersion}`,
    `Image digest: ${request.imageDigest}`,
    `Controller version: ${request.controllerVersion}`,
    `Attempt: ${request.attempt}`,
    `Suites: ${passed} passed, ${failed} failed, ${skipped} skipped, ${suites.length} total`,
    `Tests: ${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped, ${counts.todo} todo, ${counts.discovered} discovered`,
    `Evidence bundle digest: ${bundleDigest}`,
    `Runtime: ${result.runtime.activeRuntime} (node ${result.runtime.nodeVersion}, pnpm ${result.runtime.pnpmVersion}); candidate ${CANDIDATE_RUNTIME}`,
    `Duration: ${result.timings.durationMs} ms`,
  ].join('\n');
}

export function toCiRequest(request: RequestRecord, attempt: AttemptRecord): CiRequest {
  return {
    repositoryId: request.repositoryId,
    profile: request.profile,
    ...(request.prNumber === undefined ? {} : { prNumber: request.prNumber }),
    headSha: request.headSha,
    baseSha: request.baseSha,
    testedSha: request.testedSha,
    policyVersion: request.policyVersion,
    imageDigest: request.imageDigest,
    controllerVersion: request.controllerVersion,
    attempt: attempt.attempt,
  };
}

/** A result is bound to a request by the contract dedup key (which includes the attempt). */
export function resultMatchesRequest(result: CiResult, expected: CiRequest): boolean {
  return result.attempt === expected.attempt && result.dedupKey === dedupKey(expected);
}

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done(): void {
      signal?.removeEventListener('abort', done);
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });

export function createController(deps: ControllerDeps): Controller {
  const { config, store, github, runner } = deps;
  const logger = deps.logger ?? createSilentLogger();
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;
  const owner = deps.ownerToken ?? `${config.controllerId}:${process.pid}:${now().getTime()}`;

  let active: ActiveJob | null = null;
  let currentMode: AdmissionMode | null = null;
  let lastReconcileAt: string | null = null;
  let lastTickAt: string | null = null;
  let lastCompletedAt: string | null = null;
  let draining = false;
  let lock: Promise<void> = Promise.resolve();

  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = lock.then(fn, fn);
    lock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const health = (): ControllerHealth => (draining ? 'draining' : active ? 'busy' : 'idle');

  // ------------------------------------------------------------ publication

  async function publish(
    request: RequestRecord,
    attempt: AttemptRecord,
    input: Omit<CheckRunInput, 'name' | 'headSha'>,
    evidenceDigest?: string,
  ): Promise<void> {
    const existing = store.getPublication(request.id);
    const checkName = localCheckName(request.profile);
    const isNoop =
      existing !== undefined &&
      existing.checkRunId !== null &&
      existing.state === 'completed' &&
      input.status === 'completed' &&
      existing.conclusion === input.conclusion &&
      existing.externalId === input.externalId &&
      existing.evidenceDigest === evidenceDigest;
    if (isNoop) return;
    const checkRun =
      existing && existing.checkRunId !== null
        ? await github.updateCheckRun(existing.checkRunId, input)
        : await github.createCheckRun({ ...input, name: checkName, headSha: request.headSha });
    store.upsertPublication({
      requestId: request.id,
      attemptId: attempt.id,
      checkName,
      headSha: request.headSha,
      checkRunId: checkRun.id,
      state: input.status === 'completed' ? 'completed' : 'in_progress',
      ...(input.conclusion === undefined ? {} : { conclusion: input.conclusion }),
      ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
      ...(evidenceDigest === undefined ? {} : { evidenceDigest }),
      updatedAt: now().toISOString(),
    });
  }

  /**
   * Publishes a complete result. The evidence document is what the release
   * gate consumes; when it cannot be built the check is published as a
   * failure with the reason, never as success.
   */
  async function publishResult(
    request: RequestRecord,
    attempt: AttemptRecord,
    result: CiResult,
  ): Promise<void> {
    const ciRequest = toCiRequest(request, attempt);
    const externalId = tupleKey(ciRequest);
    const evidence = buildEvidenceDocument({
      tuple: ciRequest,
      result,
      installationId: config.installationId,
    });
    if (!evidence.ok) {
      logger.error('publish.evidence_incomplete', {
        attemptId: attempt.id,
        reason: evidence.reason,
      });
      await publish(request, attempt, {
        status: 'completed',
        conclusion: 'failure',
        externalId,
        output: {
          title: 'evidence incomplete',
          summary: `The executor result could not be turned into gate evidence: ${evidence.reason}`,
        },
      });
      return;
    }
    const bundleDigest = evidence.document.evidence.bundleDigest;
    await publish(
      request,
      attempt,
      {
        status: 'completed',
        conclusion: conclusionFor(result),
        externalId,
        output: {
          title: `${result.supervisorOutcome} (${result.timings.suites.length} suites)`,
          summary: summaryFor(ciRequest, result, bundleDigest),
          text: formatEvidenceDocument(evidence.document),
        },
      },
      bundleDigest,
    );
  }

  async function publishTerminal(
    request: RequestRecord,
    attempt: AttemptRecord,
    conclusion: CheckRunConclusion,
    title: string,
    summary: string,
  ): Promise<void> {
    await publish(request, attempt, {
      status: 'completed',
      conclusion,
      externalId: tupleKey(toCiRequest(request, attempt)),
      output: { title, summary },
    });
  }

  // ---------------------------------------------------------------- retries

  async function failAttempt(
    request: RequestRecord,
    attempt: AttemptRecord,
    reason: string,
  ): Promise<void> {
    store.transition(attempt.id, 'failed', { reason });
    if (attempt.attempt < config.maxAttempts) {
      const next = store.createAttempt(request.id);
      logger.warn('attempt.requeued', {
        requestId: request.id,
        attempt: next.attempt,
        reason,
      });
      return;
    }
    store.setRequestState(request.id, 'cancelled', `retries exhausted: ${reason}`);
    await publishTerminal(
      request,
      attempt,
      'failure',
      'no complete result',
      `The local controller could not obtain a complete result after ${attempt.attempt} attempt(s). Last reason: ${reason}`,
    );
    logger.error('attempt.exhausted', { requestId: request.id, reason });
  }

  // -------------------------------------------------------------- discovery

  async function discover(clockIsoDate: string, clockHour: number): Promise<DiscoveryReport> {
    let enqueued = 0;
    let deduplicated = 0;
    let superseded = 0;
    let cancelRequested = 0;
    const rejected: { prNumber: number; reason: string }[] = [];
    const skipped: { prNumber: number; reason: string }[] = [];

    const enqueue = (input: RequestInput): RequestRecord => {
      const result = store.enqueue(input);
      if (result.created) {
        enqueued += 1;
        for (const outcome of supersedeOlderRevisions(store, result.request)) {
          if (outcome.action === 'superseded') superseded += 1;
          else cancelRequested += 1;
        }
        logger.info('request.enqueued', {
          requestId: result.request.id,
          profile: input.profile,
          prNumber: input.prNumber ?? null,
          headSha: input.headSha,
        });
      } else {
        deduplicated += 1;
      }
      return result.request;
    };

    try {
      const head = await github.getBranchHead(config.defaultBranch);
      enqueue(mainRequestInput(head, config));
      if (clockHour === config.nightlyHourLondon) {
        enqueue(nightlyRequestInput(head, clockIsoDate, config));
      }
      const pulls = await github.listOpenPullRequests();
      for (const pr of pulls) {
        const classification = classifyPullRequest(pr, config);
        if (classification.kind === 'ready') {
          enqueue(classification.input);
        } else if (classification.kind === 'rejected') {
          rejected.push({ prNumber: pr.number, reason: classification.reason });
          logger.warn('pull_request.rejected', {
            prNumber: pr.number,
            reason: classification.reason,
          });
        } else {
          skipped.push({ prNumber: pr.number, reason: classification.reason });
        }
      }
      cancelClosedPullRequests(new Set(pulls.map((pr) => pr.number)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('discovery.failed', { error: message });
      return {
        enqueued,
        deduplicated,
        rejected,
        skipped,
        superseded,
        cancelRequested,
        error: message,
      };
    }
    return { enqueued, deduplicated, rejected, skipped, superseded, cancelRequested };
  }

  let closedCancelled = 0;
  function cancelClosedPullRequests(openNumbers: ReadonlySet<number>): void {
    for (const request of store.listRequests({ profile: 'pr', state: 'pending' })) {
      if (request.prNumber !== undefined && !openNumbers.has(request.prNumber)) {
        for (const attempt of store.listAttempts({ requestId: request.id, state: 'queued' })) {
          store.transition(attempt.id, 'cancelled', { reason: 'pull request closed' });
          closedCancelled += 1;
        }
      }
    }
  }

  // --------------------------------------------------------------- dispatch

  async function dispatch(
    request: RequestRecord,
    attempt: AttemptRecord,
    decision: AdmissionDecision,
  ): Promise<ActiveJob> {
    store.acquireLease(attempt.id, owner, config.leaseTtlMs);
    const running = store.transition(attempt.id, 'running');
    recordDispatch(store, request.profile);
    const ciRequest = toCiRequest(request, running);
    const startedAt = now().toISOString();
    try {
      await publish(request, running, {
        status: 'in_progress',
        externalId: tupleKey(ciRequest),
        output: { title: 'running', summary: `Attempt ${running.attempt} started at ${startedAt}` },
      });
    } catch (error) {
      logger.warn('publish.in_progress_failed', {
        attemptId: attempt.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const job: RunnerJob = {
      attemptId: attempt.id,
      request: ciRequest,
      mode: decision.mode,
      allocation: decision.allocation,
      stopSignal: () => store.getAttempt(attempt.id)?.stop ?? 'cancel',
      touch: () => {
        try {
          store.renewLease(attempt.id, owner, config.leaseTtlMs);
        } catch (error) {
          logger.warn('lease.renew_failed', {
            attemptId: attempt.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    };
    const jobRef: { current: ActiveJob | null } = { current: null };
    const promise = Promise.resolve()
      .then(() => runner(job))
      .then(
        (value) => {
          if (jobRef.current) jobRef.current.outcome = { ok: true, value };
        },
        (error: unknown) => {
          if (jobRef.current) jobRef.current.outcome = { ok: false, error };
        },
      );
    const activeJob: ActiveJob = {
      attemptId: attempt.id,
      request,
      attempt: running,
      mode: decision.mode,
      allocation: decision.allocation,
      startedAt,
      promise,
      outcome: null,
    };
    jobRef.current = activeJob;
    logger.info('attempt.dispatched', {
      attemptId: attempt.id,
      requestId: request.id,
      profile: request.profile,
      prNumber: request.prNumber ?? null,
      headSha: request.headSha,
      mode: decision.mode,
      allocation: decision.allocation,
    });
    return activeJob;
  }

  // ---------------------------------------------------------------- collect

  async function collect(job: ActiveJob): Promise<void> {
    const outcome = job.outcome;
    if (!outcome) return;
    active = null;
    lastCompletedAt = now().toISOString();
    const request = store.getRequest(job.request.id) ?? job.request;
    const attempt = store.getAttempt(job.attemptId);
    if (!attempt) return;
    if (attempt.state !== 'running') {
      logger.warn('collect.unexpected_state', { attemptId: attempt.id, state: attempt.state });
      return;
    }
    const expected = toCiRequest(request, attempt);

    // A superseded revision is finalised regardless of what the executor
    // produced: its result must never become a success check.
    if (attempt.stop === 'cancel') {
      store.transition(attempt.id, 'superseded', { reason: 'superseded by newer revision' });
      await publishTerminal(
        request,
        attempt,
        'cancelled',
        'superseded',
        'A newer revision of this pull request replaced this run.',
      );
      return;
    }

    if (!outcome.ok) {
      const message =
        outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
      await failAttempt(request, attempt, `executor error: ${message}`);
      return;
    }
    if (!isCompleteCiResult(outcome.value)) {
      await failAttempt(request, attempt, 'executor returned an incomplete result');
      return;
    }
    const result = outcome.value;
    if (!resultMatchesRequest(result, expected)) {
      await failAttempt(
        request,
        attempt,
        'executor result does not match the dispatched request tuple',
      );
      return;
    }

    if (result.supervisorOutcome === 'cancelled') {
      if (attempt.stop === 'preempt') {
        store.transition(attempt.id, 'cancelled', { reason: 'preempted at safe boundary' });
        const next = store.createAttempt(request.id);
        logger.info('attempt.preempted', { requestId: request.id, nextAttempt: next.attempt });
        await publish(request, next, {
          status: 'queued',
          externalId: tupleKey(toCiRequest(request, next)),
          output: { title: 'queued', summary: 'Preempted at a safe boundary; re-queued.' },
        });
        return;
      }
      store.transition(attempt.id, 'cancelled', { reason: 'cancelled by executor' });
      await publishTerminal(
        request,
        attempt,
        'cancelled',
        'cancelled',
        'The executor cancelled this run before completion.',
      );
      return;
    }
    if (
      result.supervisorOutcome === 'infrastructure-error' &&
      attempt.attempt < config.maxAttempts
    ) {
      await failAttempt(request, attempt, 'infrastructure error reported by the executor');
      return;
    }
    const collected = store.transition(attempt.id, 'collected', { result });
    await publishResult(request, collected, result);
    store.transition(attempt.id, 'published');
    logger.info('attempt.published', {
      attemptId: attempt.id,
      requestId: request.id,
      outcome: result.supervisorOutcome,
    });
  }

  // -------------------------------------------------------------- heartbeat

  function heartbeatPayload(): ControllerHeartbeatPayload {
    const queued = store.listAttempts({ state: 'queued' }).length;
    return {
      controllerId: config.controllerId,
      controllerVersion: config.controllerVersion,
      imageDigest: config.imageDigest,
      activeRuntime: ACTIVE_RUNTIME,
      candidateRuntime: CANDIDATE_RUNTIME,
      status: health(),
      sentAt: now().toISOString(),
      queueDepth: queued,
      running: active ? 1 : 0,
      maxConcurrent: 1,
      ...(lastCompletedAt === null ? {} : { lastCompletedAt }),
    };
  }

  async function heartbeat(
    decision: AdmissionDecision | null,
  ): Promise<ControllerHeartbeatPayload> {
    const payload = heartbeatPayload();
    store.recordHeartbeat({
      ...payload,
      mode: decision?.mode ?? null,
      admitted: decision?.admitted ?? null,
      deferReasons: decision?.reasons ?? [],
      sleepAssertion: deps.sleepAssertion.isActive(),
      lastReconcileAt,
    });
    await deps.heartbeat.emit(payload);
    return payload;
  }

  // -------------------------------------------------------------- reconcile

  async function reconcileImpl(): Promise<ReconcileReport> {
    await github.verifyIdentity();
    let staleLeases = 0;
    let requeued = 0;
    let publishedFromCollected = 0;
    const nowMs = now().getTime();

    for (const lease of store.listLeases()) {
      const stale = lease.owner !== owner || Date.parse(lease.expiresAt) <= nowMs;
      if (!stale) continue;
      staleLeases += 1;
      store.releaseLease(lease.attemptId);
    }
    for (const attempt of store.listAttempts({ states: ['leased', 'running', 'collected'] })) {
      if (active?.attemptId === attempt.id) continue;
      const request = store.getRequest(attempt.requestId);
      if (!request) continue;
      if (attempt.state === 'collected' && isCompleteCiResult(attempt.result)) {
        await publishResult(request, attempt, attempt.result);
        store.transition(attempt.id, 'published');
        publishedFromCollected += 1;
        continue;
      }
      const before = store.listAttempts({ requestId: request.id }).length;
      await failAttempt(
        request,
        attempt,
        'interrupted: controller restarted while attempt was in flight',
      );
      if (store.listAttempts({ requestId: request.id }).length > before) requeued += 1;
    }

    const adoptedCheckRuns = await adoptExistingCheckRuns();
    closedCancelled = 0;
    const decision = await deps.admission();
    const discovery = await discover(decision.clock.isoDate, decision.clock.hour);
    lastReconcileAt = now().toISOString();
    const report: ReconcileReport = {
      staleLeases,
      requeued,
      publishedFromCollected,
      closedPullRequestsCancelled: closedCancelled,
      adoptedCheckRuns,
      discovery,
    };
    logger.info('controller.reconciled', { ...report });
    return report;
  }

  async function adoptExistingCheckRuns(): Promise<number> {
    let adopted = 0;
    for (const request of store.listRequests({ state: 'pending' })) {
      if (store.getPublication(request.id)) continue;
      const checkName = localCheckName(request.profile);
      const runs = await github.listCheckRunsForSha(request.headSha, checkName);
      const match = runs.find((run) => run.name === checkName);
      if (!match) continue;
      const attempt = store.listAttempts({ requestId: request.id }).at(-1);
      if (!attempt) continue;
      // Adopt the id so updates stay idempotent; never treat a prior completed
      // run as evidence that this request is done.
      store.upsertPublication({
        requestId: request.id,
        attemptId: attempt.id,
        checkName,
        headSha: request.headSha,
        checkRunId: match.id,
        state: 'recovered',
        updatedAt: now().toISOString(),
      });
      adopted += 1;
    }
    return adopted;
  }

  // ------------------------------------------------------------------- tick

  async function tickImpl(): Promise<TickReport> {
    const decision = await deps.admission();
    if (currentMode !== null && currentMode !== decision.mode) {
      logger.info('admission.mode_changed', {
        from: currentMode,
        to: decision.mode,
        appliesTo: active ? 'next job (running job keeps its allocation)' : 'next job',
      });
    }
    currentMode = decision.mode;

    closedCancelled = 0;
    const discovery = await discover(decision.clock.isoDate, decision.clock.hour);

    let collected: string | null = null;
    let preemptRequested = false;
    if (active) {
      if (active.outcome) {
        collected = active.attemptId;
        await collect(active);
      } else {
        const signal = preemptionSignal(store, active.request);
        const current = store.getAttempt(active.attemptId);
        if (signal === 'preempt' && current?.stop === 'continue') {
          store.requestStop(active.attemptId, 'preempt');
          preemptRequested = true;
          logger.info('attempt.preempt_requested', { attemptId: active.attemptId });
        }
        try {
          store.renewLease(active.attemptId, owner, config.leaseTtlMs);
        } catch (error) {
          logger.warn('lease.renew_failed', {
            attemptId: active.attemptId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    let dispatched: TickReport['dispatched'] = null;
    let deferred: readonly string[] = [];
    if (!active && !draining) {
      if (!decision.admitted) {
        deferred = decision.reasons;
        if (selectNext(store)) logger.info('admission.deferred', { reasons: decision.reasons });
      } else {
        const candidate = selectNext(store);
        if (candidate) {
          active = await dispatch(candidate.request, candidate.attempt, decision);
          dispatched = { attemptId: candidate.attempt.id, profile: candidate.request.profile };
        }
      }
    }

    lastTickAt = now().toISOString();
    const heartbeatSent = await heartbeat(decision);
    return {
      admission: decision,
      discovery,
      dispatched,
      deferred,
      collected,
      preemptRequested,
      heartbeat: heartbeatSent,
    };
  }

  async function waitForIdleImpl(): Promise<void> {
    const job = active;
    if (!job) return;
    await job.promise;
    await serialized(async () => {
      if (active?.attemptId === job.attemptId && active.outcome) await collect(active);
    });
  }

  const controller: Controller = {
    reconcile: () => serialized(reconcileImpl),
    tick: () => serialized(tickImpl),
    waitForIdle: waitForIdleImpl,
    status: () => ({
      active: active
        ? {
            attemptId: active.attemptId,
            requestId: active.request.id,
            profile: active.request.profile,
            ...(active.request.prNumber === undefined ? {} : { prNumber: active.request.prNumber }),
            headSha: active.request.headSha,
            mode: active.mode,
            allocation: active.allocation,
            startedAt: active.startedAt,
          }
        : null,
      mode: currentMode,
      health: health(),
      lastReconcileAt,
      lastTickAt,
      lastCompletedAt,
    }),
    run: async (signal) => {
      await controller.reconcile();
      deps.sleepAssertion.start();
      try {
        while (!signal.aborted) {
          try {
            await controller.tick();
          } catch (error) {
            logger.error('tick.failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          await sleep(github.pollDelayMs(), signal);
        }
        draining = true;
        if (active) {
          logger.info('controller.draining', { attemptId: active.attemptId });
          await heartbeat(null);
          await waitForIdleImpl();
        }
      } finally {
        deps.sleepAssertion.stop();
      }
    },
  };
  return controller;
}
