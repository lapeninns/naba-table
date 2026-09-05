import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createMemoryBackend } from '@/scripts/ci/controller/queue/memory-backend';
import { openSqliteBackend } from '@/scripts/ci/controller/queue/sqlite-backend';
import {
  InvalidAttemptTransitionError,
  canTransition,
} from '@/scripts/ci/controller/queue/state-machine';
import {
  IncompleteResultError,
  LeaseHeldError,
  QueueStore,
  dedupKeyFor,
  type RequestInput,
} from '@/scripts/ci/controller/queue/store';

import {
  CONTROLLER_VERSION,
  REPO_ID,
  SHA_MAIN_A,
  SHA_MAIN_PARENT,
  SHA_PR_HEAD_X,
  SHA_PR_MERGE_X,
  clock,
  completeResultFor,
} from './helpers';
import { POLICY } from '../contracts/fixtures';
import { DIGEST_1 } from '../contracts/fixtures';

const mainInput: RequestInput = {
  repositoryId: REPO_ID,
  profile: 'main',
  headSha: SHA_MAIN_A,
  baseSha: SHA_MAIN_PARENT,
  testedSha: SHA_MAIN_A,
  policyVersion: POLICY,
  imageDigest: DIGEST_1,
  controllerVersion: CONTROLLER_VERSION,
};

const prInput: RequestInput = {
  repositoryId: REPO_ID,
  profile: 'pr',
  prNumber: 7,
  headSha: SHA_PR_HEAD_X,
  baseSha: SHA_MAIN_A,
  testedSha: SHA_PR_MERGE_X,
  policyVersion: POLICY,
  imageDigest: DIGEST_1,
  controllerVersion: CONTROLLER_VERSION,
};

function ciRequestFor(input: RequestInput, attempt: number) {
  return {
    repositoryId: input.repositoryId,
    profile: input.profile,
    ...(input.prNumber === undefined ? {} : { prNumber: input.prNumber }),
    headSha: input.headSha,
    baseSha: input.baseSha,
    testedSha: input.testedSha,
    policyVersion: input.policyVersion,
    imageDigest: input.imageDigest,
    controllerVersion: input.controllerVersion,
    attempt,
  };
}

