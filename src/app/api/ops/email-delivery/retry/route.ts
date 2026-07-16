import { NextResponse } from 'next/server';
import { z } from 'zod';

import { captureServerEvent, captureServerException } from '@/lib/posthog/server';
import { GuardError, requireRestaurantMember, requireSession } from '@/server/auth/guards';
import { resendBookingEmailFromDeliveryLog } from '@/server/emails/bookings';
import {
  EmailDeliveryLogUnavailableError,
  EmailDeliveryRetryError,
  retryEmailDeliveryLogEntry,
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

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      ok: false,
      code,
      error: message,
      message,
    },
    { status },
  );
}

function notFoundError() {
  return jsonError(404, 'NOT_FOUND', 'Email delivery log entry not found.');
}

export async function POST(request: NextRequest) {
  return withCsrfProtectedMutation(request, () => postEmailDeliveryRetry(request));
}

async function postEmailDeliveryRetry(request: NextRequest) {
  let parsedBody: z.infer<typeof bodySchema>;

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return jsonError(400, 'INVALID_REQUEST', 'Invalid request body.');
    }
    parsedBody = parsed.data;
  } catch {
    return jsonError(400, 'INVALID_REQUEST', 'Invalid request body.');
  }

  try {
    const { supabase, user } = await requireSession();

    const rateLimit = await requireApiRateLimit({
      request,
      scope: 'ops-email-delivery:retry',
      userId: user.id,
      parts: [parsedBody.restaurantId, parsedBody.deliveryLogId],
      limit: 5,
      windowMs: 60_000,
      message: 'Too many email retry attempts. Please try again later.',
    });
    if (rateLimit) {
      return rateLimit;
    }

    if (parsedBody.simulateError && isOpsEmailDeliveryFaultInjectionEnabled()) {
      return jsonError(
        500,
        'SIMULATED_RETRY_ERROR',
        'Forced retry mutation error for dev/test validation.',
      );
    }

    try {
      await requireRestaurantMember({
        supabase,
        userId: user.id,
        restaurantId: parsedBody.restaurantId,
      });
    } catch (error) {
      if (error instanceof GuardError) {
        if (error.code === 'UNAUTHENTICATED') {
          return jsonError(401, 'UNAUTHENTICATED', error.message);
        }
        return notFoundError();
      }
      throw error;
    }

    const fixtureEntry = isOpsEmailDeliveryFaultInjectionEnabled()
      ? OPS_EMAIL_DELIVERY_RETRY_FIXTURE_ENTRIES[parsedBody.deliveryLogId]
      : undefined;

    const resendBookingEmail = async (
      bookingId: string,
      emailType: string | null,
      templateType: string | null,
    ) => {
      if (fixtureEntry) {
        return resendBookingEmailFromDeliveryLog({
          booking: {
            id: bookingId,
            restaurant_id: parsedBody.restaurantId,
          } as BookingRecord,
          emailType,
          templateType,
        });
      }

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
      });
    };

    const retriedEntry = fixtureEntry
      ? buildOpsEmailDeliveryFixtureRetrySuccessEntry({
          deliveryLogId: parsedBody.deliveryLogId,
          fixtureEntry,
          restaurantId: parsedBody.restaurantId,
        })
      : await retryEmailDeliveryLogEntry({
          deliveryLogId: parsedBody.deliveryLogId,
          restaurantId: parsedBody.restaurantId,
          resendBookingEmail,
        });

    return NextResponse.json(
      {
        ok: true,
        deliveryLogEntry: retriedEntry,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      if (error.code === 'UNAUTHENTICATED') {
        return jsonError(401, 'UNAUTHENTICATED', error.message);
      }

      return notFoundError();
    }

    if (error instanceof EmailDeliveryRetryError) {
      if (error.code === 'NOT_FOUND') {
        return notFoundError();
      }
      if (error.code === 'NOT_RETRYABLE') {
        return jsonError(409, error.code, error.message);
      }
      return jsonError(400, error.code, error.message);
    }

    if (error instanceof EmailDeliveryLogUnavailableError) {
      return jsonError(
        503,
        'DELIVERY_LOG_UNAVAILABLE',
        'Delivery tracking is temporarily unavailable',
      );
    }

    console.error('[ops/email-delivery/retry] unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });

    captureServerEvent('email_delivery_retry_failed', {
      provider: 'resend',
      source: 'ops',
      reason: 'unexpected',
    });
    captureServerException(error, {
      properties: { provider: 'resend', source: 'ops', path: '/api/ops/email-delivery/retry' },
    });

    return jsonError(500, 'INTERNAL', 'Internal error');
  }
}
