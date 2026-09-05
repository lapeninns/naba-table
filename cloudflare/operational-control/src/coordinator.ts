import { resolveControlPlaneConfig } from './config';
import {
  DELIVERY_DEDUP_TTL_MS,
  DISPATCH_MAX_ATTEMPTS,
  DISPATCH_RETRY_SCHEDULE_MS,
  HEARTBEAT_ALERT_AFTER_MS,
  HEARTBEAT_FALLBACK_AFTER_MS,
  SERVICE_NAME,
} from './contracts';
import { writeEvidence } from './evidence';
import { readbackAndDispatchGate } from './gate';
import { createGitHubClient, GitHubConfigurationError, GitHubTransportError } from './github';
import { isRecord, json } from './http';
import {
  acknowledgeIncident,
  applyObservation,
  escalateIfDue,
  incidentKey,
  isValidObservation,
} from './incidents';
import { writeStructuredLog } from '../../shared/observability';

import type { ControlPlaneConfig } from './config';
import type {
  CandidateState,
  CiRequestTuple,
  ControllerHeartbeat,
  CoordinatorStatus,
  HealthObservation,
  HeartbeatState,
  IncidentStatus,
  IncidentSummary,
  LocalCheckEvent,
  NormalizedEvent,
  OperationalControlEnv,
  Runtime,
  WebhookDelivery,
} from './contracts';
import type {
  DeliveryRecordResult,
  ObservationRecordResult,
  TickReport,
} from './coordinator-client';
import type { EvidenceKind, EvidenceWriteResult } from './evidence';
import type { GateDispatchOutcome } from './gate';
import type { LogSink } from '../../shared/observability';

export type SqlValue = ArrayBuffer | string | number | null;
export type SqlRow = Record<string, SqlValue>;

/** Structural subset of Cloudflare's `SqlStorage`; tests satisfy it with node:sqlite. */
export type CoordinatorSql = {
  exec(query: string, ...bindings: SqlValue[]): { toArray(): SqlRow[] };
};

export type CoordinatorStorage = {
  readonly sql: CoordinatorSql;
  setAlarm(scheduledTime: number): Promise<void>;
  getAlarm(): Promise<number | null>;
  deleteAlarm(): Promise<void>;
};

export type CoordinatorContext = {
  readonly storage: CoordinatorStorage;
};

export type CoordinatorDeps = {
  readonly now: () => number;
  readonly newId: () => string;
  readonly dispatchGate: (
    tuple: CiRequestTuple,
    candidateKey: string,
  ) => Promise<GateDispatchOutcome>;
  readonly writeEvidence: (
    kind: EvidenceKind,
    id: string,
    payload: Readonly<Record<string, unknown>>,
  ) => Promise<EvidenceWriteResult>;
  readonly sink?: LogSink;
};