describe('QueueStore (in-memory backend)', () => {
  it('deduplicates identical requests and keys nightly by dedup scope', () => {
    const store = new QueueStore();
    const first = store.enqueue(mainInput);
    const second = store.enqueue(mainInput);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.request.id).toBe(first.request.id);
    expect(second.attempt.id).toBe(first.attempt.id);
    expect(store.listRequests()).toHaveLength(1);

    const nightlyToday = store.enqueue({
      ...mainInput,
      profile: 'nightly',
      dedupScope: '2026-09-04',
    });
    const nightlyTomorrow = store.enqueue({
      ...mainInput,
      profile: 'nightly',
      dedupScope: '2026-09-05',
    });
    expect(nightlyToday.created).toBe(true);
    expect(nightlyTomorrow.created).toBe(true);
    expect(dedupKeyFor(mainInput)).not.toBe(dedupKeyFor({ ...mainInput, profile: 'nightly' }));
  });

  it('enforces the attempt state machine', () => {
    const store = new QueueStore();
    const { attempt } = store.enqueue(prInput);
    expect(canTransition('queued', 'published')).toBe(false);
    expect(() => store.transition(attempt.id, 'running')).toThrow(InvalidAttemptTransitionError);
    store.acquireLease(attempt.id, 'owner-a', 60_000);
    expect(store.getAttempt(attempt.id)?.state).toBe('leased');
    store.transition(attempt.id, 'running');
    expect(store.getRequest(attempt.requestId)?.state).toBe('active');
    expect(() => store.transition(attempt.id, 'published')).toThrow(InvalidAttemptTransitionError);
  });

  it('refuses collected/published without a complete CiResult', () => {
    const store = new QueueStore();
    const { attempt } = store.enqueue(prInput);
    store.acquireLease(attempt.id, 'owner-a', 60_000);
    store.transition(attempt.id, 'running');
    expect(() => store.transition(attempt.id, 'collected', { result: { partial: true } })).toThrow(
      IncompleteResultError,
    );
    expect(() => store.transition(attempt.id, 'collected')).toThrow(IncompleteResultError);
    const result = completeResultFor(ciRequestFor(prInput, 1));
    const collected = store.transition(attempt.id, 'collected', { result });
    expect(collected.state).toBe('collected');
    const published = store.transition(attempt.id, 'published');
    expect(published.state).toBe('published');
    expect(store.getLease(attempt.id)).toBeUndefined();
    expect(store.getRequest(attempt.requestId)?.state).toBe('completed');
  });

  it('an interrupted running attempt can only fail and be retried, never published', () => {
    const store = new QueueStore();
    const { request, attempt } = store.enqueue(prInput);
    store.acquireLease(attempt.id, 'owner-a', 60_000);
    store.transition(attempt.id, 'running');
    expect(() => store.transition(attempt.id, 'published')).toThrow(InvalidAttemptTransitionError);
    store.transition(attempt.id, 'failed', { reason: 'interrupted' });
    expect(store.getRequest(request.id)?.state).toBe('pending');
    const retry = store.createAttempt(request.id);
    expect(retry.attempt).toBe(2);
    expect(retry.state).toBe('queued');
    expect(() => store.createAttempt(request.id)).toThrow(/already has an open attempt/u);
  });

  it('leases are exclusive until they expire', () => {
    const time = clock('2026-09-04T10:00:00.000Z');
    const store = new QueueStore({ now: time.now });
    const { attempt } = store.enqueue(prInput);
    store.acquireLease(attempt.id, 'owner-a', 60_000);
    expect(() => store.acquireLease(attempt.id, 'owner-b', 60_000)).toThrow(LeaseHeldError);
    expect(() => store.renewLease(attempt.id, 'owner-b', 60_000)).toThrow(LeaseHeldError);
    time.advance(61_000);
    const lease = store.acquireLease(attempt.id, 'owner-b', 60_000);
    expect(lease.owner).toBe('owner-b');
  });

  it('reopens cancelled requests only when nothing was published for them', () => {
    const store = new QueueStore();
    const first = store.enqueue(prInput);
    store.transition(first.attempt.id, 'cancelled', { reason: 'pull request closed' });
    const reopened = store.enqueue(prInput);
    expect(reopened.created).toBe(false);
    expect(reopened.attempt.id).not.toBe(first.attempt.id);
    expect(reopened.request.state).toBe('pending');

    store.transition(reopened.attempt.id, 'cancelled', { reason: 'retries exhausted' });
    store.upsertPublication({
      requestId: first.request.id,
      attemptId: reopened.attempt.id,
      checkName: 'Local CI / pr',
      headSha: prInput.headSha,
      checkRunId: 1,
      state: 'completed',
      conclusion: 'failure',
      updatedAt: '2026-09-04T10:00:00.000Z',
    });
    const again = store.enqueue(prInput);
    expect(again.created).toBe(false);
    expect(again.attempt.id).toBe(reopened.attempt.id);
    expect(again.request.state).toBe('cancelled');
  });

  it('keeps a bounded heartbeat history', () => {
    const store = new QueueStore({ heartbeatRetention: 3 });
    for (let index = 0; index < 5; index += 1) {
      store.recordHeartbeat({ index });
    }
    expect(store.listHeartbeats()).toHaveLength(3);
    expect(store.listHeartbeats().map((record) => record.payload.index)).toEqual([2, 3, 4]);
  });

  it('memory backend clones rows so callers cannot mutate stored state', () => {
    const backend = createMemoryBackend();
    backend.put('counters', 'k', { value: 1 });
    const row = backend.get('counters', 'k');
    if (row) row.value = 99;
    expect(backend.get('counters', 'k')).toEqual({ value: 1 });
  });
});

describe('QueueStore (node:sqlite backend)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('persists requests, attempts, leases and publications across reopen', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'nabatable-ci-queue-'));
    dirs.push(dir);
    const file = path.join(dir, 'queue.sqlite');

    const first = new QueueStore({ backend: await openSqliteBackend(file) });
    const { request, attempt } = first.enqueue(prInput);
    first.acquireLease(attempt.id, 'owner-a', 60_000);
    first.transition(attempt.id, 'running');
    first.upsertPublication({
      requestId: request.id,
      attemptId: attempt.id,
      checkName: 'Local CI / pr',
      headSha: prInput.headSha,
      checkRunId: 55,
      state: 'in_progress',
      updatedAt: '2026-09-04T10:00:00.000Z',
    });
    first.recordHeartbeat({ tick: 1 });
    first.close();

    const second = new QueueStore({ backend: await openSqliteBackend(file) });
    expect(second.getRequest(request.id)?.state).toBe('active');
    expect(second.getAttempt(attempt.id)?.state).toBe('running');
    expect(second.getLease(attempt.id)?.owner).toBe('owner-a');
    expect(second.getPublication(request.id)?.checkRunId).toBe(55);
    expect(second.listHeartbeats()).toHaveLength(1);
    expect(second.enqueue(prInput).created).toBe(false);
    second.close();
  });

  it('rolls back a transaction when the callback throws', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'nabatable-ci-queue-'));
    dirs.push(dir);
    const backend = await openSqliteBackend(path.join(dir, 'queue.sqlite'));
    expect(() =>
      backend.transaction(() => {
        backend.put('counters', 'x', { value: 1 });
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(backend.get('counters', 'x')).toBeUndefined();
    expect(backend.list('counters')).toEqual([]);
    backend.close();
  });
});
