import { describe, expect, it } from 'vitest';

import {
  classifyPullRequest,
  conclusionFor,
  createController,
  mainRequestInput,
  resultMatchesRequest,
  toCiRequest,
  type ControllerConfig,
} from '@/scripts/ci/controller/controller';
import { tupleKey } from '@/scripts/ci/controller/github/evidence-document';
import { HEARTBEAT_ALLOWED_KEYS } from '@/scripts/ci/controller/heartbeat';
import { QueueStore } from '@/scripts/ci/controller/queue/store';
import { extractCiResultDocument, parseCiResult } from '@/scripts/ci/gate/ci-result';

import {
  FakeGitHub,
  REPO_ID,
  SHA_MAIN_A,
  SHA_MAIN_B,
  SHA_MAIN_C,
  SHA_PR2_HEAD,
  SHA_PR2_MERGE,
  SHA_PR_HEAD_X,
  SHA_PR_HEAD_Y,
  SHA_PR_MERGE_Y,
  cancelledResultFor,
  clock,
  completeResultFor,
  controllerConfig,
  fakeAdmission,
  fakeSleepAssertion,
  flush,
  mainHead,
  manualRunner,
  pullRequest,
  recordingHeartbeat,
  trustPolicy,
  type AdmissionState,
} from './helpers';
import { prRequest } from '../contracts/fixtures';

interface HarnessOptions {
  readonly config?: Partial<ControllerConfig>;
  readonly admission?: Partial<AdmissionState>;
  readonly store?: QueueStore;
  readonly ownerToken?: string;
  readonly startIso?: string;
}

function harness(options: HarnessOptions = {}) {
  const time = clock(options.startIso ?? '2026-09-04T10:00:00.000Z');
  const store = options.store ?? new QueueStore({ now: time.now });
  const github = new FakeGitHub();
  const runner = manualRunner();
  const admissionState: AdmissionState = {
    admitted: true,
    mode: 'normal',
    reasons: [],
    ...options.admission,
  };
  const heartbeat = recordingHeartbeat();
  const sleepAssertion = fakeSleepAssertion();
  const config = controllerConfig(options.config);
  const controller = createController({
    config,
    store,
    github,
    runner: runner.runner,
    admission: fakeAdmission(admissionState, time.now),
    heartbeat,
    sleepAssertion,
    now: time.now,
    ownerToken: options.ownerToken ?? 'owner-new',
  });
  return {
    time,
    store,
    github,
    runner,
    admissionState,
    heartbeat,
    sleepAssertion,
    config,
    controller,
  };
}

async function completeJob(
  h: ReturnType<typeof harness>,
  index: number,
  result?: Parameters<typeof h.runner.resolve>[1],
): Promise<void> {
  const job = h.runner.jobs[index];
  if (!job) throw new Error(`no job at index ${index}`);
  h.runner.resolve(job.attemptId, result ?? completeResultFor(job.request));
  await h.controller.waitForIdle();
}

