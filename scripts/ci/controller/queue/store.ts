import { randomUUID } from 'node:crypto';

import type { Row, StorageBackend } from './backend';
import { createMemoryBackend } from './memory-backend';
import { assertTransition, isTerminalAttemptState, type AttemptState } from './state-machine';
import { isCompleteCiResult, type CiProfile, type CiResult, type StopSignal } from '../types';

export type RequestState = 'pending' | 'active' | 'completed' | 'cancelled' | 'superseded';

/** The CI request tuple minus the attempt counter (attempts are rows of their own). */
export interface RequestInput {
  readonly repositoryId: number;
  readonly profile: CiProfile;
  readonly prNumber?: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly testedSha: string;
  readonly policyVersion: string;
  readonly imageDigest: string;
  readonly controllerVersion: string;
  /** Extra discriminator folded into the dedup key (nightly uses the London date). */
  readonly dedupScope?: string;
}

export interface RequestRecord extends RequestInput {
  readonly id: string;
  readonly dedupKey: string;
  readonly state: RequestState;
  readonly sequence: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly reason?: string;
}

export interface AttemptRecord {
  readonly id: string;
  readonly requestId: string;
  readonly attempt: number;
  readonly state: AttemptState;
  readonly stop: StopSignal;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly result?: CiResult;
  readonly reason?: string;
}

export interface LeaseRecord {
  readonly attemptId: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
}

export type PublicationState = 'in_progress' | 'completed' | 'recovered';

export interface PublicationRecord {
  readonly requestId: string;
  readonly attemptId: string;
  readonly checkName: string;
  readonly headSha: string;
  readonly checkRunId: number | null;
  readonly state: PublicationState;
  readonly conclusion?: string;
  /** Tuple key published as the check run `external_id`. */
  readonly externalId?: string;
  /** Evidence bundle digest of the published result, when one was published. */
  readonly evidenceDigest?: string;
  readonly updatedAt: string;
}

export interface HeartbeatRecord {
  readonly id: string;
  /** Monotonic insertion order; timestamps alone can collide within a millisecond. */
  readonly sequence: number;
  readonly at: string;
  readonly payload: Record<string, unknown>;
}

export interface AttemptFilter {
  readonly requestId?: string;
  readonly state?: AttemptState;
  readonly states?: readonly AttemptState[];
}

export interface RequestFilter {
  readonly state?: RequestState;
  readonly profile?: CiProfile;
  readonly prNumber?: number;
}

export interface EnqueueResult {
  readonly request: RequestRecord;
  readonly attempt: AttemptRecord;
  readonly created: boolean;
}

export class LeaseHeldError extends Error {
  constructor(
    readonly attemptId: string,
    readonly owner: string,
  ) {
    super(`Attempt ${attemptId} is leased by another owner`);
    this.name = 'LeaseHeldError';
  }
}

export class IncompleteResultError extends Error {
  constructor(readonly attemptId: string) {
    super(`Attempt ${attemptId} cannot be collected/published without a complete CiResult`);
    this.name = 'IncompleteResultError';
  }
}

export interface StoreOptions {
  readonly backend?: StorageBackend;
  readonly now?: () => Date;
  readonly heartbeatRetention?: number;
}

export function dedupKeyFor(input: RequestInput): string {
  return [
    input.repositoryId,
    input.profile,
    input.prNumber ?? 'branch',
    input.headSha,
    input.baseSha,
    input.testedSha,
    input.policyVersion,
    input.imageDigest,
    input.dedupScope ?? '',
  ].join(':');
}

const REOPENABLE_REQUEST_STATES: readonly RequestState[] = ['cancelled', 'superseded'];

/**
 * Durable queue semantics: dedup, attempt state machine, leases, publications,
 * heartbeats, counters. All methods are synchronous; both backends are
 * synchronous and the daemon is single-threaded, so this keeps the invariants
 * easy to reason about.
 */
export class QueueStore {
  private readonly backend: StorageBackend;
  private readonly now: () => Date;
  private readonly heartbeatRetention: number;

