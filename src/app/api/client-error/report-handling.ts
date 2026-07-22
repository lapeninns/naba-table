import { stripUrlQueryAndHash } from '@/lib/security/url-redaction';

export const MAX_CLIENT_ERROR_BODY_BYTES = 16 * 1024;
export const GENERIC_SCRIPT_ERROR_PATTERN = /^script error\.?$/i;
export const SUPABASE_USER_ID_PATTERN = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/;

const ANALYTICS_DEDUPE_TTL_MS = 5 * 60_000;
const ANALYTICS_DEDUPE_MAX_ENTRIES = 500;

export type ClientErrorPayload = {
  bookingId: string | null;
  message: string | null;
  path: string | null;
  stack: string | null;
  type: 'error' | 'unhandledrejection';
  userId: string | null;
};

type DedupeEntry = {
  count: number;
  expiresAt: number;
};

// Per-instance duplicate suppression for the analytics event: the log remains
// the complete record; PostHog receives one client_error_reported per
// fingerprint per TTL window per serverless instance.
const analyticsDedupe = new Map<string, DedupeEntry>();

export function resetClientErrorRouteStateForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetClientErrorRouteStateForTests is test-only');
  }
  analyticsDedupe.clear();
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

export function parseClientErrorPayload(value: unknown): ClientErrorPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const path = readOptionalString(record, 'path');
  const message = readOptionalString(record, 'message');
  const stack = readOptionalString(record, 'stack');
  const userId = readOptionalString(record, 'userId');
  const bookingId = readOptionalString(record, 'bookingId');
  const rawType = readOptionalString(record, 'type');

  if (path === undefined || message === undefined) {
    return null;
  }

  if (!path || !message || message.length > 1000 || (stack && stack.length > 8000)) {
    return null;
  }

  return {
    path,
    message,
    stack: stack ?? null,
    type: rawType === 'unhandledrejection' ? 'unhandledrejection' : 'error',
    userId: userId ?? null,
    bookingId: bookingId ?? null,
  };
}

export function computeServerClientErrorFingerprint(payload: {
  type: string;
  message: string;
  stack: string | null;
  path: string;
}): string {
  const firstStackLine =
    payload.stack
      ?.split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';
  const material = `${payload.type}|${payload.message.slice(0, 200)}|${firstStackLine.slice(0, 200)}|${stripUrlQueryAndHash(payload.path)}`;

  let hash = 5381;
  for (let index = 0; index < material.length; index += 1) {
    hash = ((hash << 5) + hash + material.charCodeAt(index)) | 0;
  }
  return `f${(hash >>> 0).toString(16)}`;
}

function isLocalOriginValue(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return (
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('[::1]') ||
    normalized.includes('.local/') ||
    normalized.endsWith('.local')
  );
}

/**
 * Production analytics gate: only a production deployment serving
 * non-localhost traffic may emit client_error_reported. Development servers
 * and local test harnesses keep the structured log (tagged with their own
 * deployment environment) but never pollute production analytics.
 */
export function shouldCaptureClientErrorAnalytics(headers: Pick<Headers, 'get'>): boolean {
  const deploymentEnv =
    process.env.VERCEL_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown';
  if (deploymentEnv !== 'production') return false;

  return !(
    isLocalOriginValue(headers.get('origin')) ||
    isLocalOriginValue(headers.get('referer')) ||
    isLocalOriginValue(headers.get('host'))
  );
}

/**
 * Registers a fingerprint occurrence for analytics dedupe. Returns the entry;
 * `count === 1` means this is the first occurrence within the TTL window and
 * the analytics event should be captured.
 */
export function registerAnalyticsFingerprint(fingerprint: string, now: number): DedupeEntry {
  if (analyticsDedupe.size >= ANALYTICS_DEDUPE_MAX_ENTRIES) {
    for (const [key, entry] of analyticsDedupe) {
      if (entry.expiresAt <= now) analyticsDedupe.delete(key);
    }
    if (analyticsDedupe.size >= ANALYTICS_DEDUPE_MAX_ENTRIES) {
      analyticsDedupe.clear();
    }
  }

  const existing = analyticsDedupe.get(fingerprint);
  if (existing && existing.expiresAt > now) {
    existing.count += 1;
    return existing;
  }

  const entry: DedupeEntry = { count: 1, expiresAt: now + ANALYTICS_DEDUPE_TTL_MS };
  analyticsDedupe.set(fingerprint, entry);
  return entry;
}