describe('pull request classification', () => {
  const config = controllerConfig();

  it('rejects forks and foreign repositories on metadata alone', () => {
    expect(
      classifyPullRequest(
        pullRequest(1, { headRepositoryId: 999, headRepositoryIsFork: true }),
        config,
      ),
    ).toMatchObject({ kind: 'rejected', reason: expect.stringMatching(/fork/u) });
    expect(classifyPullRequest(pullRequest(1, { headRepositoryId: null }), config).kind).toBe(
      'rejected',
    );
    expect(classifyPullRequest(pullRequest(1, { baseRepositoryId: 999 }), config).kind).toBe(
      'rejected',
    );
  });

  it('routes unknown actors, automation and drafts away from local execution', () => {
    expect(
      classifyPullRequest(pullRequest(1, { author: { login: 'mallory', type: 'User' } }), config),
    ).toMatchObject({
      kind: 'skipped',
      reason: expect.stringMatching(/actor-not-in-local-allowlist/u),
    });
    expect(
      classifyPullRequest(
        pullRequest(1, { author: { login: 'dependabot[bot]', type: 'Bot' } }),
        config,
      ),
    ).toMatchObject({ kind: 'skipped', reason: expect.stringMatching(/automation-identity/u) });
    expect(classifyPullRequest(pullRequest(1, { author: null }), config).kind).toBe('skipped');
    expect(classifyPullRequest(pullRequest(1, { draft: true }), config)).toMatchObject({
      kind: 'skipped',
      reason: 'draft',
    });
    expect(classifyPullRequest(pullRequest(1, { mergeCommitSha: null }), config).kind).toBe(
      'skipped',
    );
    expect(classifyPullRequest(pullRequest(1, { mergeable: false }), config).kind).toBe('skipped');
  });

  it('routes every PR hosted while the trust policy is unconfigured', () => {
    const unconfigured = controllerConfig({
      trustPolicy: trustPolicy({ trustedRepositoryId: 'REPLACE_ME_REPOSITORY_ID' }),
    });
    expect(classifyPullRequest(pullRequest(1), unconfigured)).toMatchObject({
      kind: 'skipped',
      reason: expect.stringMatching(/trust-policy-unconfigured/u),
    });
  });

  it('builds a pr tuple for a trusted, mergeable pull request', () => {
    const ready = classifyPullRequest(pullRequest(7), config);
    expect(ready.kind).toBe('ready');
    if (ready.kind !== 'ready') return;
    expect(ready.input).toMatchObject({
      profile: 'pr',
      prNumber: 7,
      headSha: SHA_PR_HEAD_X,
      testedSha: expect.not.stringMatching(SHA_PR_HEAD_X),
      repositoryId: REPO_ID,
    });
  });

  it('binds results to requests by dedup key and attempt', () => {
    const request = prRequest();
    expect(resultMatchesRequest(completeResultFor(request), request)).toBe(true);
    expect(resultMatchesRequest(completeResultFor(request), { ...request, attempt: 2 })).toBe(
      false,
    );
    expect(
      resultMatchesRequest(completeResultFor({ ...request, headSha: SHA_PR_HEAD_Y }), request),
    ).toBe(false);
    expect(conclusionFor(completeResultFor(request))).toBe('success');
    expect(conclusionFor(cancelledResultFor(request))).toBe('cancelled');
  });
});

