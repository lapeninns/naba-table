import { randomBytes, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { buildCsrfCookieOptions, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { recordSecurityEvent } from '@/server/security/events';
import { anonymizeIp, extractClientIp } from '@/server/security/request';

import type { NextRequest } from 'next/server';

const TOKEN_LENGTH_BYTES = 32;
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_FAILURE_EVENT_WINDOW_MS = 60_000;
const CSRF_FAILURE_EVENT_BUCKET_LIMIT = 500;
const csrfFailureEventBuckets = new Map<string, number>();

async function shouldUseSecureCookie() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  if (rootDomain === 'localhost') {
    return false;
  }
  const headerList = await headers();
  const proto = headerList.get('x-forwarded-proto');
  if (proto) {
    return proto.split(',')[0]?.trim().toLowerCase() === 'https';
  }
  return env.node.appEnv !== 'development';
}

export async function ensureCsrfCookie(): Promise<string> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const token = existingToken ?? randomBytes(TOKEN_LENGTH_BYTES).toString('hex');
  const secure = await shouldUseSecureCookie();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  const cookieOptions = buildCsrfCookieOptions({ rootDomain, secure });

  if (!existingToken && typeof (cookieStore as { set?: unknown }).set === 'function') {
    cookieStore.set({
      name: CSRF_COOKIE_NAME,
      value: token,
      ...cookieOptions,
      priority: 'high',
    });
  }

  return token;
}

export function validateCsrfToken(req: NextRequest): boolean {
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!headerToken || !cookieToken) {
    return false;
  }

  const headerBuffer = Buffer.from(headerToken);
  const cookieBuffer = Buffer.from(cookieToken);

  if (headerBuffer.length !== cookieBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(headerBuffer, cookieBuffer);
  } catch {
    return false;
  }
}

export function isUnsafeMutationMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

export function createCsrfFailureResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid or missing CSRF token',
      code: 'CSRF_INVALID',
      message: 'Invalid or missing CSRF token',
    },
    { status: 403 },
  );
}

export function createSessionExpiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Session expired or unavailable',
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Refresh the page and try again.',
    },
    { status: 419 },
  );
}

export function createUnsafeMethodRequiredResponse(method: string): NextResponse {
  return NextResponse.json(
    {
      error: 'CSRF-protected mutations require an unsafe HTTP method',
      code: 'UNSAFE_METHOD_REQUIRED',
      message: 'CSRF-protected mutations require POST, PUT, PATCH, or DELETE.',
      method,
    },
    { status: 405 },
  );
}

function normalizeCsrfFailurePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          segment,
        ) ||
        (segment.length >= 20 && /^[A-Za-z0-9_-]+$/.test(segment))
      ) {
        return ':param';
      }
      return segment;
    })
    .join('/');
}

function pruneExpiredCsrfFailureBuckets(current: number): void {
  for (const [bucketKey, bucketNextAllowedAt] of csrfFailureEventBuckets) {
    if (bucketNextAllowedAt <= current) {
      csrfFailureEventBuckets.delete(bucketKey);
    }
  }
}

function shouldRecordCsrfFailureEvent(req: NextRequest): boolean {
  const path = normalizeCsrfFailurePath(req.nextUrl.pathname);
  const ipScope = anonymizeIp(extractClientIp(req));
  const key = [
    req.method.toUpperCase(),
    path,
    ipScope,
    req.headers.get(CSRF_HEADER_NAME) ? 'has-header' : 'no-header',
    req.cookies.get(CSRF_COOKIE_NAME)?.value ? 'has-cookie' : 'no-cookie',
  ].join(':');
  const current = Date.now();
  const nextAllowedAt = csrfFailureEventBuckets.get(key) ?? 0;
  if (nextAllowedAt > current) {
    return false;
  }

  if (csrfFailureEventBuckets.size >= CSRF_FAILURE_EVENT_BUCKET_LIMIT) {
    pruneExpiredCsrfFailureBuckets(current);
  }
  if (
    !csrfFailureEventBuckets.has(key) &&
    csrfFailureEventBuckets.size >= CSRF_FAILURE_EVENT_BUCKET_LIMIT
  ) {
    return false;
  }

  csrfFailureEventBuckets.set(key, current + CSRF_FAILURE_EVENT_WINDOW_MS);
  return true;
}

export function validateCsrfProtectedMutation(req: NextRequest): NextResponse | null {
  if (!isUnsafeMutationMethod(req.method)) {
    return createUnsafeMethodRequiredResponse(req.method);
  }

  if (!validateCsrfToken(req)) {
    if (shouldRecordCsrfFailureEvent(req)) {
      void recordSecurityEvent({
        eventType: 'csrf_failure',
        source: 'server.security.csrf',
        severity: 'warning',
        context: {
          method: req.method,
          path: req.nextUrl.pathname,
          hasHeaderToken: Boolean(req.headers.get(CSRF_HEADER_NAME)),
          hasCookieToken: Boolean(req.cookies.get(CSRF_COOKIE_NAME)?.value),
        },
      });
    }
    return createCsrfFailureResponse();
  }

  return null;
}

export async function withCsrfProtectedMutation<T extends Response>(
  req: NextRequest,
  handler: () => T | Promise<T>,
): Promise<T | NextResponse> {
  const failure = validateCsrfProtectedMutation(req);
  if (failure) {
    return failure;
  }

  return handler();
}
