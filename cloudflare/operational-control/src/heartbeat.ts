import {
  HEARTBEAT_SKEW_MS,
  IMAGE_DIGEST_PATTERN,
  RUNTIMES,
  SAFE_IDENTIFIER_PATTERN,
} from './contracts';
import { isRecord } from './http';

import type { ControllerHeartbeat, ControllerStatus, Runtime } from './contracts';

export type HeartbeatValidation =
  | { readonly ok: true; readonly heartbeat: ControllerHeartbeat }
  | { readonly ok: false; readonly reason: string };

/** Keys that look like credentials are rejected outright: the heartbeat is telemetry only. */
export const CREDENTIAL_KEY_PATTERN =
  /authorization|cookie|password|passwd|secret|token|api[-_]?key|private[-_]?key|credential|bearer|jwt|session|signature/iu;

const CONTROLLER_STATUSES: readonly ControllerStatus[] = ['idle', 'busy', 'draining'];
const ALLOWED_KEYS = new Set([
  'controllerId',
  'controllerVersion',
  'imageDigest',
  'activeRuntime',
  'candidateRuntime',
  'status',
  'sentAt',
  'queueDepth',
  'running',
  'maxConcurrent',
  'lastCompletedAt',
]);

function fail(reason: string): HeartbeatValidation {
  return { ok: false, reason };
}

function readBoundedInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    return null;
  return value;
}

function readRuntime(value: unknown): Runtime | null {
  return RUNTIMES.includes(value as Runtime) ? (value as Runtime) : null;
}

function readIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function validateHeartbeat(body: unknown, nowMs: number): HeartbeatValidation {
  if (!isRecord(body)) return fail('body_not_object');
  const keys = Object.keys(body);
  const credentialKey = keys.find((key) => CREDENTIAL_KEY_PATTERN.test(key));
  if (credentialKey) return fail('credential_like_key');
  const unknownKey = keys.find((key) => !ALLOWED_KEYS.has(key));
  if (unknownKey) return fail('unknown_key');
  if (keys.some((key) => typeof body[key] === 'object' && body[key] !== null)) {
    return fail('nested_values_not_allowed');
  }

  const controllerId = body.controllerId;
  const controllerVersion = body.controllerVersion;
  const imageDigest = body.imageDigest;
  if (typeof controllerId !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(controllerId)) {
    return fail('invalid_controller_id');
  }
  if (typeof controllerVersion !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(controllerVersion)) {
    return fail('invalid_controller_version');
  }
  if (typeof imageDigest !== 'string' || !IMAGE_DIGEST_PATTERN.test(imageDigest)) {
    return fail('invalid_image_digest');
  }
  const activeRuntime = readRuntime(body.activeRuntime);
  const candidateRuntime = readRuntime(body.candidateRuntime);
  if (!activeRuntime || !candidateRuntime) return fail('invalid_runtime');
  const status = body.status;
  if (!CONTROLLER_STATUSES.includes(status as ControllerStatus)) return fail('invalid_status');
  const sentAt = readIsoTimestamp(body.sentAt);
  if (!sentAt) return fail('invalid_sent_at');
  const sentAtMs = Date.parse(sentAt);
  if (Math.abs(sentAtMs - nowMs) > HEARTBEAT_SKEW_MS) return fail('sent_at_out_of_window');
  const queueDepth = readBoundedInteger(body.queueDepth, 0, 10_000);
  const running = readBoundedInteger(body.running, 0, 64);
  const maxConcurrent = readBoundedInteger(body.maxConcurrent, 1, 64);
  if (
    queueDepth === null ||
    running === null ||
    maxConcurrent === null ||
    running > maxConcurrent
  ) {
    return fail('invalid_capacity');
  }
  let lastCompletedAt: string | undefined;
  if (body.lastCompletedAt !== undefined) {
    const parsed = readIsoTimestamp(body.lastCompletedAt);
    if (!parsed) return fail('invalid_last_completed_at');
    lastCompletedAt = parsed;
  }

  return {
    ok: true,
    heartbeat: {
      controllerId,
      controllerVersion,
      imageDigest,
      activeRuntime,
      candidateRuntime,
      status: status as ControllerStatus,
      sentAt,
      queueDepth,
      running,
      maxConcurrent,
      ...(lastCompletedAt ? { lastCompletedAt } : {}),
    },
  };
}