describe('controller discovery and dispatch', () => {
  it('enqueues main and trusted PRs, rejects forks before any fetch, and dedups on the next poll', async () => {
    const h = harness();
    h.github.pulls = [
      pullRequest(7),
      pullRequest(8, {
        headSha: SHA_PR2_HEAD,
        mergeCommitSha: SHA_PR2_MERGE,
        headRepositoryId: 424242,
        headRepositoryIsFork: true,
      }),
    ];
    const report = await h.controller.reconcile();
    expect(h.github.calls[0]).toBe('verifyIdentity');
    expect(report.discovery.enqueued).toBe(2);
    expect(report.discovery.rejected).toEqual([
      { prNumber: 8, reason: expect.stringMatching(/fork/u) },
    ]);
    expect(h.github.calls.filter((call) => call.startsWith('getPullRequest'))).toEqual([]);
    expect(h.store.listRequests({ profile: 'pr' }).map((request) => request.prNumber)).toEqual([7]);

    const tick = await h.controller.tick();
    expect(tick.discovery.deduplicated).toBe(2);
    expect(tick.discovery.enqueued).toBe(0);
    expect(tick.dispatched?.profile).toBe('main');
    expect(h.runner.jobs).toHaveLength(1);
    expect(h.runner.jobs[0]?.request).toMatchObject({
      profile: 'main',
      headSha: SHA_MAIN_A,
      attempt: 1,
    });
    expect(h.runner.jobs.some((job) => job.request.prNumber === 8)).toBe(false);
    expect(h.store.listRequests()).toHaveLength(2);
  });

  it('cancels queued attempts for pull requests that were closed', async () => {
    const h = harness();
    h.github.pulls = [pullRequest(7)];
    await h.controller.reconcile();
    const [pr] = h.store.listRequests({ profile: 'pr' });
    h.github.pulls = [];
    await h.controller.tick();
    expect(h.store.listAttempts({ requestId: pr!.id })[0]?.state).toBe('cancelled');
  });

  it('applies main > PR > nightly with the two-main-then-PR fairness rule', async () => {
    const h = harness();
    h.github.pulls = [pullRequest(7)];
    await h.controller.reconcile();
    expect((await h.controller.tick()).dispatched?.profile).toBe('main');
    await completeJob(h, 0);
    h.github.head = mainHead(SHA_MAIN_B);
    expect((await h.controller.tick()).dispatched?.profile).toBe('main');
    await completeJob(h, 1);
    h.github.head = mainHead(SHA_MAIN_C);
    const third = await h.controller.tick();
    expect(third.dispatched?.profile).toBe('pr');
    expect(h.runner.jobs[2]?.request.prNumber).toBe(7);
    await completeJob(h, 2);
    expect((await h.controller.tick()).dispatched?.profile).toBe('main');
    expect(h.runner.jobs[3]?.request.headSha).toBe(SHA_MAIN_C);
  });

  it('defers dispatch while admission fails and resumes when the host is healthy', async () => {
    const h = harness({
      admission: { admitted: false, reasons: ['host is on battery power; AC power required'] },
    });
    await h.controller.reconcile();
    const deferred = await h.controller.tick();
    expect(deferred.dispatched).toBeNull();
    expect(deferred.deferred).toEqual(['host is on battery power; AC power required']);
    expect(h.runner.jobs).toHaveLength(0);
    expect(h.heartbeat.payloads.at(-1)).toMatchObject({
      status: 'idle',
      queueDepth: 1,
      running: 0,
    });
    h.admissionState.admitted = true;
    h.admissionState.reasons = [];
    expect((await h.controller.tick()).dispatched).not.toBeNull();
    expect(h.heartbeat.payloads.at(-1)).toMatchObject({
      status: 'busy',
      running: 1,
      maxConcurrent: 1,
    });
  });

  it('applies a window change to the next job only and never preempts the running one', async () => {
    const h = harness();
    await h.controller.reconcile();
    await h.controller.tick();
    expect(h.runner.jobs[0]?.allocation).toEqual({ cpus: 4, memoryGiB: 8 });
    h.admissionState.mode = 'dedicated';
    const tick = await h.controller.tick();
    expect(tick.preemptRequested).toBe(false);
    expect(h.runner.jobs[0]?.stopSignal()).toBe('continue');
    expect(h.controller.status()).toMatchObject({
      mode: 'dedicated',
      active: { allocation: { cpus: 4, memoryGiB: 8 } },
    });
    await completeJob(h, 0);
    h.github.head = mainHead(SHA_MAIN_B);
    await h.controller.tick();
    expect(h.runner.jobs[1]?.allocation).toEqual({ cpus: 8, memoryGiB: 16 });
    expect(h.runner.jobs[1]?.mode).toBe('dedicated');
  });
});

