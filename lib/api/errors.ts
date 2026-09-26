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
  return { errorName: err === null ? 'null' : typeof err };
}

/**
 * Logs an unexpected failure (name, code, sanitized message and stack) and
 * returns the generic 500 without any of that text. Keys containing "code" are
 * redacted by lib/logger, so the code is logged as `errorKind`.
 */
export function internalError(
  err: unknown,
  ctx: { route: string; [key: string]: unknown },
  message: string = INTERNAL_ERROR_MESSAGE,
): NextResponse<ApiErrorBody> {
  logger.error('api.internal_error', { ...ctx, ...describeThrowable(err) });
  return apiError(500, 'INTERNAL_ERROR', message);
}