  constructor(options: StoreOptions = {}) {
    this.backend = options.backend ?? createMemoryBackend();
    this.now = options.now ?? (() => new Date());
    this.heartbeatRetention = options.heartbeatRetention ?? 200;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  // ---------------------------------------------------------------- requests

  enqueue(input: RequestInput): EnqueueResult {
    return this.backend.transaction(() => {
      const dedupKey = dedupKeyFor(input);
      const existingKey = this.backend.get('request_dedup', dedupKey);
      if (existingKey) {
        const request = this.requireRequest(String(existingKey.requestId));
        return this.reuseExisting(request);
      }
      const at = this.timestamp();
      const request: RequestRecord = {
        ...input,
        id: randomUUID(),
        dedupKey,
        state: 'pending',
        sequence: this.incrementCounter('request_sequence'),
        createdAt: at,
        updatedAt: at,
      };
      this.backend.put('requests', request.id, request as unknown as Row);
      this.backend.put('request_dedup', dedupKey, { requestId: request.id });
      const attempt = this.createAttempt(request.id);
      return { request, attempt, created: true };
    });
  }

  private reuseExisting(request: RequestRecord): EnqueueResult {
    const attempts = this.listAttempts({ requestId: request.id });
    const open = attempts.find((attempt) => !isTerminalAttemptState(attempt.state));
    if (open) return { request, attempt: open, created: false };
    const latest = attempts[attempts.length - 1];
    const reopenable =
      REOPENABLE_REQUEST_STATES.includes(request.state) && !this.getPublication(request.id);
    if (!reopenable && latest) {
      return { request, attempt: latest, created: false };
    }
    const reopened = this.setRequestState(request.id, 'pending');
    const attempt = this.createAttempt(request.id);
    return { request: reopened, attempt, created: false };
  }

  getRequest(id: string): RequestRecord | undefined {
    const row = this.backend.get('requests', id);
    return row ? (row as unknown as RequestRecord) : undefined;
  }

  private requireRequest(id: string): RequestRecord {
    const request = this.getRequest(id);
    if (!request) throw new Error(`Unknown request ${id}`);
    return request;
  }

  listRequests(filter: RequestFilter = {}): readonly RequestRecord[] {
    return (this.backend.list('requests') as unknown as RequestRecord[])
      .filter((request) => filter.state === undefined || request.state === filter.state)
      .filter((request) => filter.profile === undefined || request.profile === filter.profile)
      .filter((request) => filter.prNumber === undefined || request.prNumber === filter.prNumber)
      .sort((left, right) => left.sequence - right.sequence);
  }

  setRequestState(id: string, state: RequestState, reason?: string): RequestRecord {
    const request = this.requireRequest(id);
    const next: RequestRecord = {
      ...request,
      state,
      updatedAt: this.timestamp(),
      ...(reason === undefined ? {} : { reason }),
    };
    this.backend.put('requests', id, next as unknown as Row);
    return next;
  }

  // ---------------------------------------------------------------- attempts

  createAttempt(requestId: string): AttemptRecord {
    return this.backend.transaction(() => {
      const request = this.requireRequest(requestId);
      const existing = this.listAttempts({ requestId });
      if (existing.some((attempt) => !isTerminalAttemptState(attempt.state))) {
        throw new Error(`Request ${requestId} already has an open attempt`);
      }
      const at = this.timestamp();
      const attempt: AttemptRecord = {
        id: randomUUID(),
        requestId,
        attempt: existing.length + 1,
        state: 'queued',
        stop: 'continue',
        createdAt: at,
        updatedAt: at,
      };
      this.backend.put('attempts', attempt.id, attempt as unknown as Row);
      if (request.state !== 'pending') this.setRequestState(requestId, 'pending');
      return attempt;
    });
  }

  getAttempt(id: string): AttemptRecord | undefined {
    const row = this.backend.get('attempts', id);
    return row ? (row as unknown as AttemptRecord) : undefined;
  }

  private requireAttempt(id: string): AttemptRecord {
    const attempt = this.getAttempt(id);
    if (!attempt) throw new Error(`Unknown attempt ${id}`);
    return attempt;
  }

  listAttempts(filter: AttemptFilter = {}): readonly AttemptRecord[] {
    return (this.backend.list('attempts') as unknown as AttemptRecord[])
      .filter((attempt) => filter.requestId === undefined || attempt.requestId === filter.requestId)
      .filter((attempt) => filter.state === undefined || attempt.state === filter.state)
      .filter((attempt) => filter.states === undefined || filter.states.includes(attempt.state))
      .sort((left, right) =>
        left.createdAt === right.createdAt
          ? left.attempt - right.attempt
          : left.createdAt.localeCompare(right.createdAt),
      );
  }

  /**
   * Moves an attempt through the state machine. `collected` requires a
   * complete result in the patch; `published` requires the stored result to
   * be complete. Terminal transitions release the lease and update the parent
   * request state.
   */
  transition(
    attemptId: string,
    to: AttemptState,
    patch: { readonly result?: unknown; readonly reason?: string } = {},
  ): AttemptRecord {
    return this.backend.transaction(() => {
      const attempt = this.requireAttempt(attemptId);
      assertTransition(attemptId, attempt.state, to);
      let result = attempt.result;
      if (to === 'collected') {
        if (!isCompleteCiResult(patch.result)) throw new IncompleteResultError(attemptId);
        result = patch.result;
      }
      if (to === 'published' && !isCompleteCiResult(result)) {
        throw new IncompleteResultError(attemptId);
      }
      const next: AttemptRecord = {
        ...attempt,
        state: to,
        updatedAt: this.timestamp(),
        ...(result === undefined ? {} : { result }),
        ...(patch.reason === undefined ? {} : { reason: patch.reason }),
      };
      this.backend.put('attempts', attemptId, next as unknown as Row);
      if (isTerminalAttemptState(to)) {
        this.backend.delete('leases', attemptId);
        this.setRequestState(attempt.requestId, requestStateFor(to), patch.reason);
      } else if (to === 'leased' || to === 'running') {
        this.setRequestState(attempt.requestId, 'active');
      }
      return next;
    });
  }

  requestStop(attemptId: string, stop: StopSignal): AttemptRecord {
    const attempt = this.requireAttempt(attemptId);
    const next: AttemptRecord = { ...attempt, stop, updatedAt: this.timestamp() };
    this.backend.put('attempts', attemptId, next as unknown as Row);
    return next;
  }

  // ------------------------------------------------------------------ leases

  acquireLease(attemptId: string, owner: string, ttlMs: number): LeaseRecord {
    return this.backend.transaction(() => {
      const existing = this.getLease(attemptId);
      const nowMs = this.now().getTime();
      if (existing && existing.owner !== owner && Date.parse(existing.expiresAt) > nowMs) {
        throw new LeaseHeldError(attemptId, existing.owner);
      }
      const lease: LeaseRecord = {
        attemptId,
        owner,
        acquiredAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + ttlMs).toISOString(),
      };
      this.backend.put('leases', attemptId, lease as unknown as Row);
      const attempt = this.requireAttempt(attemptId);
      if (attempt.state === 'queued') this.transition(attemptId, 'leased');
      return lease;
    });
  }