describe('controller collection and publication', () => {
  it('publishes a complete result as gate evidence exactly once', async () => {
    const h = harness();
    await h.controller.reconcile();
    await h.controller.tick();
    const job = h.runner.jobs[0]!;
    expect(h.github.writes()).toEqual([
      expect.objectContaining({
        status: 'in_progress',
        name: 'Local CI / main',
        headSha: SHA_MAIN_A,
      }),
    ]);
    await completeJob(h, 0);

    const attempt = h.store.getAttempt(job.attemptId);
    expect(attempt?.state).toBe('published');
    expect(h.store.getRequest(attempt!.requestId)?.state).toBe('completed');
    const writes = h.github.writes();
    expect(writes).toHaveLength(2);
    const completed = writes[1]!;
    expect(completed.status).toBe('completed');
    expect(completed.conclusion).toBe('success');
    expect(completed.externalId).toBe(tupleKey(job.request));
    const parsed = parseCiResult(extractCiResultDocument(completed.output?.text));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.result.tuple).toEqual(job.request);
      expect(parsed.result.installationId).toBe(h.config.installationId);
      expect(completed.output?.summary).toContain(parsed.result.evidence.bundleDigest);
    }

    await h.controller.tick();
    await h.controller.reconcile();
    expect(h.github.writes()).toHaveLength(2);
    expect(h.runner.jobs).toHaveLength(1);
    const payload = h.heartbeat.payloads.at(-1)!;
    expect(payload).toMatchObject({ status: 'idle', running: 0, queueDepth: 0 });
    expect(payload.lastCompletedAt).toBeDefined();
    for (const key of Object.keys(payload)) expect(HEARTBEAT_ALLOWED_KEYS.has(key)).toBe(true);
  });

  it('publishes failed results as failure with the same evidence binding', async () => {
    const h = harness();
    await h.controller.reconcile();
    await h.controller.tick();
    const job = h.runner.jobs[0]!;
    h.runner.resolve(job.attemptId, {
      ...completeResultFor(job.request),
      supervisorOutcome: 'failed',
      testInventory: {
        discoveredIds: ['tests/a.test.ts::fails'],
        counts: { discovered: 1, passed: 0, failed: 1, skipped: 0, todo: 0 },
      },
    });
    await h.controller.waitForIdle();
    expect(h.github.completedConclusions()).toEqual(['failure']);
    expect(h.store.getAttempt(job.attemptId)?.state).toBe('published');
  });

  it('never publishes success for an interrupted or incomplete attempt', async () => {
    const h = harness();
    await h.controller.reconcile();
    await h.controller.tick();
    const first = h.runner.jobs[0]!;
    h.runner.reject(
      first.attemptId,
      new Error('executor exited (code=137) without a result document'),
    );
    await h.controller.waitForIdle();
    expect(h.store.getAttempt(first.attemptId)?.state).toBe('failed');
    expect(h.github.completedConclusions()).toEqual([]);

    await h.controller.tick();
    const second = h.runner.jobs[1]!;
    expect(second.request.attempt).toBe(2);
    h.runner.resolve(second.attemptId, { version: 1, supervisorOutcome: 'passed' });
    await h.controller.waitForIdle();
    expect(h.store.getAttempt(second.attemptId)?.state).toBe('failed');
    expect(
      h.store.getRequest(
        second.request.headSha ? h.store.getAttempt(second.attemptId)!.requestId : '',
      )?.state,
    ).toBe('cancelled');
    expect(h.github.completedConclusions()).toEqual(['failure']);
    expect(h.github.completedConclusions()).not.toContain('success');
    expect(h.store.listAttempts().map((attempt) => attempt.state)).toEqual(['failed', 'failed']);
  });

  it('fails an attempt whose result is bound to a different tuple', async () => {
    const h = harness({ config: { maxAttempts: 1 } });
    await h.controller.reconcile();
    await h.controller.tick();
    const job = h.runner.jobs[0]!;
    h.runner.resolve(
      job.attemptId,
      completeResultFor({ ...job.request, headSha: SHA_MAIN_B, testedSha: SHA_MAIN_B }),
    );
    await h.controller.waitForIdle();
    expect(h.store.getAttempt(job.attemptId)?.state).toBe('failed');
    expect(h.github.completedConclusions()).toEqual(['failure']);
  });

  it('publishes failure when a complete result cannot be turned into evidence', async () => {
    const h = harness();
    await h.controller.reconcile();
    await h.controller.tick();
    const job = h.runner.jobs[0]!;
    h.runner.resolve(job.attemptId, completeResultFor(job.request, { evidenceDigests: {} }));
    await h.controller.waitForIdle();
    expect(h.store.getAttempt(job.attemptId)?.state).toBe('published');
    const completed = h.github.writes().find((write) => write.status === 'completed');
    expect(completed?.conclusion).toBe('failure');
    expect(completed?.output?.title).toBe('evidence incomplete');
  });
});

