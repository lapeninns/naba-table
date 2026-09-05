import type { AttemptRecord, QueueStore, RequestRecord } from './store';
import type { CiProfile, StopSignal } from '../types';

/**
 * Scheduling policy:
 *  1. current main (newest main push) > ready PRs (FIFO) > nightly
 *  2. after two consecutive main executions a waiting PR is serviced first
 *  3. superseded PR revisions (same PR, newer head) are cancelled; older
 *     queued main pushes are superseded by the newest one
 *  4. nightly is preempted only at safe boundaries (the executor polls the
 *     stop signal between suites) and only for main/PR work
 */
export const CONSECUTIVE_MAIN_COUNTER = 'consecutive_main_runs';
export const MAIN_RUNS_BEFORE_PR = 2;

const PRIORITY: Readonly<Record<CiProfile, number>> = { main: 0, pr: 1, nightly: 2 };

export interface Candidate {
  readonly request: RequestRecord;
  readonly attempt: AttemptRecord;
}

export function listCandidates(store: QueueStore): readonly Candidate[] {
  const requests = new Map(store.listRequests().map((request) => [request.id, request]));
  return store
    .listAttempts({ state: 'queued' })
    .flatMap((attempt) => {
      const request = requests.get(attempt.requestId);
      return request && request.state === 'pending' ? [{ request, attempt }] : [];
    })
    .sort(compareCandidates);
}

function compareCandidates(left: Candidate, right: Candidate): number {
  const byPriority = PRIORITY[left.request.profile] - PRIORITY[right.request.profile];
  if (byPriority !== 0) return byPriority;
  // Newest main first (current main), otherwise FIFO.
  if (left.request.profile === 'main') return right.request.sequence - left.request.sequence;
  return left.request.sequence - right.request.sequence;
}

export function selectNext(store: QueueStore): Candidate | undefined {
  const candidates = listCandidates(store);
  if (candidates.length === 0) return undefined;
  const consecutiveMain = store.getCounter(CONSECUTIVE_MAIN_COUNTER);
  if (consecutiveMain >= MAIN_RUNS_BEFORE_PR) {
    const waitingPr = candidates.find((candidate) => candidate.request.profile === 'pr');
    if (waitingPr) return waitingPr;
  }
  return candidates[0];
}

/** Call when an attempt is dispatched so the fairness rule can be applied. */
export function recordDispatch(store: QueueStore, profile: CiProfile): void {
  if (profile === 'main') {
    store.incrementCounter(CONSECUTIVE_MAIN_COUNTER);
  } else {
    store.setCounter(CONSECUTIVE_MAIN_COUNTER, 0);
  }
}

export interface SupersededAttempt {
  readonly request: RequestRecord;
  readonly attempt: AttemptRecord;
  readonly action: 'superseded' | 'cancel-requested';
}

/**
 * Marks older revisions superseded by `incoming`. Queued attempts are moved to
 * `superseded` immediately; in-flight attempts get a `cancel` stop signal and
 * are finalised by the controller when the executor returns.
 */
export function supersedeOlderRevisions(
  store: QueueStore,
  incoming: RequestRecord,
): readonly SupersededAttempt[] {
  if (incoming.profile === 'nightly') return [];
  const older = store
    .listRequests({ profile: incoming.profile })
    .filter((request) => request.id !== incoming.id && request.sequence < incoming.sequence)
    .filter((request) => request.state === 'pending' || request.state === 'active')
    .filter((request) => incoming.profile !== 'pr' || request.prNumber === incoming.prNumber)
    .filter((request) => request.headSha !== incoming.headSha);

  const outcomes: SupersededAttempt[] = [];
  for (const request of older) {
    const open = store
      .listAttempts({ requestId: request.id })
      .filter(
        (attempt) => !['published', 'failed', 'cancelled', 'superseded'].includes(attempt.state),
      );
    for (const attempt of open) {
      if (attempt.state === 'queued') {
        const updated = store.transition(attempt.id, 'superseded', {
          reason: `superseded by ${incoming.headSha}`,
        });
        outcomes.push({ request, attempt: updated, action: 'superseded' });
      } else if (incoming.profile === 'pr') {
        // Only PR revisions are cancelled mid-flight; an in-flight main run is
        // allowed to finish so its check stays meaningful for the gate.
        const updated = store.requestStop(attempt.id, 'cancel');
        store.setRequestState(request.id, 'active', `superseded by ${incoming.headSha}`);
        outcomes.push({ request, attempt: updated, action: 'cancel-requested' });
      }
    }
    if (open.length === 0 && request.state === 'pending') {
      store.setRequestState(request.id, 'superseded', `superseded by ${incoming.headSha}`);
    }
  }
  return outcomes;
}

/**
 * Decides whether a running attempt should be asked to yield. Only nightly
 * work is preemptible, and only when main or PR work is waiting. Admission
 * window changes never produce a stop signal (allocation changes apply to the
 * next job only).
 */
export function preemptionSignal(store: QueueStore, running: RequestRecord): StopSignal {
  if (running.profile !== 'nightly') return 'continue';
  const waiting = listCandidates(store).some(
    (candidate) => candidate.request.profile !== 'nightly',
  );
  return waiting ? 'preempt' : 'continue';
}
