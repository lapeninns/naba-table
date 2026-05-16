import { NextResponse } from 'next/server';

import { requireApiRateLimit } from '@/server/security/api-rate-limit';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_CLIENT_ERROR_BODY_BYTES = 16 * 1024;

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

    const payload = rawBody ? JSON.parse(rawBody) : null;
    console.error('[client-error]', {
      path: (payload as { path?: string })?.path ?? null,
      message: (payload as { message?: string })?.message ?? null,
      stack: (payload as { stack?: string })?.stack ?? null,
      userId: (payload as { userId?: string | null })?.userId ?? null,
      bookingId: (payload as { bookingId?: string | null })?.bookingId ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[client-error] failed to record', error);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
