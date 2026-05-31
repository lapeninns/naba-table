// src/app/api/webhook/resend/route.ts
import { NextResponse } from 'next/server';
import { Resend, type WebhookEvent } from 'resend';

import {
  recordEmailDeliveryLog,
  findLatestEmailDeliveryByMessageId,
  type EmailDeliveryStatus,
} from '@/server/emails/email-delivery-log';
import { suppressProfilesByEmail } from '@/server/emails/recipient-suppression';
import { recordObservabilityEvent } from '@/server/observability';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resendWebhookVerifier = new Resend();
const MAX_RESEND_WEBHOOK_BODY_BYTES = 256 * 1024;

type ResendWebhookEvent = {
  type:
    | Extract<WebhookEvent, 'email.sent'>
    | Extract<WebhookEvent, 'email.delivered'>
    | Extract<WebhookEvent, 'email.delivery_delayed'>
    | Extract<WebhookEvent, 'email.complained'>
    | Extract<WebhookEvent, 'email.bounced'>
    | Extract<WebhookEvent, 'email.opened'>
    | Extract<WebhookEvent, 'email.clicked'>
    | Extract<WebhookEvent, 'email.failed'>
    | 'email.complaint';
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    // ... other fields depending on the event type
    bounce?: {
      type: string;
      message: string;
    };
  };
};

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readBodyWithLimit(req: NextRequest, maxBytes: number): Promise<string | null> {
  if (!req.body) {
    const payload = await req.text();
    return new TextEncoder().encode(payload).byteLength > maxBytes ? null : payload;
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

export async function POST(req: NextRequest) {
  // 1. --- Webhook Security ---
  const resendWebhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!resendWebhookSecret) {
    console.error('[webhook][resend] RESEND_WEBHOOK_SECRET missing; refusing webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const svixId = req.headers.get('svix-id')?.trim();
  const svixTimestamp = req.headers.get('svix-timestamp')?.trim();
  const svixSignature = req.headers.get('svix-signature')?.trim();

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[webhook][resend] Missing svix verification headers');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentLength = parseContentLength(req.headers.get('content-length'));
  if (contentLength === null) {
    return NextResponse.json({ error: 'Content-Length required' }, { status: 411 });
  }
  if (contentLength !== null && contentLength > MAX_RESEND_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const payload = await readBodyWithLimit(req, MAX_RESEND_WEBHOOK_BODY_BYTES);
  if (payload === null) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  try {
    const event = resendWebhookVerifier.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: resendWebhookSecret,
    }) as ResendWebhookEvent;

    const recipients = event.data.to ?? [];
    const primaryRecipient = recipients[0] ?? null;

    if (!primaryRecipient) {
      return NextResponse.json({ error: 'No recipient email found' }, { status: 400 });
    }

    const statusMap: Partial<Record<ResendWebhookEvent['type'], EmailDeliveryStatus>> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.delivery_delayed': 'delivery_delayed',
      'email.complained': 'complained',
      'email.complaint': 'complained',
      'email.bounced': 'bounced',
      'email.failed': 'failed',
    };

    const mappedStatus = statusMap[event.type] ?? null;
    const occurredAt = event.created_at || new Date().toISOString();
    const errorDetails = event.data.bounce?.message ?? null;

    if (mappedStatus) {
      for (const recipientEmail of recipients) {
        const linkage = await findLatestEmailDeliveryByMessageId({
          messageId: event.data.email_id,
          recipientEmail,
        });

        await recordEmailDeliveryLog({
          bookingId: linkage?.bookingId ?? null,
          restaurantId: linkage?.restaurantId ?? null,
          emailType: linkage?.emailType ?? null,
          templateType: linkage?.templateType ?? null,
          recipientEmail,
          messageId: event.data.email_id,
          status: mappedStatus,
          provider: 'resend',
          providerEventId: null,
          occurredAt,
          error: errorDetails,
          metadata: {
            eventType: event.type,
            // Do not include raw recipient email in metadata; it's already stored in the column.
          },
        });
      }
    }

    // 2. --- Handle Relevant Events ---
    switch (event.type) {
      case 'email.bounced':
      case 'email.complained':
      case 'email.complaint': {
        const result = await suppressProfilesByEmail(primaryRecipient);

        if (result.updatedProfiles > 0) {
          await recordObservabilityEvent({
            source: 'webhook.resend',
            eventType: 'email_suppression.added',
            severity: 'warning',
            context: {
              reason: event.type,
              matchedProfiles: result.matchedProfiles,
              updatedProfiles: result.updatedProfiles,
            },
          });
        }
        break;
      }

      // Note: Resend doesn't have a native "unsubscribe" event via webhook in the same way.
      // This would typically be handled by a link in the email that directs to a page in your app,
      // which then calls an API to set the suppression flag. The 'List-Unsubscribe' header is also key.

      default:
        // console.log(`[webhook][resend] Received unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === 'WebhookVerificationError') {
      console.warn('[webhook][resend] Invalid signature received');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('[webhook][resend] Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await recordObservabilityEvent({
      source: 'webhook.resend',
      eventType: 'webhook.processing_failed',
      severity: 'error',
      context: {
        error: errorMessage,
      },
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