const CANDIDATE_STATES: readonly CandidateState[] = [
  'pending',
  'ready',
  'dispatched',
  'rejected',
  'closed',
  'failed',
];
const DISPATCH_INCIDENT = { service: 'github-dispatch', environment: 'control-plane' } as const;
const MAX_JOBS_PER_TICK = 10;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS deliveries (
    delivery_id TEXT PRIMARY KEY,
    received_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS candidates (
    candidate_key TEXT PRIMARY KEY,
    tuple_json TEXT NOT NULL,
    head_sha TEXT NOT NULL,
    pr_number INTEGER,
    state TEXT NOT NULL,
    local_status TEXT NOT NULL,
    local_conclusion TEXT,
    local_check_run_id INTEGER,
    gate_dispatched_at TEXT,
    reason TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS candidates_head_sha ON candidates(head_sha)`,
  `CREATE TABLE IF NOT EXISTS hosted_runs (
    head_sha TEXT NOT NULL,
    workflow_path TEXT NOT NULL,
    workflow_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    run_attempt INTEGER NOT NULL,
    status TEXT NOT NULL,
    conclusion TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (head_sha, workflow_path)
  )`,
  `CREATE TABLE IF NOT EXISTS dispatch_jobs (
    candidate_key TEXT PRIMARY KEY,
    attempt INTEGER NOT NULL,
    next_run_at INTEGER NOT NULL,
    last_error TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dispatch_generations (
    candidate_key TEXT PRIMARY KEY,
    generation TEXT NOT NULL,
    dispatched_generation TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    incident_key TEXT NOT NULL,
    service TEXT NOT NULL,
    environment TEXT NOT NULL,
    failure_class TEXT NOT NULL,
    status TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    escalated_at TEXT,
    acknowledged_at TEXT,
    resolved_at TEXT,
    healthy_streak INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS incidents_key_status ON incidents(incident_key, status)`,
  `CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

function text(row: SqlRow, column: string): string {
  const value = row[column];
  return typeof value === 'string' ? value : '';
}

function nullableText(row: SqlRow, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' ? value : null;
}

function integer(row: SqlRow, column: string): number {
  const value = row[column];
  return typeof value === 'number' ? value : 0;
}

function candidateStateOf(value: string): CandidateState {
  return CANDIDATE_STATES.includes(value as CandidateState) ? (value as CandidateState) : 'failed';
}

function candidateKeyMaterial(tuple: CiRequestTuple): string {
  return [
    tuple.repositoryId,
    tuple.profile,
    tuple.prNumber ?? 'none',
    tuple.headSha,
    tuple.baseSha,
    tuple.testedSha,
    tuple.policyVersion,
    tuple.imageDigest,
    tuple.controllerVersion,
    tuple.attempt,
  ].join('|');
}

export async function computeCandidateKey(tuple: CiRequestTuple): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(candidateKeyMaterial(tuple)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function heartbeatStateFor(ageMs: number | null): HeartbeatState {
  if (ageMs === null || ageMs < 0) return 'unknown';
  if (ageMs >= HEARTBEAT_FALLBACK_AFTER_MS) return 'fallback_eligible';
  if (ageMs >= HEARTBEAT_ALERT_AFTER_MS) return 'alert';
  return 'fresh';
}

function incidentFromRow(row: SqlRow): IncidentSummary {
  return {
    id: text(row, 'id'),
    service: text(row, 'service'),
    environment: text(row, 'environment'),
    failureClass: text(row, 'failure_class'),
    status: text(row, 'status') as IncidentStatus,
    openedAt: text(row, 'opened_at'),
    lastSeenAt: text(row, 'last_seen_at'),
    escalatedAt: nullableText(row, 'escalated_at'),
    acknowledgedAt: nullableText(row, 'acknowledged_at'),
    resolvedAt: nullableText(row, 'resolved_at'),
    healthyStreak: integer(row, 'healthy_streak'),
  };
}

export function createDefaultCoordinatorDeps(env: OperationalControlEnv): CoordinatorDeps {
  return {
    now: Date.now,
    newId: () => crypto.randomUUID(),
    async dispatchGate(tuple) {
      const resolved = resolveControlPlaneConfig(env);
      if (!resolved.ok) {
        throw new GitHubConfigurationError(
          `Control plane vars missing: ${resolved.missing.join(', ')}.`,
        );
      }
      const client = createGitHubClient({
        appId: env.GITHUB_DISPATCH_APP_ID,
        privateKeyPem: env.GITHUB_DISPATCH_APP_PRIVATE_KEY,
        installationId: env.GITHUB_DISPATCH_INSTALLATION_ID,
        repositoryId: resolved.config.repositoryId,
        dispatchPolicy: {
          allowedWorkflowIds: [
            resolved.config.gateWorkflowId,
            resolved.config.scheduledValidationWorkflowId,
          ],
          protectedRef: resolved.config.protectedRef,
        },
        ...(env.GITHUB_API_BASE_URL ? { apiBaseUrl: env.GITHUB_API_BASE_URL } : {}),
      });
      return readbackAndDispatchGate({ client, config: resolved.config, tuple });
    },
    writeEvidence: (kind, id, payload) =>
      writeEvidence({ bucket: env.EVIDENCE_BUCKET, kind, id, payload, now: new Date() }),
  };
}

type CandidateRow = {
  readonly candidateKey: string;
  readonly tuple: CiRequestTuple;
  readonly state: CandidateState;
  readonly localStatus: string;
  readonly localConclusion: string | null;
  readonly localCheckRunId: number;
  readonly reason: string | null;
};

/**
 * Single coordinator Durable Object (SQLite-backed). Serializes delivery dedup, candidate
 * coalescing, the bounded dispatch retry queue, controller heartbeats, and incident state.
 */
export class Coordinator {
  private readonly storage: CoordinatorStorage;
  private readonly sql: CoordinatorSql;
  private readonly deps: CoordinatorDeps;
  private readonly config: ControlPlaneConfig | null;
  private readonly dispatching = new Set<string>();

  constructor(
    ctx: CoordinatorContext,
    env: OperationalControlEnv,
    deps?: Partial<CoordinatorDeps>,
  ) {
    this.storage = ctx.storage;
    this.sql = ctx.storage.sql;
    this.deps = { ...createDefaultCoordinatorDeps(env), ...deps };
    const resolved = resolveControlPlaneConfig(env);
    this.config = resolved.ok ? resolved.config : null;
    for (const statement of SCHEMA_STATEMENTS) this.sql.exec(statement);
    // Backfill ready jobs created before hosted generation tracking. No table is
    // rebuilt, and existing generation retry counters remain intact on restart.
    for (const row of this.sql
      .exec(
        `SELECT candidates.candidate_key FROM candidates
       LEFT JOIN dispatch_generations USING (candidate_key)
       WHERE candidates.state = 'ready' AND dispatch_generations.candidate_key IS NULL`,
      )
      .toArray())
      this.evaluateCandidate(text(row, 'candidate_key'), this.deps.now());
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === 'GET' && pathname === '/status') {
      return json(this.status());
    }
    if (request.method !== 'POST') return json({ error: 'Not found' }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    if (!isRecord(body)) return json({ error: 'Body must be an object.' }, { status: 400 });

    if (pathname === '/deliveries') return this.handleDelivery(body);
    if (pathname === '/heartbeat') return this.handleHeartbeat(body);
    if (pathname === '/observations') return this.handleObservations(body);
    if (pathname === '/tick') return json(await this.tick(this.readNow(body)));
    const acknowledge = pathname.match(/^\/incidents\/([A-Za-z0-9-]{1,64})\/acknowledge$/u);
    if (acknowledge?.[1]) {
      return json({ acknowledged: this.acknowledge(acknowledge[1], this.readNow(body)) });
    }
    return json({ error: 'Not found' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.tick(this.deps.now());
  }

  private readNow(body: Record<string, unknown>): number {
    const parsed = typeof body.now === 'string' ? Date.parse(body.now) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : this.deps.now();
  }

  private log(
    level: 'info' | 'warn' | 'error',
    event: string,
    fields: Record<string, unknown>,
  ): void {
    writeStructuredLog({ level, event, service: SERVICE_NAME, fields, sink: this.deps.sink });
  }

  // --- deliveries -------------------------------------------------------------------------

  private async handleDelivery(body: Record<string, unknown>): Promise<Response> {
    if (!this.config) return json({ error: 'Control plane is unconfigured.' }, { status: 503 });
    const delivery = body.delivery;
    const receivedAt =
      typeof body.receivedAt === 'string' ? Date.parse(body.receivedAt) : Number.NaN;
    if (
      !isRecord(delivery) ||
      typeof delivery.deliveryId !== 'string' ||
      !isRecord(delivery.event) ||
      !Number.isFinite(receivedAt)
    ) {
      return json({ error: 'Invalid delivery envelope.' }, { status: 400 });
    }
    const result = await this.recordDelivery(delivery as unknown as WebhookDelivery, receivedAt);
    return json(result);
  }

  async recordDelivery(
    delivery: WebhookDelivery,
    receivedAtMs: number,
  ): Promise<DeliveryRecordResult> {
    this.pruneDeliveries(receivedAtMs);
    const existing = this.sql
      .exec('SELECT delivery_id FROM deliveries WHERE delivery_id = ?', delivery.deliveryId)
      .toArray();
    if (existing.length > 0) return { duplicate: true, candidateKey: null, candidateState: null };
    this.sql.exec(
      'INSERT INTO deliveries (delivery_id, received_at) VALUES (?, ?)',
      delivery.deliveryId,
      receivedAtMs,
    );

    const affected = await this.applyEvent(delivery.event, receivedAtMs);
    await this.scheduleAlarm();
    return {
      duplicate: false,
      candidateKey: affected?.candidateKey ?? null,
      candidateState: affected?.state ?? null,
    };
  }

  private pruneDeliveries(nowMs: number): void {
    this.sql.exec('DELETE FROM deliveries WHERE received_at < ?', nowMs - DELIVERY_DEDUP_TTL_MS);
  }

  private async applyEvent(event: NormalizedEvent, nowMs: number): Promise<CandidateRow | null> {
    switch (event.type) {
      case 'local_check':
        return this.applyLocalCheck(event, nowMs);
      case 'hosted_run':
        this.applyHostedRun(event, nowMs);
        return null;
      case 'pull_request':
        this.applyPullRequest(event.action, event.prNumber, event.headSha, nowMs);
        return null;
      case 'push':
      case 'observed':
        return null;
    }
  }

  private async applyLocalCheck(event: LocalCheckEvent, nowMs: number): Promise<CandidateRow> {
    const candidateKey = await computeCandidateKey(event.tuple);
    const current = this.loadCandidate(candidateKey);
    if (
      current &&
      (event.checkRunId < current.localCheckRunId ||
        (event.checkRunId === current.localCheckRunId && current.localStatus === 'completed'))
    )
      return current;
    if (!current) {
      this.sql.exec(
        `INSERT INTO candidates (candidate_key, tuple_json, head_sha, pr_number, state, local_status, local_conclusion, local_check_run_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        candidateKey,
        JSON.stringify(event.tuple),
        event.tuple.headSha,
        event.tuple.prNumber ?? null,
        event.status,
        event.conclusion,
        event.checkRunId,
        nowMs,
        nowMs,
      );
    } else if (
      current.state === 'pending' ||
      current.state === 'ready' ||
      current.state === 'rejected'
    ) {
      this.sql.exec(
        'UPDATE candidates SET local_status = ?, local_conclusion = ?, local_check_run_id = ?, updated_at = ? WHERE candidate_key = ?',
        event.status,
        event.conclusion,
        event.checkRunId,
        nowMs,
        candidateKey,
      );
    }
    return (
      this.evaluateCandidate(candidateKey, nowMs) ??
      (this.loadCandidate(candidateKey) as CandidateRow)
    );
  }

  private applyHostedRun(
    event: Extract<NormalizedEvent, { type: 'hosted_run' }>,
    nowMs: number,
  ): void {
    if (event.status === 'completed' && !event.conclusion) return;
    const existing = this.sql
      .exec(
        'SELECT run_id, run_attempt, status FROM hosted_runs WHERE head_sha = ? AND workflow_path = ?',
        event.headSha,
        event.workflowPath,
      )
      .toArray()[0];
    if (existing) {
      const runId = integer(existing, 'run_id');
      const runAttempt = integer(existing, 'run_attempt');
      const isNewer =
        event.runId > runId || (event.runId === runId && event.runAttempt >= runAttempt);
      if (!isNewer) return;
      if (event.runId === runId && event.runAttempt === runAttempt) {
        const rank = (status: string): number =>
          status === 'completed' ? 2 : status === 'in_progress' ? 1 : 0;
        // A completed attempt is immutable; delayed requested/in_progress deliveries
        // and duplicate completions cannot regress it or manufacture a new dispatch.
        if (rank(event.status) <= rank(text(existing, 'status'))) return;
      }
    }
    this.sql.exec(
      `INSERT INTO hosted_runs (head_sha, workflow_path, workflow_id, run_id, run_attempt, status, conclusion, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(head_sha, workflow_path) DO UPDATE SET workflow_id = excluded.workflow_id, run_id = excluded.run_id,
         run_attempt = excluded.run_attempt, status = excluded.status, conclusion = excluded.conclusion, updated_at = excluded.updated_at`,
      event.headSha,
      event.workflowPath,
      event.workflowId,
      event.runId,
      event.runAttempt,
      event.status,
      event.conclusion,
      nowMs,
    );
    const keys = this.sql
      .exec(
        "SELECT candidate_key FROM candidates WHERE head_sha = ? AND state IN ('pending', 'ready', 'rejected', 'dispatched')",
        event.headSha,
      )
      .toArray();
    for (const row of keys) this.evaluateCandidate(text(row, 'candidate_key'), nowMs, true);
  }

  private applyPullRequest(action: string, prNumber: number, headSha: string, nowMs: number): void {
    if (action === 'closed') {
      this.sql.exec(
        "UPDATE candidates SET state = 'closed', reason = 'pull_request_closed', updated_at = ? WHERE pr_number = ? AND state IN ('pending', 'ready', 'rejected', 'dispatched')",
        nowMs,
        prNumber,
      );
      this.sql.exec(
        'DELETE FROM dispatch_jobs WHERE candidate_key IN (SELECT candidate_key FROM candidates WHERE pr_number = ? AND state = ?)',
        prNumber,
        'closed',
      );
      return;
    }
    if (action === 'synchronize') {
      this.sql.exec(
        "UPDATE candidates SET state = 'closed', reason = 'pull_request_head_moved', updated_at = ? WHERE pr_number = ? AND head_sha <> ? AND state IN ('pending', 'ready', 'rejected', 'dispatched')",
        nowMs,
        prNumber,
        headSha,
      );
      this.sql.exec(
        'DELETE FROM dispatch_jobs WHERE candidate_key IN (SELECT candidate_key FROM candidates WHERE pr_number = ? AND state = ?)',
        prNumber,
        'closed',
      );
    }
  }

  private loadCandidate(candidateKey: string): CandidateRow | null {
    const row = this.sql
      .exec('SELECT * FROM candidates WHERE candidate_key = ?', candidateKey)
      .toArray()[0];
    if (!row) return null;
    return {
      candidateKey,
      tuple: JSON.parse(text(row, 'tuple_json')) as CiRequestTuple,
      state: candidateStateOf(text(row, 'state')),
      localStatus: text(row, 'local_status'),
      localConclusion: nullableText(row, 'local_conclusion'),
      localCheckRunId: integer(row, 'local_check_run_id'),
      reason: nullableText(row, 'reason'),
    };
  }

  private setCandidateState(
    candidateKey: string,
    state: CandidateState,
    reason: string | null,
    nowMs: number,
  ): void {
    this.sql.exec(
      'UPDATE candidates SET state = ?, reason = ?, updated_at = ? WHERE candidate_key = ?',
      state,
      reason,
      nowMs,
      candidateKey,
    );
  }

  /** Coalesces local + hosted completion into at most one queued dispatch per candidate. */
  private evaluateCandidate(
    candidateKey: string,
    nowMs: number,
    hostedChanged = false,
  ): CandidateRow | null {
    const candidate = this.loadCandidate(candidateKey);
    if (!candidate || !this.config) return candidate;
    const revivable =
      candidate.state === 'pending' ||
      candidate.state === 'ready' ||
      (candidate.state === 'dispatched' && hostedChanged) ||
      (candidate.state === 'rejected' && candidate.reason?.startsWith('hosted_run'));
    if (!revivable) return candidate;

    if (candidate.localStatus !== 'completed') {
      if (candidate.state !== 'pending')
        this.setCandidateState(candidateKey, 'pending', null, nowMs);
      this.sql.exec('DELETE FROM dispatch_jobs WHERE candidate_key = ?', candidateKey);
      return this.loadCandidate(candidateKey);
    }
    if (candidate.localConclusion !== 'success') {
      this.setCandidateState(candidateKey, 'rejected', 'local_check_not_successful', nowMs);
      this.sql.exec('DELETE FROM dispatch_jobs WHERE candidate_key = ?', candidateKey);
      return this.loadCandidate(candidateKey);
    }

    const runs = this.sql
      .exec(
        'SELECT workflow_path, run_id, run_attempt, status, conclusion FROM hosted_runs WHERE head_sha = ?',
        candidate.tuple.headSha,
      )
      .toArray();
    const completedRuns: SqlRow[] = [];
    for (const path of this.config.requiredHostedWorkflows) {
      const run = runs.find((row) => text(row, 'workflow_path') === path);
      if (!run || text(run, 'status') !== 'completed' || !nullableText(run, 'conclusion')) {
        if (candidate.state !== 'pending')
          this.setCandidateState(candidateKey, 'pending', null, nowMs);
        this.sql.exec('DELETE FROM dispatch_jobs WHERE candidate_key = ?', candidateKey);
        return this.loadCandidate(candidateKey);
      }
      completedRuns.push(run);
    }

    // Completion, including failure, wakes the protected gate. Only that gate
    // decides whether the hosted results satisfy merge/deploy policy.
    const generation = JSON.stringify(
      completedRuns.map((run) => [
        text(run, 'workflow_path'),
        integer(run, 'run_id'),
        integer(run, 'run_attempt'),
      ]),
    );
    const previous = this.sql
      .exec(
        'SELECT generation, dispatched_generation FROM dispatch_generations WHERE candidate_key = ?',
        candidateKey,
      )
      .toArray()[0];
    if (previous && nullableText(previous, 'dispatched_generation') === generation)
      return candidate;
    const changed = !previous || text(previous, 'generation') !== generation;
    this.sql.exec(
      `INSERT INTO dispatch_generations (candidate_key, generation) VALUES (?, ?)
       ON CONFLICT(candidate_key) DO UPDATE SET generation = excluded.generation`,
      candidateKey,
      generation,
    );
    if (candidate.state !== 'ready') this.setCandidateState(candidateKey, 'ready', null, nowMs);
    if (changed) this.sql.exec('DELETE FROM dispatch_jobs WHERE candidate_key = ?', candidateKey);
    this.sql.exec(
      'INSERT OR IGNORE INTO dispatch_jobs (candidate_key, attempt, next_run_at, created_at) VALUES (?, 0, ?, ?)',
      candidateKey,
      nowMs,
      nowMs,
    );
    return this.loadCandidate(candidateKey);
  }

  // --- dispatch queue -----------------------------------------------------------------------

  async tick(nowMs: number): Promise<TickReport> {
    const report = {
      processedJobs: 0,
      dispatched: 0,
      rejected: 0,
      retried: 0,
      failed: 0,
      escalated: 0,
    };
    const jobs = this.sql
      .exec(
        'SELECT candidate_key, attempt FROM dispatch_jobs WHERE next_run_at <= ? ORDER BY next_run_at ASC LIMIT ?',
        nowMs,
        MAX_JOBS_PER_TICK,
      )
      .toArray();
    for (const job of jobs) {
      const candidateKey = text(job, 'candidate_key');
      if (this.dispatching.has(candidateKey)) continue;
      report.processedJobs += 1;
      const attempt = integer(job, 'attempt');
      const candidate = this.loadCandidate(candidateKey);
      if (!candidate || candidate.state !== 'ready') {
        this.sql.exec('DELETE FROM dispatch_jobs WHERE candidate_key = ?', candidateKey);
        continue;
      }
      this.dispatching.add(candidateKey);
      try {
        const outcome = await this.runDispatch(candidate, attempt, nowMs);
        if (outcome !== 'superseded') report[outcome] += 1;
      } finally {
        this.dispatching.delete(candidateKey);
      }
    }
    report.escalated = this.escalateIncidents(nowMs);
    this.pruneDeliveries(nowMs);
    const nextAlarmAt = await this.scheduleAlarm();
    return { ...report, nextAlarmAt };
  }

  private async runDispatch(
    candidate: CandidateRow,
    attempt: number,
    nowMs: number,
  ): Promise<'dispatched' | 'rejected' | 'retried' | 'failed' | 'superseded'> {
    const { candidateKey } = candidate;
    const generationRow = this.sql
      .exec('SELECT generation FROM dispatch_generations WHERE candidate_key = ?', candidateKey)
      .toArray()[0];
    const generation = generationRow ? text(generationRow, 'generation') : '';
    const stillCurrent = (): boolean => {
      const current = this.sql
        .exec(
          `SELECT generations.generation FROM dispatch_generations generations
         JOIN dispatch_jobs jobs USING (candidate_key)
         JOIN candidates USING (candidate_key)
         WHERE candidate_key = ? AND candidates.state = 'ready'`,
          candidateKey,
        )
        .toArray()[0];
      return current !== undefined && text(current, 'generation') === generation;
    };
    let outcome: GateDispatchOutcome;
    try {
      outcome = await this.deps.dispatchGate(candidate.tuple, candidateKey);
    } catch (error) {
      if (!stillCurrent()) return 'superseded';
      const retryable = error instanceof GitHubTransportError && error.retryable;
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      if (retryable)
        return this.retryOrFail(
          candidateKey,
          attempt,
          message,
          'dispatch_transport_exhausted',
          nowMs,
        );
      return this.failCandidate(candidateKey, 'dispatch_error', message, nowMs);
    }
    // Another delivery can arrive while GitHub is awaited. It owns the newer
    // queue generation (or closed state); never clear it with this stale result.
    if (!stillCurrent()) return 'superseded';
    if (outcome.result === 'dispatched') {
      this.sql.exec(
        'UPDATE dispatch_generations SET dispatched_generation = ? WHERE candidate_key = ?',
        generation,
        candidateKey,
      );
      this.sql.exec(
        "UPDATE candidates SET state = 'dispatched', reason = NULL, gate_dispatched_at = ?, updated_at = ? WHERE candidate_key = ?",
        new Date(nowMs).toISOString(),
        nowMs,
        candidateKey,
      );
      this.sql.exec('DELETE FROM dispatch_jobs WHERE candidate_key = ?', candidateKey);
      this.log('info', 'ci.gate.dispatched', {
        candidateKey,
        profile: candidate.tuple.profile,
        testedSha: candidate.tuple.testedSha,
        workflowId: outcome.workflowId,
      });
      await this.recordEvidence('dispatch', `${candidateKey}.${crypto.randomUUID()}`, {
        tuple: candidate.tuple,
        workflowId: outcome.workflowId,
        ref: outcome.ref,
        attempt: attempt + 1,
        hostedGeneration: generation,
      });
      return 'dispatched';
    }
    if (outcome.result === 'rejected') {
      this.setCandidateState(candidateKey, 'rejected', outcome.reason, nowMs);
      this.sql.exec('DELETE FROM dispatch_jobs WHERE candidate_key = ?', candidateKey);
      this.log('warn', 'ci.gate.rejected', { candidateKey, reason: outcome.reason });
      return 'rejected';
    }
    return this.retryOrFail(
      candidateKey,
      attempt,
      outcome.reason,
      'readback_not_ready_exhausted',
      nowMs,
    );
  }

  private retryOrFail(
    candidateKey: string,
    attempt: number,
    lastError: string,
    exhaustedReason: string,
    nowMs: number,
  ): 'retried' | 'failed' {
    const nextAttempt = attempt + 1;
    const delay = DISPATCH_RETRY_SCHEDULE_MS[attempt];
    if (nextAttempt >= DISPATCH_MAX_ATTEMPTS || delay === undefined) {
      return this.failCandidate(candidateKey, exhaustedReason, lastError, nowMs);
    }
    this.sql.exec(
      'UPDATE dispatch_jobs SET attempt = ?, next_run_at = ?, last_error = ? WHERE candidate_key = ?',
      nextAttempt,
      nowMs + delay,
      lastError.slice(0, 256),
      candidateKey,
    );
    this.log('warn', 'ci.gate.dispatch_retry_scheduled', {
      candidateKey,
      attempt: nextAttempt,
      delayMs: delay,
    });
    return 'retried';
  }

  private failCandidate(
    candidateKey: string,
    reason: string,
    detail: string,
    nowMs: number,
  ): 'failed' {
    this.setCandidateState(candidateKey, 'failed', reason, nowMs);
    this.sql.exec('DELETE FROM dispatch_jobs WHERE candidate_key = ?', candidateKey);
    this.log('error', 'ci.gate.dispatch_failed', {
      candidateKey,
      reason,
      detail: detail.slice(0, 256),
    });
    this.applyObservations([{ ...DISPATCH_INCIDENT, failureClass: reason, healthy: false }], nowMs);
    return 'failed';
  }

  private async scheduleAlarm(): Promise<string | null> {
    const next = this.sql
      .exec('SELECT MIN(next_run_at) AS next_run_at FROM dispatch_jobs')
      .toArray()[0];
    const nextRunAt = next ? next.next_run_at : null;
    if (typeof nextRunAt !== 'number') {
      await this.storage.deleteAlarm();
      return null;
    }
    const scheduled = Math.max(nextRunAt, this.deps.now() + 1_000);
    await this.storage.setAlarm(scheduled);
    return new Date(scheduled).toISOString();
  }

  private async recordEvidence(
    kind: EvidenceKind,
    id: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    try {
      const result = await this.deps.writeEvidence(kind, id, payload);
      if (!result.ok) this.log('warn', 'evidence.write_skipped', { kind, reason: result.reason });
    } catch (error) {
      this.log('warn', 'evidence.write_failed', {
        kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // --- heartbeat ---------------------------------------------------------------------------

  private handleHeartbeat(body: Record<string, unknown>): Response {
    const heartbeat = body.heartbeat;
    const receivedAt =
      typeof body.receivedAt === 'string' ? Date.parse(body.receivedAt) : Number.NaN;
    if (!isRecord(heartbeat) || !Number.isFinite(receivedAt)) {
      return json({ error: 'Invalid heartbeat envelope.' }, { status: 400 });
    }
    this.recordHeartbeat(heartbeat as unknown as ControllerHeartbeat, receivedAt);
    return json({ recorded: true }, { status: 202 });
  }

  recordHeartbeat(heartbeat: ControllerHeartbeat, receivedAtMs: number): void {
    this.sql.exec(
      "INSERT INTO state (key, value) VALUES ('heartbeat', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      JSON.stringify({ heartbeat, receivedAtMs }),
    );
    this.applyObservations(
      [
        {
          service: 'local-ci-controller',
          environment: 'control-plane',
          failureClass: 'heartbeat_stale',
          healthy: true,
        },
      ],
      receivedAtMs,
    );
  }

  private readHeartbeat(): { heartbeat: ControllerHeartbeat; receivedAtMs: number } | null {
    const row = this.sql.exec("SELECT value FROM state WHERE key = 'heartbeat'").toArray()[0];
    if (!row) return null;
    const parsed: unknown = JSON.parse(text(row, 'value'));
    if (!isRecord(parsed) || !isRecord(parsed.heartbeat) || typeof parsed.receivedAtMs !== 'number')
      return null;
    return {
      heartbeat: parsed.heartbeat as unknown as ControllerHeartbeat,
      receivedAtMs: parsed.receivedAtMs,
    };
  }

  // --- incidents ---------------------------------------------------------------------------

  private handleObservations(body: Record<string, unknown>): Response {
    const observations = body.observations;
    const nowMs = this.readNow(body);
    if (!Array.isArray(observations) || observations.length > 64) {
      return json({ error: 'Invalid observations.' }, { status: 400 });
    }
    const typed = observations.filter(
      (entry): entry is HealthObservation =>
        isRecord(entry) &&
        typeof entry.service === 'string' &&
        typeof entry.environment === 'string' &&
        typeof entry.failureClass === 'string' &&
        typeof entry.healthy === 'boolean',
    );
    if (typed.length !== observations.length || !typed.every(isValidObservation)) {
      return json({ error: 'Invalid observations.' }, { status: 400 });
    }
    return json(this.applyObservations(typed, nowMs));
  }

  private findActiveIncident(key: string): IncidentSummary | null {
    const row = this.sql
      .exec(
        "SELECT * FROM incidents WHERE incident_key = ? AND status <> 'resolved' ORDER BY opened_at DESC LIMIT 1",
        key,
      )
      .toArray()[0];
    return row ? incidentFromRow(row) : null;
  }

  private saveIncident(key: string, incident: IncidentSummary): void {
    this.sql.exec(
      `INSERT INTO incidents (id, incident_key, service, environment, failure_class, status, opened_at, last_seen_at, escalated_at, acknowledged_at, resolved_at, healthy_streak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, last_seen_at = excluded.last_seen_at, escalated_at = excluded.escalated_at,
         acknowledged_at = excluded.acknowledged_at, resolved_at = excluded.resolved_at, healthy_streak = excluded.healthy_streak`,
      incident.id,
      key,
      incident.service,
      incident.environment,
      incident.failureClass,
      incident.status,
      incident.openedAt,
      incident.lastSeenAt,
      incident.escalatedAt,
      incident.acknowledgedAt,
      incident.resolvedAt,
      incident.healthyStreak,
    );
  }

  applyObservations(
    observations: readonly HealthObservation[],
    nowMs: number,
  ): ObservationRecordResult {
    const transitions: { key: string; transition: string; incidentId: string | null }[] = [];
    for (const observation of observations) {
      const key = incidentKey(observation);
      const update = applyObservation({
        existing: this.findActiveIncident(key),
        observation,
        nowMs,
        newId: this.deps.newId,
      });
      if (update.transition !== 'none' && update.incident) {
        this.saveIncident(key, update.incident);
        if (update.transition === 'opened' || update.transition === 'resolved') {
          this.log(
            update.transition === 'opened' ? 'error' : 'info',
            `incident.${update.transition}`,
            {
              incidentId: update.incident.id,
              service: observation.service,
              environment: observation.environment,
              failureClass: observation.failureClass,
            },
          );
        }
      }
      transitions.push({
        key,
        transition: update.transition,
        incidentId: update.incident?.id ?? null,
      });
    }
    return { transitions };
  }

  private escalateIncidents(nowMs: number): number {
    const rows = this.sql
      .exec("SELECT * FROM incidents WHERE status = 'open' AND acknowledged_at IS NULL")
      .toArray();
    let escalated = 0;
    for (const row of rows) {
      const update = escalateIfDue(incidentFromRow(row), nowMs);
      if (update.transition === 'escalated' && update.incident) {
        this.saveIncident(text(row, 'incident_key'), update.incident);
        escalated += 1;
        this.log('error', 'incident.escalated', {
          incidentId: update.incident.id,
          service: update.incident.service,
          environment: update.incident.environment,
          failureClass: update.incident.failureClass,
        });
      }
    }
    return escalated;
  }

  acknowledge(id: string, nowMs: number): boolean {
    const row = this.sql.exec('SELECT * FROM incidents WHERE id = ?', id).toArray()[0];
    if (!row) return false;
    const updated = acknowledgeIncident(incidentFromRow(row), nowMs);
    if (!updated) return false;
    this.saveIncident(text(row, 'incident_key'), updated);
    return true;
  }

  // --- status ------------------------------------------------------------------------------

  status(): CoordinatorStatus {
    const nowMs = this.deps.now();
    const stored = this.readHeartbeat();
    const ageMs = stored ? Math.max(0, nowMs - stored.receivedAtMs) : null;
    const counts: Record<CandidateState, number> = {
      pending: 0,
      ready: 0,
      dispatched: 0,
      rejected: 0,
      closed: 0,
      failed: 0,
    };
    for (const row of this.sql
      .exec('SELECT state, COUNT(*) AS total FROM candidates GROUP BY state')
      .toArray()) {
      counts[candidateStateOf(text(row, 'state'))] = integer(row, 'total');
    }
    const queue = this.sql
      .exec('SELECT COUNT(*) AS depth, MIN(next_run_at) AS next_run_at FROM dispatch_jobs')
      .toArray()[0];
    const nextRunAt =
      queue && typeof queue.next_run_at === 'number'
        ? new Date(queue.next_run_at).toISOString()
        : null;
    const active = this.sql
      .exec("SELECT * FROM incidents WHERE status <> 'resolved' ORDER BY opened_at ASC LIMIT 50")
      .toArray()
      .map(incidentFromRow);
    const tracked = this.sql.exec('SELECT COUNT(*) AS total FROM deliveries').toArray()[0];
    return {
      heartbeat: {
        state: heartbeatStateFor(ageMs),
        lastSeenAt: stored ? new Date(stored.receivedAtMs).toISOString() : null,
        ageMs,
        controllerId: stored?.heartbeat.controllerId ?? null,
        controllerVersion: stored?.heartbeat.controllerVersion ?? null,
        activeRuntime: (stored?.heartbeat.activeRuntime as Runtime | undefined) ?? null,
        candidateRuntime: (stored?.heartbeat.candidateRuntime as Runtime | undefined) ?? null,
      },
      candidates: counts,
      retryQueue: { depth: queue ? integer(queue, 'depth') : 0, nextRunAt },
      incidents: { active },
      deliveries: { tracked: tracked ? integer(tracked, 'total') : 0 },
    };
  }
}