  renewLease(attemptId: string, owner: string, ttlMs: number): LeaseRecord {
    const existing = this.getLease(attemptId);
    if (!existing || existing.owner !== owner) throw new LeaseHeldError(attemptId, owner);
    const lease: LeaseRecord = {
      ...existing,
      expiresAt: new Date(this.now().getTime() + ttlMs).toISOString(),
    };
    this.backend.put('leases', attemptId, lease as unknown as Row);
    return lease;
  }

  getLease(attemptId: string): LeaseRecord | undefined {
    const row = this.backend.get('leases', attemptId);
    return row ? (row as unknown as LeaseRecord) : undefined;
  }

  listLeases(): readonly LeaseRecord[] {
    return this.backend.list('leases') as unknown as LeaseRecord[];
  }

  releaseLease(attemptId: string): void {
    this.backend.delete('leases', attemptId);
  }

  // ------------------------------------------------------------ publications

  upsertPublication(publication: PublicationRecord): PublicationRecord {
    this.backend.put('publications', publication.requestId, publication as unknown as Row);
    return publication;
  }

  getPublication(requestId: string): PublicationRecord | undefined {
    const row = this.backend.get('publications', requestId);
    return row ? (row as unknown as PublicationRecord) : undefined;
  }

  listPublications(): readonly PublicationRecord[] {
    return this.backend.list('publications') as unknown as PublicationRecord[];
  }

  // -------------------------------------------------------------- heartbeats

  recordHeartbeat(payload: Record<string, unknown>): HeartbeatRecord {
    return this.backend.transaction(() => {
      const record: HeartbeatRecord = {
        id: randomUUID(),
        sequence: this.incrementCounter('heartbeat_sequence'),
        at: this.timestamp(),
        payload,
      };
      this.backend.put('heartbeats', record.id, record as unknown as Row);
      const all = this.listHeartbeats();
      const excess = all.length - this.heartbeatRetention;
      for (let index = 0; index < excess; index += 1) {
        this.backend.delete('heartbeats', all[index]!.id);
      }
      return record;
    });
  }

  listHeartbeats(): readonly HeartbeatRecord[] {
    return (this.backend.list('heartbeats') as unknown as HeartbeatRecord[]).sort(
      (left, right) => left.sequence - right.sequence,
    );
  }

  // ---------------------------------------------------------------- counters

  getCounter(key: string): number {
    const row = this.backend.get('counters', key);
    return row && typeof row.value === 'number' ? row.value : 0;
  }

  setCounter(key: string, value: number): void {
    this.backend.put('counters', key, { value });
  }

  incrementCounter(key: string): number {
    const next = this.getCounter(key) + 1;
    this.setCounter(key, next);
    return next;
  }

  close(): void {
    this.backend.close();
  }
}

function requestStateFor(state: AttemptState): RequestState {
  switch (state) {
    case 'published':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'superseded':
      return 'superseded';
    default:
      // A failed attempt leaves the request pending so the scheduler may retry
      // it; the controller marks it cancelled once retries are exhausted.
      return 'pending';
  }
}