describe('controller supersession and preemption', () => {
  it('cancels a running PR attempt when a newer head arrives and never publishes it as success', async () => {
    const h = harness();
    h.github.pulls = [pullRequest(7)];
    await h.controller.reconcile();
    await h.controller.tick();
    await completeJob(h, 0);
    const prTick = await h.controller.tick();
    expect(prTick.dispatched?.profile).toBe('pr');
    const prJob = h.runner.jobs[1]!;
    expect(prJob.request.headSha).toBe(SHA_PR_HEAD_X);

    h.github.pulls = [pullRequest(7, { headSha: SHA_PR_HEAD_Y, mergeCommitSha: SHA_PR_MERGE_Y })];
    const superseding = await h.controller.tick();
    expect(superseding.discovery.cancelRequested).toBe(1);
    expect(prJob.stopSignal()).toBe('cancel');

    // Even a "passed" document from the killed executor must not become success.
    h.runner.resolve(prJob.attemptId, completeResultFor(prJob.request));
    await h.controller.waitForIdle();
    expect(h.store.getAttempt(prJob.attemptId)?.state).toBe('superseded');
    const oldPublication = h.store.getPublication(h.store.getAttempt(prJob.attemptId)!.requestId);
    expect(oldPublication?.conclusion).toBe('cancelled');
    expect(h.github.completedConclusions()).toEqual(['success', 'cancelled']);

    const next = await h.controller.tick();
    expect(next.dispatched?.profile).toBe('pr');
    expect(h.runner.jobs[2]?.request.headSha).toBe(SHA_PR_HEAD_Y);
  });

  it('preempts nightly only at a safe boundary and re-queues it behind the waiting PR', async () => {
    const h = harness({ config: { nightlyHourLondon: 11 } });
    const report = await h.controller.reconcile();
    expect(report.discovery.enqueued).toBe(2);
    await h.controller.tick();
    await completeJob(h, 0);
    const nightlyTick = await h.controller.tick();
    expect(nightlyTick.dispatched?.profile).toBe('nightly');
    const nightlyJob = h.runner.jobs[1]!;

    h.github.pulls = [pullRequest(7)];
    const preempting = await h.controller.tick();
    expect(preempting.preemptRequested).toBe(true);
    expect(nightlyJob.stopSignal()).toBe('preempt');
    expect(h.store.getAttempt(nightlyJob.attemptId)?.state).toBe('running');

    h.runner.resolve(nightlyJob.attemptId, cancelledResultFor(nightlyJob.request));
    await h.controller.waitForIdle();
    expect(h.store.getAttempt(nightlyJob.attemptId)?.state).toBe('cancelled');
    const nightlyRequestId = h.store.getAttempt(nightlyJob.attemptId)!.requestId;
    expect(
      h.store.listAttempts({ requestId: nightlyRequestId }).map((attempt) => attempt.state),
    ).toEqual(['cancelled', 'queued']);
    expect(h.github.writes().at(-1)).toMatchObject({ status: 'queued' });

    expect((await h.controller.tick()).dispatched?.profile).toBe('pr');
    await completeJob(h, 2);
    expect((await h.controller.tick()).dispatched?.profile).toBe('nightly');
    expect(h.runner.jobs[3]?.request.attempt).toBe(2);
  });
});

