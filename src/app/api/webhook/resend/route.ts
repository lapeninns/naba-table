// src/app/api/webhook/resend/route.ts
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';

import { apiError, internalError, unauthenticated } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import {
  recordEmailDeliveryLog,
  findLatestEmailDeliveryByMessageId,
  type EmailDeliveryStatus,
} from '@/server/emails/email-delivery-log';
import { addEmailToSuppressionList } from '@/server/emails/email-suppression-list';
import { suppressProfilesByEmail } from '@/server/emails/recipient-suppression';
import { recordObservabilityEvent } from '@/server/observability';
import { recordReviewRequestEvent, type ReviewEventType } from '@/server/reviews/journeys';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

import type { NextRequest } from 'next/server';
import type { WebhookEvent } from 'resend';

const ROUTE = '/api/webhook/resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    // Resend (SES) bounce classification: 'Permanent' | 'Transient' | 'Undetermined'.
    bounce?: {
      type?: string;
      subType?: string;
      message?: string;
    };
  };
};

const PERMANENT_BOUNCE_TYPES = new Set(['permanent', 'hard']);

function normalizeBounceType(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : null;
}

/** 'bounce' only for a permanent (hard) bounce, 'complaint' for complaints, otherwise null. */
function resolveSuppressionReason(event: ResendWebhookEvent): 'bounce' | 'complaint' | null {
  if (event.type === 'email.complained' || event.type === 'email.complaint') {
    return 'complaint';
  }
  if (event.type === 'email.bounced') {
    const bounceType = normalizeBounceType(event.data.bounce?.type);
    return bounceType && PERMANENT_BOUNCE_TYPES.has(bounceType) ? 'bounce' : null;
  }
  return null;
}

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
  await flushPosthogLogsAfterResponse();
  // 1. --- Webhook Security ---
  const resendWebhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!resendWebhookSecret) {
    logger.error('webhook.resend.secret_missing', { route: ROUTE });
    return apiError(503, 'WEBHOOK_NOT_CONFIGURED', 'Webhook not configured.', { retryable: true });
  }

  const svixId = req.headers.get('svix-id')?.trim();
  const svixTimestamp = req.headers.get('svix-timestamp')?.trim();
  const svixSignature = req.headers.get('svix-signature')?.trim();

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn('webhook.resend.missing_signature_headers', { route: ROUTE });
    return unauthenticated('Unauthorized.');
  }

  const contentLength = parseContentLength(req.headers.get('content-length'));
  if (contentLength === null) {
    return apiError(411, 'LENGTH_REQUIRED', 'Content-Length required.');
  }
  if (contentLength !== null && contentLength > MAX_RESEND_WEBHOOK_BODY_BYTES) {
    return apiError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large.');
  }

  const payload = await readBodyWithLimit(req, MAX_RESEND_WEBHOOK_BODY_BYTES);
  if (payload === null) {
    return apiError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large.');
  }

  try {
    // Signature verification is local and requires only the endpoint signing secret.
    const event = new Webhook(resendWebhookSecret).verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent;

    const recipients = event.data.to ?? [];
    const primaryRecipient = recipients[0] ?? null;

    if (!primaryRecipient) {
      return apiError(400, 'NO_RECIPIENT', 'No recipient email found.');
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
    const reviewEventMap: Partial<Record<ResendWebhookEvent['type'], ReviewEventType>> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.opened': 'opened',
      'email.complained': 'complained',
      'email.complaint': 'complained',
      'email.bounced': 'bounced',
      'email.failed': 'failed',
    };
    const occurredAt = event.created_at || new Date().toISOString();
    const errorDetails = event.data.bounce?.message ?? null;

    for (const recipientEmail of recipients) {
      const linkage = await findLatestEmailDeliveryByMessageId({
        messageId: event.data.email_id,
        recipientEmail,
      });

      if (mappedStatus) {
        await recordEmailDeliveryLog({
          bookingId: linkage?.bookingId ?? null,
          restaurantId: linkage?.restaurantId ?? null,
          reviewRequestId: linkage?.reviewRequestId ?? null,
          emailType: linkage?.emailType ?? null,
          templateType: linkage?.templateType ?? null,
          recipientEmail,
          messageId: event.data.email_id,
          status: mappedStatus,
          provider: 'resend',
          providerEventId: svixId,
          occurredAt,
          error: errorDetails,
          metadata: {
            eventType: event.type,
            // Do not include raw recipient email in metadata; it's already stored in the column.
          },
        });
      }

      const reviewEventType = reviewEventMap[event.type];
      if (reviewEventType && linkage?.reviewRequestId && linkage.restaurantId) {
        await recordReviewRequestEvent({
          channel: 'email',
          eventType: reviewEventType,
          idempotencyKey: `resend:${svixId}:${linkage.reviewRequestId}`,
          occurredAt,
          provider: 'resend',
          providerEventId: event.data.email_id,
          restaurantId: linkage.restaurantId,
          reviewRequestId: linkage.reviewRequestId,
        });
      }
    }

    // 2. --- Suppression ---
    // Only a permanent bounce or a complaint means the address must stop receiving mail.
    // Transient (mailbox full, greylisting) and undetermined bounces are recorded above but do
    // not suppress. Every recipient of the message is handled the same way.
    const suppressionReason = resolveSuppressionReason(event);
    if (suppressionReason) {
      let matchedProfiles = 0;
      let updatedProfiles = 0;
      for (const recipientEmail of recipients) {
        // Suppress in both stores: the profile-bound flag (registered users) and the
        // email-keyed list (honours every recipient, incl. guests without an account).
        const [result] = await Promise.all([
          suppressProfilesByEmail(recipientEmail),
          addEmailToSuppressionList(recipientEmail, suppressionReason, {
            via: 'resend-webhook',
            eventType: event.type,
          }),
        ]);
        matchedProfiles += result.matchedProfiles;
        updatedProfiles += result.updatedProfiles;
      }

      if (updatedProfiles > 0) {
        await recordObservabilityEvent({
          source: 'webhook.resend',
          eventType: 'email_suppression.added',
          severity: 'warning',
          context: {
            reason: event.type,
            recipientCount: recipients.length,
            matchedProfiles,
            updatedProfiles,
          },
        });
      }
    } else if (event.type === 'email.bounced') {
      await recordObservabilityEvent({
        source: 'webhook.resend',
        eventType: 'email_suppression.skipped_non_permanent_bounce',
        severity: 'info',
        context: {
          bounceType: normalizeBounceType(event.data.bounce?.type) ?? 'missing',
          recipientCount: recipients.length,
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === 'WebhookVerificationError') {
      logger.warn('webhook.resend.invalid_signature', { route: ROUTE });
      return unauthenticated('Unauthorized.');
    }

    await recordObservabilityEvent({
      source: 'webhook.resend',
      eventType: 'webhook.processing_failed',
      severity: 'error',
      context: {
        errorName: error instanceof Error ? error.name : typeof error,
      },
    });
    captureServerException(error, {
      properties: { provider: 'resend', source: 'webhook', path: '/api/webhook/resend' },
    });
    return internalError(error, { route: ROUTE });
  }
}
