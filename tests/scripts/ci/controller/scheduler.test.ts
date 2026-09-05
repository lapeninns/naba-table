import { describe, expect, it } from 'vitest';

import {
  CONSECUTIVE_MAIN_COUNTER,
  listCandidates,
  preemptionSignal,
  recordDispatch,
  selectNext,
  supersedeOlderRevisions,
} from '@/scripts/ci/controller/queue/scheduler';
import { QueueStore, type RequestInput } from '@/scripts/ci/controller/queue/store';

import {
  CONTROLLER_VERSION,
  REPO_ID,
  SHA_MAIN_A,
  SHA_MAIN_B,
  SHA_MAIN_PARENT,
  SHA_PR2_HEAD,
  SHA_PR2_MERGE,
  SHA_PR_HEAD_X,
  SHA_PR_HEAD_Y,
  SHA_PR_MERGE_X,
  SHA_PR_MERGE_Y,
} from './helpers';
import { DIGEST_1, POLICY } from '../contracts/fixtures';

const base = {
  repositoryId: REPO_ID,
  policyVersion: POLICY,
  imageDigest: DIGEST_1,
  controllerVersion: CONTROLLER_VERSION,
} as const;

const main = (sha: string): RequestInput => ({
  ...base,
  profile: 'main',
  headSha: sha,
  baseSha: SHA_MAIN_PARENT,
  testedSha: sha,
});
const nightly = (sha: string): RequestInput => ({
  ...main(sha),
  profile: 'nightly',
  dedupScope: '2026-09-04',
});
const pr = (number: number, head: string, merge: string): RequestInput => ({
  ...base,
  profile: 'pr',
  prNumber: number,
  headSha: head,
  baseSha: SHA_MAIN_A,
  testedSha: merge,
});

describe('scheduler priority', () => {
  it('orders current main > ready PRs (FIFO) > nightly', () => {
    const store = new QueueStore();
    store.enqueue(nightly(SHA_MAIN_A));
    store.enqueue(pr(7, SHA_PR_HEAD_X, SHA_PR_MERGE_X));
    store.enqueue(pr(8, SHA_PR2_HEAD, SHA_PR2_MERGE));
    store.enqueue(main(SHA_MAIN_A));
    const order = listCandidates(store).map(
      (candidate) => `${candidate.request.profile}:${candidate.request.prNumber ?? '-'}`,
    );
    expect(order).toEqual(['main:-', 'pr:7', 'pr:8', 'nightly:-']);
    expect(selectNext(store)?.request.profile).toBe('main');
  });

  it('services a waiting PR after two consecutive main executions, then returns to main', () => {
    const store = new QueueStore();
    store.enqueue(main(SHA_MAIN_A));
    store.enqueue(pr(7, SHA_PR_HEAD_X, SHA_PR_MERGE_X));
    expect(selectNext(store)?.request.profile).toBe('main');
    recordDispatch(store, 'main');
    expect(selectNext(store)?.request.profile).toBe('main');
    recordDispatch(store, 'main');
    expect(store.getCounter(CONSECUTIVE_MAIN_COUNTER)).toBe(2);
    expect(selectNext(store)?.request.profile).toBe('pr');
    recordDispatch(store, 'pr');
    expect(store.getCounter(CONSECUTIVE_MAIN_COUNTER)).toBe(0);
    expect(selectNext(store)?.request.profile).toBe('main');
  });

  it('prefers the newest main push and supersedes older queued main pushes', () => {
    const store = new QueueStore();
    const older = store.enqueue(main(SHA_MAIN_A));
    const newer = store.enqueue(main(SHA_MAIN_B));
    const outcomes = supersedeOlderRevisions(store, newer.request);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.action).toBe('superseded');
    expect(store.getAttempt(older.attempt.id)?.state).toBe('superseded');
    expect(store.getRequest(older.request.id)?.state).toBe('superseded');
    expect(selectNext(store)?.request.headSha).toBe(SHA_MAIN_B);
  });

  it('cancels superseded PR revisions: queued -> superseded, running -> cancel signal', () => {
    const store = new QueueStore();
    const queued = store.enqueue(pr(7, SHA_PR_HEAD_X, SHA_PR_MERGE_X));
    const otherPr = store.enqueue(pr(8, SHA_PR2_HEAD, SHA_PR2_MERGE));
    const newer = store.enqueue(pr(7, SHA_PR_HEAD_Y, SHA_PR_MERGE_Y));
    let outcomes = supersedeOlderRevisions(store, newer.request);
    expect(outcomes.map((outcome) => outcome.action)).toEqual(['superseded']);
    expect(store.getAttempt(queued.attempt.id)?.state).toBe('superseded');
    expect(store.getAttempt(otherPr.attempt.id)?.state).toBe('queued');

    const running = store.enqueue(pr(9, SHA_PR_HEAD_X, SHA_PR_MERGE_X));
    store.acquireLease(running.attempt.id, 'owner', 60_000);
    store.transition(running.attempt.id, 'running');
    const replacement = store.enqueue(pr(9, SHA_PR_HEAD_Y, SHA_PR_MERGE_Y));
    outcomes = supersedeOlderRevisions(store, replacement.request);
    expect(outcomes.map((outcome) => outcome.action)).toEqual(['cancel-requested']);
    expect(store.getAttempt(running.attempt.id)?.state).toBe('running');
    expect(store.getAttempt(running.attempt.id)?.stop).toBe('cancel');
  });

  it('lets an in-flight main run finish when a newer main push arrives', () => {
    const store = new QueueStore();
    const running = store.enqueue(main(SHA_MAIN_A));
    store.acquireLease(running.attempt.id, 'owner', 60_000);
    store.transition(running.attempt.id, 'running');
    const newer = store.enqueue(main(SHA_MAIN_B));
    expect(supersedeOlderRevisions(store, newer.request)).toEqual([]);
    expect(store.getAttempt(running.attempt.id)?.stop).toBe('continue');
  });

  it('preempts nightly only when main or PR work is waiting', () => {
    const store = new QueueStore();
    const night = store.enqueue(nightly(SHA_MAIN_A));
    store.acquireLease(night.attempt.id, 'owner', 60_000);
    store.transition(night.attempt.id, 'running');
    expect(preemptionSignal(store, night.request)).toBe('continue');
    store.enqueue(pr(7, SHA_PR_HEAD_X, SHA_PR_MERGE_X));
    expect(preemptionSignal(store, night.request)).toBe('preempt');

    const mainRun = store.enqueue(main(SHA_MAIN_A));
    expect(preemptionSignal(store, mainRun.request)).toBe('continue');
  });
});