describe('controller restart recovery', () => {
  it('releases stale leases, re-queues interrupted attempts and publishes recovered results', async () => {
    const time = clock('2026-09-04T10:00:00.000Z');
    const store = new QueueStore({ now: time.now });
    const config = controllerConfig();
    const interrupted = store.enqueue(mainRequestInput(mainHead(SHA_MAIN_A), config));
    store.acquireLease(interrupted.attempt.id, 'owner-old', 60_000);
    store.transition(interrupted.attempt.id, 'running');

    const prInput = classifyPullRequest(pullRequest(7), config);
    if (prInput.kind !== 'ready') throw new Error('fixture PR should be ready');
    const collected = store.enqueue(prInput.input);
    store.acquireLease(collected.attempt.id, 'owner-old', 60_000);
    store.transition(collected.attempt.id, 'running');
    store.transition(collected.attempt.id, 'collected', {
      result: completeResultFor(toCiRequest(collected.request, collected.attempt)),
    });

    const h = harness({ store, ownerToken: 'owner-new' });
    h.github.pulls = [pullRequest(7)];
    const report = await h.controller.reconcile();
    expect(report.staleLeases).toBe(2);
    expect(report.requeued).toBe(1);
    expect(report.publishedFromCollected).toBe(1);
    expect(store.getAttempt(interrupted.attempt.id)?.state).toBe('failed');
    expect(
      store.listAttempts({ requestId: interrupted.request.id }).map((attempt) => attempt.state),
    ).toEqual(['failed', 'queued']);
    expect(store.getAttempt(collected.attempt.id)?.state).toBe('published');
    expect(h.github.completedConclusions()).toEqual(['success']);
    expect(store.listLeases()).toEqual([]);
    expect(report.discovery.deduplicated).toBe(2);

    const tick = await h.controller.tick();
    expect(tick.dispatched?.profile).toBe('main');
    expect(h.runner.jobs[0]?.request.attempt).toBe(2);
  });

  it('adopts an existing check run for a pending request so updates stay idempotent', async () => {
    const h = harness();
    h.github.existingRunsForSha.set(SHA_MAIN_A, [
      {
        id: 900,
        name: 'Local CI / main',
        headSha: SHA_MAIN_A,
        status: 'in_progress',
        conclusion: null,
        externalId: null,
        appId: 4242,
      },
    ]);
    await h.controller.reconcile();
    // The request is created by discovery during reconcile; adoption happens on the next reconcile.
    const report = await h.controller.reconcile();
    expect(report.adoptedCheckRuns).toBe(1);
    const [request] = h.store.listRequests({ profile: 'main' });
    expect(h.store.getPublication(request!.id)).toMatchObject({
      checkRunId: 900,
      state: 'recovered',
    });
    await h.controller.tick();
    expect(h.github.calls.filter((call) => call.startsWith('createCheckRun'))).toEqual([]);
    expect(h.github.calls.filter((call) => call.startsWith('updateCheckRun:900'))).toHaveLength(1);
  });
});

describe('controller run loop', () => {
  it('reconciles first, holds the sleep assertion, drains on abort and reports draining', async () => {
    const time = clock('2026-09-04T10:00:00.000Z');
    const store = new QueueStore({ now: time.now });
    const github = new FakeGitHub();
    const runner = manualRunner();
    const heartbeat = recordingHeartbeat();
    const sleepAssertion = fakeSleepAssertion();
    const abort = new AbortController();
    const controller = createController({
      config: controllerConfig(),
      store,
      github,
      runner: runner.runner,
      admission: fakeAdmission({ admitted: true, mode: 'normal', reasons: [] }, time.now),
      heartbeat,
      sleepAssertion,
      now: time.now,
      ownerToken: 'owner-run',
      sleep: async () => {
        abort.abort();
      },
    });
    const running = controller.run(abort.signal);
    for (let index = 0; index < 50 && runner.jobs.length === 0; index += 1) await flush();
    expect(runner.jobs).toHaveLength(1);
    expect(sleepAssertion.isActive()).toBe(true);
    runner.resolve(runner.jobs[0]!.attemptId, completeResultFor(runner.jobs[0]!.request));
    await running;
    expect(github.calls[0]).toBe('verifyIdentity');
    expect(sleepAssertion.starts).toBe(1);
    expect(sleepAssertion.stops).toBe(1);
    expect(heartbeat.payloads.map((payload) => payload.status)).toEqual(['busy', 'draining']);
    expect(store.getAttempt(runner.jobs[0]!.attemptId)?.state).toBe('published');
    expect(controller.status().health).toBe('draining');
  });
});
