import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { validateTwilioWebhookSignature } from '@/lib/twilio/sms';
import { processWhatsAppStatusCallback } from '@/server/notifications/whatsapp-status';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_PARAMS = 64;
const SUPPORTED_STATUSES = new Set([
  'accepted',
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'undelivered',
  'failed',
  'canceled',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstForwardedValue(value: string | null): string | null {
  return (
    value
      ?.split(',')
      .map((part) => part.trim())
      .find(Boolean) ?? null
  );
}

function validationUrls(req: NextRequest): string[] {
  const path = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const urls = new Set<string>([req.url]);
  const host = firstForwardedValue(req.headers.get('x-forwarded-host'));
  const proto = firstForwardedValue(req.headers.get('x-forwarded-proto'));
  if (host) {
    urls.add(`${proto === 'http' ? 'http' : 'https'}://${host}${path}`);
  }
  if (env.app.url) {
    urls.add(new URL(path, env.app.url).toString());
  }
  return Array.from(urls);
}

export async function POST(req: NextRequest) {
  const authToken = env.twilio.authToken;
  if (!authToken) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }
  const signature = req.headers.get('x-twilio-signature')?.trim() ?? '';
  if (!signature) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const contentType = req.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') {
    return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });
  }
  const contentLength = Number.parseInt(req.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  const form = new URLSearchParams(rawBody);
  if (Array.from(form.keys()).length > MAX_PARAMS) {
    return NextResponse.json({ error: 'Too many parameters' }, { status: 400 });
  }
  const signed = validationUrls(req).some((url) =>
    validateTwilioWebhookSignature({ authToken, form, signature, url }),
  );
  if (!signed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const messageSid = form.get('MessageSid')?.trim() ?? '';
  const providerStatus = form.get('MessageStatus')?.trim().toLowerCase() ?? '';
  const recipientPhone = form.get('To')?.trim() ?? '';
  if (!messageSid || !providerStatus || !recipientPhone) {
    return NextResponse.json({ error: 'Missing required Twilio status fields' }, { status: 400 });
  }
  if (!SUPPORTED_STATUSES.has(providerStatus)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const attemptId = req.nextUrl.searchParams.get('attempt')?.trim() ?? '';
  if (attemptId && !UUID_PATTERN.test(attemptId)) {
    return NextResponse.json({ error: 'Invalid attempt correlation' }, { status: 400 });
  }

  const result = await processWhatsAppStatusCallback({
    ...(attemptId ? { attemptId } : {}),
    errorCode: form.get('ErrorCode')?.trim() || null,
    messageSid,
    providerStatus,
    recipientPhone,
  });
  return NextResponse.json({ ok: true, ...result });
}
