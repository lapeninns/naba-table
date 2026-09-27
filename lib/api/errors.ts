import { NextResponse } from 'next/server';

import { logger, sanitizeLogText } from '@/lib/logger';

/**
 * C1 flat error body. `error` mirrors `message` so existing `{ error: string }`
 * readers keep working. `message` must be safe to show: never Postgres,
 * Supabase or provider text, and never PII.
 */
export type ApiErrorBody = {
  error: string;
  code: string;
  message: string;
  fields?: Record<string, string[]>;
  retryable?: boolean;
  retryAfter?: number;
  details?: unknown;
};

export type ApiErrorOptions = {
  fields?: Record<string, string[]>;
  retryable?: boolean;
  retryAfter?: number;
  details?: unknown;
  headers?: HeadersInit;
};

export const INTERNAL_ERROR_MESSAGE = 'Something went wrong on our side. Try again.';
export const VALIDATION_FAILED_MESSAGE = 'Some fields need attention.';
/** Key used for zod issues that have no path (for example a top-level refine). */
export const ROOT_FIELD_KEY = '_root';

export function apiError(
  status: number,
  code: string,
  message: string,
  opts: ApiErrorOptions = {},
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: message, code, message };
  if (opts.fields !== undefined) body.fields = opts.fields;
  if (opts.retryable !== undefined) body.retryable = opts.retryable;
  if (opts.retryAfter !== undefined) body.retryAfter = opts.retryAfter;
  if (opts.details !== undefined) body.details = opts.details;
  return NextResponse.json(body, { status, headers: opts.headers });
}

type ZodIssueLike = { readonly path: ReadonlyArray<PropertyKey>; readonly message: string };

/** Builds dot-path field messages from zod v4 issues (no deprecated `flatten`). */
export function fieldsFromIssues(issues: ReadonlyArray<ZodIssueLike>): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of issues) {
    const key =
      issue.path.length > 0 ? issue.path.map((part) => String(part)).join('.') : ROOT_FIELD_KEY;
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export function validationError(
  zodError: { readonly issues: ReadonlyArray<ZodIssueLike> },
  message: string = VALIDATION_FAILED_MESSAGE,
): NextResponse<ApiErrorBody> {
  return apiError(400, 'VALIDATION_FAILED', message, { fields: fieldsFromIssues(zodError.issues) });
}

export function unauthenticated(message = 'Sign in to continue.'): NextResponse<ApiErrorBody> {
  return apiError(401, 'UNAUTHENTICATED', message);
}

export function forbidden(
  code = 'FORBIDDEN',
  message = "You don't have permission to do that.",
): NextResponse<ApiErrorBody> {
  return apiError(403, code, message);
}

export function notFound(code = 'NOT_FOUND', message = 'Not found.'): NextResponse<ApiErrorBody> {
  return apiError(404, code, message);
}

export function conflict(
  code: string,
  message: string,
  opts?: ApiErrorOptions,
): NextResponse<ApiErrorBody> {
  return apiError(409, code, message, opts);
}

export function rateLimited(
  retryAfterSeconds: number,
  message = 'Too many attempts. Wait a moment and try again.',
): NextResponse<ApiErrorBody> {
  const seconds = Number.isFinite(retryAfterSeconds)
    ? Math.max(0, Math.ceil(retryAfterSeconds))
    : 0;
  return apiError(429, 'RATE_LIMITED', message, {
    retryable: true,
    retryAfter: seconds,
    headers: { 'Retry-After': String(seconds) },
  });
}

type ThrowableLogMeta = {
  errorName: string;
  errorKind?: string;
  errorMessage?: string;
  errorStack?: string;
};

/**
 * Server-side diagnostics for an unexpected failure. Message and stack go
 * through the logger's text sanitizer (emails, phones, secrets, query strings)
 * and are never sent to the client.
 */
function describeThrowable(err: unknown): ThrowableLogMeta {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    const meta: ThrowableLogMeta = { errorName: err.name };
    if (typeof code === 'string' || typeof code === 'number') meta.errorKind = String(code);
    if (err.message) meta.errorMessage = sanitizeLogText(err.message);
    if (err.stack) meta.errorStack = sanitizeLogText(err.stack);
    return meta;
  }
  if (typeof err === 'string') {
    return { errorName: 'string', errorMessage: sanitizeLogText(err) };
  }
  if (typeof err === 'object' && err !== null) {
    // Supabase/PostgREST results carry plain `{ message, code, details, hint }` objects, not Error
    // instances. Log the code and the sanitised message only: `details` and `hint` echo row
    // values (for example the conflicting email in a unique violation), so they are never logged.
    const record = err as { name?: unknown; message?: unknown; code?: unknown };
    const message = typeof record.message === 'string' ? record.message : '';
    const hasMessage = message.length > 0;
    const hasCode =
      (typeof record.code === 'string' && record.code.length > 0) ||
      typeof record.code === 'number';
    if (hasMessage || hasCode) {
      const meta: ThrowableLogMeta = {
        errorName:
          typeof record.name === 'string' && record.name.length > 0
            ? sanitizeLogText(record.name)
            : 'PostgrestError',
      };
      if (hasCode) meta.errorKind = sanitizeLogText(String(record.code));
      if (hasMessage) meta.errorMessage = sanitizeLogText(message);
      return meta;
    }
    return { errorName: 'object' };
  }
  return { errorName: err === null ? 'null' : typeof err };
}

