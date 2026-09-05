import {
  ALLOWED_WEBHOOK_EVENTS,
  CI_PROFILES,
  GITHUB_ACTIONS_APP_ID,
  IMAGE_DIGEST_PATTERN,
  LOCAL_CHECK_NAME_PREFIX,
  NUMERIC_ID_PATTERN,
  SAFE_IDENTIFIER_PATTERN,
  SHA_PATTERN,
  TUPLE_KEY_PREFIX,
  WEBHOOK_FUTURE_SKEW_MS,
  WEBHOOK_REPLAY_WINDOW_MS,
} from './contracts';
import { isRecord } from './http';

import type { ControlPlaneConfig } from './config';
import type {
  CheckConclusion,
  CheckStatus,
  CiProfile,
  CiRequestTuple,
  NormalizedEvent,
  WebhookDelivery,
  WebhookEventType,
} from './contracts';

export type WebhookRejection = {
  readonly ok: false;
  readonly status: 400 | 403 | 422;
  readonly code:
    | 'missing_delivery_id'
    | 'unsupported_event'
    | 'invalid_payload'
    | 'wrong_repository'
    | 'unexpected_app'
    | 'invalid_tuple'
    | 'stale_delivery';
};

export type WebhookAcceptance = { readonly ok: true; readonly delivery: WebhookDelivery };
export type WebhookParseResult = WebhookAcceptance | WebhookRejection;

const DELIVERY_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/u;
const CHECK_STATUSES: readonly CheckStatus[] = ['queued', 'in_progress', 'completed'];
const CHECK_CONCLUSIONS: readonly CheckConclusion[] = [
  'success',
  'failure',
  'neutral',
  'cancelled',
  'timed_out',
  'action_required',
  'stale',
  'skipped',
];
const WORKFLOW_PATH_PATTERN = /^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/u;

function reject(
  status: WebhookRejection['status'],
  code: WebhookRejection['code'],
): WebhookRejection {
  return { ok: false, status, code };
}

function isWebhookEventType(value: string | null): value is WebhookEventType {
  return ALLOWED_WEBHOOK_EVENTS.includes(value as WebhookEventType);
}

function isPositiveInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function readSha(record: Record<string, unknown>, key: string): string | null {
  const value = readString(record, key);
  return value && SHA_PATTERN.test(value) ? value : null;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // GitHub emits `pushed_at` as epoch seconds on some payloads.
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function withinReplayWindow(occurredAtMs: number | null, nowMs: number): boolean {
  if (occurredAtMs === null) return false;
  return (
    occurredAtMs >= nowMs - WEBHOOK_REPLAY_WINDOW_MS &&
    occurredAtMs <= nowMs + WEBHOOK_FUTURE_SKEW_MS
  );
}

function readCheckStatus(value: unknown): CheckStatus | null {
  return CHECK_STATUSES.includes(value as CheckStatus) ? (value as CheckStatus) : null;
}

function readCheckConclusion(value: unknown): CheckConclusion | null | undefined {
  if (value === null) return null;
  return CHECK_CONCLUSIONS.includes(value as CheckConclusion)
    ? (value as CheckConclusion)
    : undefined;
}

/**
 * Number of `:`-separated fields in a tuple key: the prefix, ten tuple fields, and one extra
 * because `imageDigest` (`sha256:<hex>`) carries its own colon. No other field may contain one.
 */
const TUPLE_KEY_FIELD_COUNT = 12;
const CANONICAL_INTEGER_PATTERN = /^[1-9][0-9]{0,15}$/u;
const MAX_PR_NUMBER = 10_000_000;
const MAX_ATTEMPT = 100;

function parseCanonicalInteger(value: string, max: number): number | null {
  if (!CANONICAL_INTEGER_PATTERN.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

/**
 * Deterministic identity of a tuple, byte-identical to `tupleKey()` in
 * scripts/ci/gate/tuple.ts and scripts/ci/controller/github/evidence-document.ts. The
 * controller publishes it as the local check run's `external_id`; the gate refuses any check
 * whose `external_id` differs from it.
 */
export function ciRequestTupleKey(tuple: CiRequestTuple): string {
  return [
    TUPLE_KEY_PREFIX,
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
  ].join(':');
}

/**
 * Parses the tuple key the Mac controller stores in `check_run.external_id`. Only the exact
 * `nabatable-ci/v1:` key format is accepted (never JSON, never an object); every field is
 * validated on its own and the parsed tuple must re-serialize to the input byte for byte, so a
 * non-canonical spelling of any field fails closed.
 */
export function parseCiRequestTuple(
  raw: unknown,
  config: Pick<ControlPlaneConfig, 'repositoryId'>,
): CiRequestTuple | null {
  if (typeof raw !== 'string') return null;
  const fields = raw.split(':');
  if (fields.length !== TUPLE_KEY_FIELD_COUNT) return null;
  const field = (index: number): string => fields[index] ?? '';

  if (field(0) !== TUPLE_KEY_PREFIX) return null;
  const repositoryId = field(1);
  if (!NUMERIC_ID_PATTERN.test(repositoryId) || repositoryId !== config.repositoryId) return null;
  const profile = field(2);
  if (!CI_PROFILES.includes(profile as CiProfile)) return null;
  const prNumberField = field(3);
  const headSha = field(4);
  const baseSha = field(5);
  const testedSha = field(6);
  if (!SHA_PATTERN.test(headSha) || !SHA_PATTERN.test(baseSha) || !SHA_PATTERN.test(testedSha)) {
    return null;
  }
  const policyVersion = field(7);
  const imageDigest = `${field(8)}:${field(9)}`;
  const controllerVersion = field(10);
  if (
    !SAFE_IDENTIFIER_PATTERN.test(policyVersion) ||
    !IMAGE_DIGEST_PATTERN.test(imageDigest) ||
    !SAFE_IDENTIFIER_PATTERN.test(controllerVersion)
  ) {
    return null;
  }
  const attempt = parseCanonicalInteger(field(11), MAX_ATTEMPT);
  if (attempt === null) return null;

  let prNumber: number | undefined;
  if (profile === 'pr') {
    const parsed = parseCanonicalInteger(prNumberField, MAX_PR_NUMBER);
    if (parsed === null) return null;
    if (headSha === testedSha) return null; // PR candidates are tested on the synthetic merge SHA.
    prNumber = parsed;
  } else {
    if (prNumberField !== 'none') return null;
    if (headSha !== testedSha) return null; // main/nightly candidates test the merged SHA itself.
  }

  const tuple: CiRequestTuple = {
    repositoryId,
    profile: profile as CiProfile,
    ...(prNumber === undefined ? {} : { prNumber }),
    headSha,
    baseSha,
    testedSha,
    policyVersion,
    imageDigest,
    controllerVersion,
    attempt,
  };
  return ciRequestTupleKey(tuple) === raw ? tuple : null;
}

function normalizeCheckRun(
  payload: Record<string, unknown>,
  config: ControlPlaneConfig,
): NormalizedEvent | WebhookRejection {
  const checkRun = payload.check_run;
  if (!isRecord(checkRun) || !isRecord(checkRun.app)) return reject(400, 'invalid_payload');
  const appId = checkRun.app.id;
  const headSha = readSha(checkRun, 'head_sha');
  const status = readCheckStatus(checkRun.status);
  const conclusion = readCheckConclusion(checkRun.conclusion);
  const occurredAt = parseTimestamp(checkRun.completed_at ?? checkRun.started_at);
  if (!headSha || !status || conclusion === undefined || occurredAt === null) {
    return reject(400, 'invalid_payload');
  }
  if (appId === GITHUB_ACTIONS_APP_ID) {
    return {
      type: 'observed',
      kind: 'hosted_check',
      headSha,
      occurredAt: new Date(occurredAt).toISOString(),
    };
  }
  if (appId !== config.localCiAppId) return reject(403, 'unexpected_app');

  const name = readString(checkRun, 'name');
  if (!name || !name.startsWith(LOCAL_CHECK_NAME_PREFIX)) return reject(422, 'invalid_tuple');
  const tuple = parseCiRequestTuple(checkRun.external_id, config);
  if (
    !tuple ||
    tuple.headSha !== headSha ||
    `${LOCAL_CHECK_NAME_PREFIX}${tuple.profile}` !== name
  ) {
    return reject(422, 'invalid_tuple');
  }
  const checkRunId = checkRun.id;
  if (!isPositiveInteger(checkRunId)) return reject(400, 'invalid_payload');
  return {
    type: 'local_check',
    tuple,
    checkRunId,
    name,
    status,
    conclusion,
    occurredAt: new Date(occurredAt).toISOString(),
  };
}

function normalizeWorkflowRun(
  payload: Record<string, unknown>,
): NormalizedEvent | WebhookRejection {
  const run = payload.workflow_run;
  if (!isRecord(run)) return reject(400, 'invalid_payload');
  const headSha = readSha(run, 'head_sha');
  const workflowPath = readString(run, 'path');
  const status = readCheckStatus(run.status);
  const conclusion = readCheckConclusion(run.conclusion);
  const occurredAt = parseTimestamp(run.updated_at);
  if (
    !headSha ||
    !workflowPath ||
    !WORKFLOW_PATH_PATTERN.test(workflowPath) ||
    !status ||
    conclusion === undefined ||
    occurredAt === null ||
    !isPositiveInteger(run.id) ||
    !isPositiveInteger(run.workflow_id) ||
    !isPositiveInteger(run.run_attempt, 1000)
  ) {
    return reject(400, 'invalid_payload');
  }
  return {
    type: 'hosted_run',
    headSha,
    workflowPath,
    workflowId: run.workflow_id,
    runId: run.id,
    runAttempt: run.run_attempt,
    status,
    conclusion,
    occurredAt: new Date(occurredAt).toISOString(),
  };
}

function normalizePullRequest(
  payload: Record<string, unknown>,
): NormalizedEvent | WebhookRejection {
  const pullRequest = payload.pull_request;
  const action = readString(payload, 'action');
  if (!isRecord(pullRequest) || !isRecord(pullRequest.head) || !action) {
    return reject(400, 'invalid_payload');
  }
  const headSha = readSha(pullRequest.head, 'sha');
  const occurredAt = parseTimestamp(pullRequest.updated_at);
  if (
    !headSha ||
    !isPositiveInteger(pullRequest.number) ||
    occurredAt === null ||
    !SAFE_IDENTIFIER_PATTERN.test(action)
  ) {
    return reject(400, 'invalid_payload');
  }
  return {
    type: 'pull_request',
    action,
    prNumber: pullRequest.number,
    headSha,
    occurredAt: new Date(occurredAt).toISOString(),
  };
}

function normalizePush(payload: Record<string, unknown>): NormalizedEvent | WebhookRejection {
  const ref = readString(payload, 'ref');
  const afterSha = readSha(payload, 'after');
  const headCommit = payload.head_commit;
  const repository = payload.repository;
  const occurredAt = parseTimestamp(
    (isRecord(headCommit) ? headCommit.timestamp : undefined) ??
      (isRecord(repository) ? repository.pushed_at : undefined),
  );
  if (!ref || !/^refs\/[A-Za-z0-9._\-/]{1,200}$/u.test(ref) || !afterSha || occurredAt === null) {
    return reject(400, 'invalid_payload');
  }
  return { type: 'push', ref, afterSha, occurredAt: new Date(occurredAt).toISOString() };
}

function normalizeCheckSuite(payload: Record<string, unknown>): NormalizedEvent | WebhookRejection {
  const suite = payload.check_suite;
  if (!isRecord(suite)) return reject(400, 'invalid_payload');
  const headSha = readSha(suite, 'head_sha');
  const occurredAt = parseTimestamp(suite.updated_at);
  if (!headSha || occurredAt === null) return reject(400, 'invalid_payload');
  return {
    type: 'observed',
    kind: 'check_suite',
    headSha,
    occurredAt: new Date(occurredAt).toISOString(),
  };
}

function normalize(
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  config: ControlPlaneConfig,
): NormalizedEvent | WebhookRejection {
  switch (eventType) {
    case 'check_run':
      return normalizeCheckRun(payload, config);
    case 'workflow_run':
      return normalizeWorkflowRun(payload);
    case 'pull_request':
      return normalizePullRequest(payload);
    case 'push':
      return normalizePush(payload);
    case 'check_suite':
      return normalizeCheckSuite(payload);
  }
}

/**
 * Validates an already signature-verified GitHub webhook and normalizes it into the
 * coordinator's event shape. Payload success flags are never trusted downstream; the
 * coordinator performs an authoritative readback before acting.
 */
export function parseWebhookDelivery(input: {
  readonly headers: Headers;
  readonly payload: unknown;
  readonly config: ControlPlaneConfig;
  readonly nowMs: number;
}): WebhookParseResult {
  const deliveryId = input.headers.get('x-github-delivery')?.trim() ?? '';
  if (!DELIVERY_ID_PATTERN.test(deliveryId)) return reject(400, 'missing_delivery_id');
  const eventType = input.headers.get('x-github-event')?.trim().toLowerCase() ?? null;
  if (!isWebhookEventType(eventType)) return reject(400, 'unsupported_event');
  if (!isRecord(input.payload)) return reject(400, 'invalid_payload');

  const repository = input.payload.repository;
  if (!isRecord(repository) || !isPositiveInteger(repository.id))
    return reject(400, 'invalid_payload');
  if (String(repository.id) !== input.config.repositoryId) return reject(403, 'wrong_repository');

  const normalized = normalize(eventType, input.payload, input.config);
  if ('ok' in normalized) return normalized;
  if (!withinReplayWindow(parseTimestamp(normalized.occurredAt), input.nowMs)) {
    return reject(403, 'stale_delivery');
  }
  return { ok: true, delivery: { deliveryId, eventType, event: normalized } };
}
