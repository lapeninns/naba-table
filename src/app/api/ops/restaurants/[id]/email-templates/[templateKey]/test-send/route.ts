import { NextResponse } from 'next/server';

import {
  restaurantEmailTemplateKeySchema,
  sendRestaurantEmailTemplateTestSchema,
  type SendRestaurantEmailTemplateTestResponse,
} from '@/app/api/ops/restaurants/schema';
import { apiError, conflict, validationError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { isEmailRecipientSuppressedError } from '@/libs/resend';
import { sendRestaurantBookingEmailTest } from '@/server/emails/bookings';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';

import { unknownTemplateKey } from '../../_errors';
import {
  ensureTemplateWriteAccess,
  resolveRestaurantId,
  resolveTemplateKeyParam,
  type RouteParams,
} from '../../_shared';

import type { NextRequest } from 'next/server';

const INVALID_IDEMPOTENCY_KEY = Symbol('invalid-idempotency-key');
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;

/** The client's per-click key; absent is allowed (every call then sends). */
function parseIdempotencyKeyHeader(
  req: NextRequest,
): string | null | typeof INVALID_IDEMPOTENCY_KEY {
  const raw = req.headers.get('idempotency-key');
  if (raw === null) return null;
  const value = raw.trim();
  return IDEMPOTENCY_KEY_PATTERN.test(value) ? value : INVALID_IDEMPOTENCY_KEY;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return apiError(400, 'INVALID_REQUEST', 'Missing restaurant id.');
  }

  const parsedTemplateKey = restaurantEmailTemplateKeySchema.safeParse(
    await resolveTemplateKeyParam(params),
  );
  if (!parsedTemplateKey.success) {
    return unknownTemplateKey();
  }

  const venueOrResponse = await ensureTemplateWriteAccess(restaurantId, req);
  if (venueOrResponse instanceof NextResponse) {
    return venueOrResponse;
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'restaurant-email-template:test-send',
    tenantId: restaurantId,
    limit: 10,
    windowMs: 60_000,
    message: 'Too many test email requests. Please try again later.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_REQUEST', 'Invalid JSON body.');
  }

  const parsedBody = sendRestaurantEmailTemplateTestSchema.safeParse(body);
  if (!parsedBody.success) {
    return validationError(parsedBody.error);
  }

  const requestKey = parseIdempotencyKeyHeader(req);
  if (requestKey === INVALID_IDEMPOTENCY_KEY) {
    return apiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Invalid Idempotency-Key header.');
  }

  try {
    const result = await sendRestaurantBookingEmailTest({
      venue: venueOrResponse,
      templateKey: parsedTemplateKey.data,
      toEmail: parsedBody.data.toEmail,
      draftVariants: parsedBody.data.variants,
      preferredVariantId: parsedBody.data.preferredVariantId,
      requestKey,
    });

    const response: SendRestaurantEmailTemplateTestResponse = {
      ok: true,
      restaurantId,
      provider: result.provider,
      messageId: result.messageId,
      preview: {
        templateKey: result.preview.templateKey,
        selectedVariantId: result.preview.selectedVariantId,
        selectedVariantName: result.preview.selectedVariantName,
        preheader: result.preview.preheader,
        headline: result.preview.headline,
        intro: result.preview.intro,
        cue: result.preview.cue,
        ask: result.preview.ask,
        ctaLabel: result.preview.ctaLabel,
        ctaUrl: result.preview.ctaUrl,
        subject: result.preview.subject,
        html: result.preview.html,
        text: result.preview.text,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (isEmailRecipientSuppressedError(error)) {
      return conflict(
        'RECIPIENT_SUPPRESSED',
        'That address is blocked after a bounce or complaint. Use a different address.',
      );
    }

    captureServerException(error, {
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-email-template-test-send' },
    });
    logger.warn('ops.restaurants.email-templates.test_send_failed', {
      route: 'ops.restaurants.email-templates',
      operation: 'test-send',
      restaurantId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return apiError(502, 'SEND_FAILED', "The test email couldn't be sent. Try again.", {
      retryable: true,
    });
  }
}