/**
 * Logs an unexpected failure (name, code, sanitized message and stack) and
 * returns the generic 500 without any of that text. Keys containing "code" are
 * redacted by lib/logger, so the code is logged as `errorKind`.
 */
export const UPSTREAM_UNAVAILABLE_MESSAGE =
  'We couldn’t reach the server just now. Try again in a moment.';
export const OUTCOME_UNKNOWN_MESSAGE =
  'We couldn’t confirm this was saved. Refresh to check before trying again.';
const UPSTREAM_RETRY_AFTER_SECONDS = 2;

/** Network-level failures reaching Supabase/PostgREST (undici `fetch`), not database errors. */
const UPSTREAM_NETWORK_FAILURE =
  /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|other side closed|UND_ERR_/i;
/** Failures that happen before the request is sent, so nothing can have been written. */
const FAILED_BEFORE_SEND = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT/i;
/** A five-character SQLSTATE means the database answered, so it is not a network failure. */
const SQLSTATE = /^[0-9A-Z]{5}$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const record = value as { message?: unknown; code?: unknown; cause?: unknown };
    return [record.message, record.code]
      .filter((part): part is string => typeof part === 'string')
      .concat(record.cause !== undefined ? [textOf(record.cause)] : [])
      .join(' ');
  }
  return '';
}

/**
 * True when the request never got a database answer (connection refused or reset, DNS, timeout),
 * as supabase-js reports it: a PostgrestError whose message is "TypeError: fetch failed" and whose
 * code is empty.
 */
export function isUpstreamUnavailable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && SQLSTATE.test(code)) return false;
  return UPSTREAM_NETWORK_FAILURE.test(textOf(err));
}

/** HTTP method from `ctx.method` or a "POST /api/..." route label; unknown means a write. */
function requestMethod(ctx: { route: string; method?: unknown }): string | null {
  if (typeof ctx.method === 'string') return ctx.method.toUpperCase();
  const match = /^(GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)\s/i.exec(ctx.route);
  return match?.[1]?.toUpperCase() ?? null;
}

export function internalError(
  err: unknown,
  ctx: { route: string; [key: string]: unknown },
  message: string = INTERNAL_ERROR_MESSAGE,
): NextResponse<ApiErrorBody> {
  if (isUpstreamUnavailable(err)) {
    const method = requestMethod(ctx);
    // A write whose connection dropped mid-flight may already have committed. Replaying it
    // could duplicate a non-idempotent change, so it is never advertised as retryable.
    const safeToRetry =
      FAILED_BEFORE_SEND.test(textOf(err)) || (method !== null && SAFE_METHODS.has(method));
    logger.warn('api.upstream_unavailable', {
      ...ctx,
      ...describeThrowable(err),
      outcome: safeToRetry ? 'not_sent' : 'unknown',
    });
    if (!safeToRetry) {
      return apiError(503, 'OUTCOME_UNKNOWN', OUTCOME_UNKNOWN_MESSAGE);
    }
    return apiError(503, 'UPSTREAM_UNAVAILABLE', UPSTREAM_UNAVAILABLE_MESSAGE, {
      retryable: true,
      retryAfter: UPSTREAM_RETRY_AFTER_SECONDS,
      headers: { 'Retry-After': String(UPSTREAM_RETRY_AFTER_SECONDS) },
    });
  }
  logger.error('api.internal_error', { ...ctx, ...describeThrowable(err) });
  return apiError(500, 'INTERNAL_ERROR', message);
}
