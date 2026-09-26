import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  internalError,
  notFound,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerEvent, captureServerException } from '@/lib/posthog/server';
import { GuardError, requireRestaurantMember, requireSession } from '@/server/auth/guards';
import { resendBookingEmailFromDeliveryLog } from '@/server/emails/bookings';
import {
  EmailDeliveryLogUnavailableError,
  EmailDeliveryRetryError,
  retryEmailDeliveryLogEntry,
  type EmailDeliveryResendFn,
  type EmailDeliveryRetryErrorCode,
} from '@/server/emails/email-delivery-log';
import {
  buildOpsEmailDeliveryFixtureRetrySuccessEntry,
  isOpsEmailDeliveryFaultInjectionEnabled,
  OPS_EMAIL_DELIVERY_RETRY_FIXTURE_ENTRIES,
} from '@/server/emails/ops-email-delivery-dev-fixtures';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  restaurantId: z.string().uuid(),
  deliveryLogId: z
    .string()
    .refine(
      (value) =>
        z.uuid().safeParse(value).success || value in OPS_EMAIL_DELIVERY_RETRY_FIXTURE_ENTRIES,
      {
        message: 'Invalid delivery log id.',
      },
    ),
  simulateError: z.boolean().optional(),
});

const ROUTE = '/api/ops/email-delivery/retry';

function deliveryNotFound() {
  return notFound('NOT_FOUND', 'That email is no longer in the delivery log.');
}

const RETRY_ERROR_RESPONSES: Record<
  EmailDeliveryRetryErrorCode,
  { status: number; message: string; retryable?: boolean }
> = {
  NOT_FOUND: { status: 404, message: 'That email is no longer in the delivery log.' },
  NOT_RETRYABLE: { status: 409, message: 'Only failed or bounced emails can be resent.' },
  MISSING_BOOKING: { status: 409, message: 'The booking for this email no longer exists.' },
  MISSING_RECIPIENT: { status: 409, message: 'This booking has no email address to send to.' },
  RETRY_IN_PROGRESS: { status: 409, message: 'This email is already being resent.' },
  ALREADY_RETRIED: { status: 409, message: 'This email was already resent.' },
  RECIPIENT_SUPPRESSED: {
    status: 409,
    message: 'This address is blocked after a bounce or complaint, so the email was not sent.',
  },
  SEND_FAILED: {
    status: 502,
    message: 'The email could not be sent. Try again in a moment.',
    retryable: true,
  },
};

export async function POST(request: NextRequest) {
  return withCsrfProtectedMutation(request, () => postEmailDeliveryRetry(request));
}

/**
 * Synchronous manual resend. The response is honest about the outcome: 200 means the provider
 * accepted the new email; an error means nothing new was sent (or a resend is already in flight).
 */
async function postEmailDeliveryRetry(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, 'INVALID_REQUEST', 'Invalid request body.');
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const parsedBody = parsed.data;

  try {
    const { supabase, user } = await requireSession();

    const rateLimit = await requireApiRateLimit({
      request,
      scope: 'ops-email-delivery:retry',
      userId: user.id,
      parts: [parsedBody.restaurantId, parsedBody.deliveryLogId],
      limit: 5,
      windowMs: 60_000,
      message: 'Too many resend attempts. Wait a moment and try again.',
    });
    if (rateLimit) {
      return rateLimit;
    }

    if (parsedBody.simulateError && isOpsEmailDeliveryFaultInjectionEnabled()) {
      return apiError(
        500,
        'SIMULATED_RETRY_ERROR',
        'Forced retry mutation error for dev/test validation.',
      );
    }

    await requireRestaurantMember({
      supabase,
      userId: user.id,
      restaurantId: parsedBody.restaurantId,
    });

    const fixtureEntry = isOpsEmailDeliveryFaultInjectionEnabled()
      ? OPS_EMAIL_DELIVERY_RETRY_FIXTURE_ENTRIES[parsedBody.deliveryLogId]
      : undefined;

    if (fixtureEntry) {
      return NextResponse.json(
        {
          ok: true,
          status: 'sent',
          retryAttempt: 1,
          deliveryLogEntry: buildOpsEmailDeliveryFixtureRetrySuccessEntry({
            deliveryLogId: parsedBody.deliveryLogId,
            fixtureEntry,
            restaurantId: parsedBody.restaurantId,
          }),
        },
        { status: 200 },
      );
    }

    const resendBookingEmail: EmailDeliveryResendFn = async (
      bookingId,
      emailType,
      templateType,
      { idempotencyKey },
    ) => {
      const serviceSupabase = getServiceSupabaseClient();
      const { data, error } = await serviceSupabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .eq('restaurant_id', parsedBody.restaurantId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load booking for retry (${error.code ?? 'unknown'}).`);
      }

      const booking = (data ?? null) as BookingRecord | null;
      if (!booking) {
        throw new EmailDeliveryRetryError(
          'MISSING_BOOKING',
          'The original booking could not be loaded for retry.',
        );
      }

      return resendBookingEmailFromDeliveryLog({
        booking,
        emailType,
        templateType,
        idempotencyKey,
      });
    };

    const result = await retryEmailDeliveryLogEntry({
      deliveryLogId: parsedBody.deliveryLogId,
      restaurantId: parsedBody.restaurantId,
      resendBookingEmail,
    });

    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        retryAttempt: result.retryAttempt,
        deliveryLogEntry: result.deliveryLogEntry,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      return error.code === 'UNAUTHENTICATED' ? unauthenticated() : deliveryNotFound();
    }

    if (error instanceof EmailDeliveryRetryError) {
      if (error.code === 'SEND_FAILED') {
        captureServerEvent('email_delivery_retry_failed', {
          provider: 'resend',
          source: 'ops',
          reason: 'send_failed',
        });
        logger.warn('ops.email_delivery.retry_send_failed', {
          route: ROUTE,
          restaurantId: parsedBody.restaurantId,
          deliveryLogId: parsedBody.deliveryLogId,
        });
      }
      const mapped = RETRY_ERROR_RESPONSES[error.code];
      return apiError(mapped.status, error.code, mapped.message, {
        retryable: mapped.retryable,
      });
    }

    if (error instanceof EmailDeliveryLogUnavailableError) {
      return apiError(
        503,
        'DELIVERY_LOG_UNAVAILABLE',
        'Delivery tracking is temporarily unavailable. Try again shortly.',
        { retryable: true },
      );
    }

    captureServerEvent('email_delivery_retry_failed', {
      provider: 'resend',
      source: 'ops',
      reason: 'unexpected',
    });
    captureServerException(error, {
      properties: { provider: 'resend', source: 'ops', path: ROUTE },
    });

    return internalError(error, {
      route: ROUTE,
      restaurantId: parsedBody.restaurantId,
      deliveryLogId: parsedBody.deliveryLogId,
    });
  }
}
