import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_CLIENT_ERROR_BODY_BYTES = 16 * 1024;

type ClientErrorPayload = {
  bookingId: string | null;
  message: string | null;
  path: string | null;
  stack: string | null;
  userId: string | null;
};

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

function parseClientErrorPayload(value: unknown): ClientErrorPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const path = readOptionalString(record, 'path');
  const message = readOptionalString(record, 'message');
  const stack = readOptionalString(record, 'stack');
  const userId = readOptionalString(record, 'userId');
  const bookingId = readOptionalString(record, 'bookingId');

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
    userId: userId ?? null,
    bookingId: bookingId ?? null,
  };
}

export async function POST(req: NextRequest) {
  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'client-error',
    limit: 30,
    windowMs: 60_000,
    message: 'Too many client error reports',
  });
  if (rateLimit) {
    return rateLimit;
  }

  const contentLength = parseContentLength(req.headers.get('content-length'));
  if (contentLength !== null && contentLength > MAX_CLIENT_ERROR_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_CLIENT_ERROR_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let payload: unknown = null;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch (error) {
      logger.warn('client error report rejected', {
        error,
        reason: 'invalid_json',
      });
      return NextResponse.json({ error: 'Invalid client error report' }, { status: 400 });
    }

    const clientError = parseClientErrorPayload(payload);
    if (!clientError) {
      logger.warn('client error report rejected', {
        reason: 'invalid_payload',
      });
      return NextResponse.json({ error: 'Invalid client error report' }, { status: 400 });
    }

    logger.error('client error report', clientError);
  } catch (error) {
    logger.error('client error report failed', { error });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
