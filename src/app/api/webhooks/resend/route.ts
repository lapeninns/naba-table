import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { recordEmailDeliveryEvent } from '@/server/emails/delivery-log';
import { recordObservabilityEvent } from '@/server/observability';

import type { EmailDeliveryStatus } from '@/server/emails/delivery-log';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const EVENT_STATUS_MAP: Record<string, EmailDeliveryStatus | null> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.complaint': 'complained',
  'email.failed': 'failed',
};

type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    tags?: Array<{ name: string; value: string }> | Record<string, string>;
    bounce?: { message?: string; type?: string };
    error?: string;
  };
};

function decodeSvixSecret(secret: string): Buffer {
  const trimmed = secret.trim();
  const raw = trimmed.startsWith('whsec_') ? trimmed.slice(6) : trimmed;
  return Buffer.from(raw, 'base64');
}

function parseSvixSignatures(header: string): string[] {
  const signatures: string[] = [];
  const parts = header.split(' ');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('v1=')) {
      signatures.push(trimmed.slice(3));
      continue;
    }
    if (trimmed.startsWith('v1,')) {
      signatures.push(trimmed.slice(3));
      continue;
    }
    const [version, signature] = trimmed.split(',');
    if (version === 'v1' && signature) {
      signatures.push(signature);
    }
  }

  return signatures;
}

function isTimestampValid(timestamp: string): boolean {
  const parsed = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(parsed)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - parsed) <= SIGNATURE_TOLERANCE_SECONDS;
}

function verifySvixSignature(params: {
  payload: string;
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}): boolean {
  const { payload, secret, svixId, svixTimestamp, svixSignature } = params;
  const signedPayload = `${svixId}.${svixTimestamp}.${payload}`;
  const secretBytes = decodeSvixSecret(secret);
  const expected = crypto.createHmac('sha256', secretBytes).update(signedPayload).digest('base64');
  const signatures = parseSvixSignatures(svixSignature);

  return signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  });
}

function normalizeRecipients(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractTags(tags: unknown) {
  const entries = new Map<string, string>();
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (tag?.name && tag?.value) entries.set(tag.name, tag.value);
    }
  } else if (tags && typeof tags === 'object') {
    Object.entries(tags as Record<string, string>).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 0) entries.set(key, value);
    });
  }
  return entries;
}

function extractError(event: ResendWebhookEvent): string | null {
  const message = event.data?.bounce?.message ?? event.data?.error ?? null;
  const detail = event.data?.bounce?.type;
  if (!message) return detail ?? null;
  return detail ? `${message} (${detail})` : message;
}

export async function POST(req: NextRequest) {
  const secret = env.resend.webhookSecret;
  if (!secret) {
    console.error('[webhooks][resend] Missing RESEND_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 });
  }

  if (!isTimestampValid(svixTimestamp)) {
    return NextResponse.json({ error: 'Stale signature' }, { status: 400 });
  }

  const payload = await req.text();
  const isValid = verifySvixSignature({
    payload,
    secret,
    svixId,
    svixTimestamp,
    svixSignature,
  });

  if (!isValid) {
    console.warn('[webhooks][resend] Invalid signature', { svixId });
    await recordObservabilityEvent({
      source: 'webhook.resend',
      eventType: 'webhook.invalid_signature',
      severity: 'warning',
      context: { svixId },
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(payload) as ResendWebhookEvent;
  } catch (error) {
    console.error('[webhooks][resend] Invalid payload', error);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const status = EVENT_STATUS_MAP[event.type] ?? null;
  if (!status) {
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  const recipients = normalizeRecipients(event.data?.to);
  const messageId = event.data?.email_id ?? null;
  if (!messageId || recipients.length === 0) {
    return NextResponse.json({ error: 'Missing email id or recipients' }, { status: 400 });
  }

  const tags = extractTags(event.data?.tags);
  const bookingId = tags.get('booking_id') ?? null;
  const restaurantId = tags.get('restaurant_id') ?? null;
  const emailType = tags.get('email_type') ?? null;
  const templateType = tags.get('template_type') ?? null;
  const occurredAt = event.created_at ?? null;
  const errorMessage = extractError(event);

  try {
    await Promise.all(
      recipients.map((recipient) =>
        recordEmailDeliveryEvent({
          bookingId,
          restaurantId,
          emailType,
          templateType,
          recipientEmail: recipient,
          messageId,
          status,
          occurredAt,
          providerEventId: svixId,
          provider: 'resend',
          error: errorMessage,
          metadata: {
            eventType: event.type,
          },
        }),
      ),
    );
  } catch (error) {
    console.error('[webhooks][resend] Failed to persist delivery event', error);
    await recordObservabilityEvent({
      source: 'webhook.resend',
      eventType: 'delivery_log_failed',
      severity: 'error',
      context: {
        svixId,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: 'Failed to persist event' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
