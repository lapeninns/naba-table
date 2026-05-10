import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import {
  mapTwilioMessageStatusToDeliveryStatus,
  validateTwilioWebhookSignature,
} from '@/lib/twilio/sms';
import { findLatestSmsDeliveryByMessageSid, recordSmsDeliveryLog } from '@/server/sms/delivery-log';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_TWILIO_SMS_STATUS_BODY_BYTES = 16 * 1024;
const MAX_TWILIO_SMS_STATUS_PARAMS = 64;
const EXPECTED_TWILIO_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNED_CONTEXT_SMS_TYPES = new Set([
  'booking_confirmation',
  'booking_update',
  'booking_cancellation',
  'restaurant_cancellation',
]);

type SmsLinkageContext = {
  bookingId: string | null;
  restaurantId: string | null;
  smsType: string | null;
};

function readForwardedHeaderValue(value: string | null): string | null {
  if (!value) return null;

  const normalized = value
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  return normalized ?? null;
}

function buildTwilioSignatureValidationUrls(req: NextRequest): string[] {
  const pathWithSearch = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const requestProtocol = req.nextUrl.protocol.replace(/:$/, '');
  const forwardedProto = readForwardedHeaderValue(req.headers.get('x-forwarded-proto'));
  const forwardedHost = readForwardedHeaderValue(req.headers.get('x-forwarded-host'));
  const candidates = new Set<string>();

  if (forwardedHost) {
    const protocol =
      forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : requestProtocol;
    candidates.add(`${protocol}://${forwardedHost}${pathWithSearch}`);
  }

  candidates.add(req.url);

  if (env.app.url) {
    candidates.add(new URL(pathWithSearch, env.app.url).toString());
  }

  return Array.from(candidates);
}

function hasExpectedTwilioContentType(value: string | null): boolean {
  if (!value) return false;
  return value
    .split(';', 1)[0]
    ?.trim()
    .toLowerCase() === EXPECTED_TWILIO_CONTENT_TYPE;
}

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readSignedLinkageContext(req: NextRequest): SmsLinkageContext | null {
  const bookingId = req.nextUrl.searchParams.get('bookingId')?.trim() ?? '';
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')?.trim() ?? '';
  const smsType = req.nextUrl.searchParams.get('smsType')?.trim() ?? '';

  if (!bookingId && !restaurantId && !smsType) return null;
  if (!UUID_PATTERN.test(bookingId) || !UUID_PATTERN.test(restaurantId)) return null;
  if (!SIGNED_CONTEXT_SMS_TYPES.has(smsType)) return null;

  return { bookingId, restaurantId, smsType };
}

export async function POST(req: NextRequest) {
  const authToken = env.twilio.authToken;
  if (!authToken) {
    console.error('[webhook][twilio][sms-status] TWILIO_AUTH_TOKEN missing; refusing webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = req.headers.get('x-twilio-signature')?.trim() ?? '';
  if (!signature) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasExpectedTwilioContentType(req.headers.get('content-type'))) {
    return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });
  }

  const contentLength = parseContentLength(req.headers.get('content-length'));
  if (contentLength !== null && contentLength > MAX_TWILIO_SMS_STATUS_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_TWILIO_SMS_STATUS_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const form = new URLSearchParams(rawBody);
  if (Array.from(form.keys()).length > MAX_TWILIO_SMS_STATUS_PARAMS) {
    return NextResponse.json({ error: 'Too many parameters' }, { status: 400 });
  }

  const validationUrls = buildTwilioSignatureValidationUrls(req);
  const isValid = validationUrls.some((url) =>
    validateTwilioWebhookSignature({
      url,
      form,
      signature,
      authToken,
    }),
  );

  if (!isValid) {
    console.warn('[webhook][twilio][sms-status] signature validation failed', {
      requestUrl: req.url,
      validationUrls,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const messageSid = form.get('MessageSid')?.trim() ?? form.get('SmsSid')?.trim() ?? '';
  const recipientPhone = form.get('To')?.trim() ?? '';
  const providerStatus = form.get('MessageStatus')?.trim() ?? form.get('SmsStatus')?.trim() ?? '';

  if (!messageSid || !recipientPhone || !providerStatus) {
    return NextResponse.json({ error: 'Missing required Twilio status fields' }, { status: 400 });
  }

  const mappedStatus = mapTwilioMessageStatusToDeliveryStatus(providerStatus);
  if (!mappedStatus) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const linkage = await findLatestSmsDeliveryByMessageSid({
    messageSid,
    recipientPhone,
  });
  const signedContext = linkage ? null : readSignedLinkageContext(req);

  await recordSmsDeliveryLog({
    bookingId: linkage?.bookingId ?? signedContext?.bookingId ?? null,
    restaurantId: linkage?.restaurantId ?? signedContext?.restaurantId ?? null,
    smsType: linkage?.smsType ?? signedContext?.smsType ?? null,
    recipientPhone,
    messageSid,
    status: mappedStatus,
    provider: 'twilio',
    occurredAt: form.get('Timestamp')?.trim() || undefined,
    error: form.get('ErrorMessage')?.trim() || null,
    metadata: {
      messageStatus: providerStatus,
      errorCode: form.get('ErrorCode')?.trim() || null,
      from: form.get('From')?.trim() || null,
      accountSid: form.get('AccountSid')?.trim() || null,
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
