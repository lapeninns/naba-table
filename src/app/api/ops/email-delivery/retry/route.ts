import { NextResponse } from 'next/server';
import { z } from 'zod';

import { captureServerEvent, captureServerException } from '@/lib/posthog/server';
import {
  GuardError,
  listUserRestaurantMemberships,
  requireRestaurantMember,
  requireSession,
} from '@/server/auth/guards';
import { resendBookingEmailFromDeliveryLog } from '@/server/emails/bookings';
import {
  EmailDeliveryLogUnavailableError,
  EmailDeliveryRetryError,
  retryEmailDeliveryLogEntry,
} from '@/server/emails/email-delivery-log';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RETRY_ACTION_FIXTURE_ENTRIES: Record<
  string,
  {
    bookingId: string;
    restaurantId?: string;
    emailType: string;
    templateType: string;
    recipientEmail: string;
    subject: string;
  }
> = {
  '11111111-1111-4111-8111-111111111111': {
    bookingId: 'booking-fixture-failed',
    emailType: 'created',
    templateType: 'booking_confirmation',
    recipientEmail: 'retry.failed@example.com',
    subject: 'Fixture failed retry candidate',
  },
  '22222222-2222-4222-8222-222222222222': {
    bookingId: 'booking-fixture-bounced',
    emailType: 'review_request',
    templateType: 'review_request',
    recipientEmail: 'retry.bounced@example.com',
    subject: 'Fixture bounced retry candidate',
  },
};

function buildFixtureRetrySuccessEntry({
  deliveryLogId,
  fixtureEntry,
  restaurantId,
}: {
  deliveryLogId: string;
  fixtureEntry: (typeof RETRY_ACTION_FIXTURE_ENTRIES)[string];
  restaurantId: string | null;
}) {
  const occurredAt = new Date().toISOString();

  return {
    id: deliveryLogId,
    bookingId: fixtureEntry.bookingId,
    restaurantId,
    emailType: fixtureEntry.emailType,
    templateType: fixtureEntry.templateType,
    recipientEmail: fixtureEntry.recipientEmail,
    messageId: `${deliveryLogId}:fixture-retry-success`,
    status: 'sent',
    provider: 'fixture',
    error: null,
    occurredAt,
    metadata: {
      subject: fixtureEntry.subject,
      fixtureRetryRefetched: true,
      fixtureSyntheticSuccess: true,
    },
  };
}

const bodySchema = z.object({
  deliveryLogId: z
    .string()
    .refine((value) => z.uuid().safeParse(value).success || value in RETRY_ACTION_FIXTURE_ENTRIES, {
      message: 'Invalid delivery log id.',
    }),
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

function isDevOrTestFaultInjectionEnabled() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.APP_ENV === 'development' ||
    process.env.APP_ENV === 'test'
  );
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
      parts: [parsedBody.deliveryLogId],
      limit: 5,
      windowMs: 60_000,
      message: 'Too many email retry attempts. Please try again later.',
    });
    if (rateLimit) {
      return rateLimit;
    }

    if (parsedBody.simulateError && isDevOrTestFaultInjectionEnabled()) {
      return jsonError(
        500,
        'SIMULATED_RETRY_ERROR',
        'Forced retry mutation error for dev/test validation.',
      );
    }

    const memberships = await listUserRestaurantMemberships(supabase, user.id);
    const fallbackRestaurantId =
      memberships.find(
        (membership) =>
          typeof membership.restaurant_id === 'string' && membership.restaurant_id.length > 0,
      )?.restaurant_id ?? null;

    const fixtureEntry = isDevOrTestFaultInjectionEnabled()
      ? RETRY_ACTION_FIXTURE_ENTRIES[parsedBody.deliveryLogId]
      : undefined;

    const resendBookingEmail = async (
      bookingId: string,
      emailType: string | null,
      templateType: string | null,
    ) => {
      if (fixtureEntry) {
        const fixtureRestaurantId = fixtureEntry.restaurantId ?? fallbackRestaurantId;
        if (!fixtureRestaurantId) {
          throw new EmailDeliveryRetryError(
            'MISSING_BOOKING',
            'No restaurant access is available for this retry.',
          );
        }

        await requireRestaurantMember({
          supabase,
          userId: user.id,
          restaurantId: fixtureRestaurantId,
        });

        return resendBookingEmailFromDeliveryLog({
          booking: {
            id: bookingId,
            restaurant_id: fixtureRestaurantId,
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

      const restaurantId = booking.restaurant_id ?? fallbackRestaurantId;
      if (!restaurantId) {
        throw new EmailDeliveryRetryError(
          'MISSING_BOOKING',
          'No restaurant access is available for this retry.',
        );
      }

      await requireRestaurantMember({
        supabase,
        userId: user.id,
        restaurantId,
      });

      return resendBookingEmailFromDeliveryLog({
        booking,
        emailType,
        templateType,
      });
    };

    const retriedEntry = fixtureEntry
      ? await (async () => {
          const fixtureRestaurantId = fixtureEntry.restaurantId ?? fallbackRestaurantId;
          if (!fixtureRestaurantId) {
            throw new EmailDeliveryRetryError(
              'MISSING_BOOKING',
              'No restaurant access is available for this retry.',
            );
          }

          await requireRestaurantMember({
            supabase,
            userId: user.id,
            restaurantId: fixtureRestaurantId,
          });

          return buildFixtureRetrySuccessEntry({
            deliveryLogId: parsedBody.deliveryLogId,
            fixtureEntry,
            restaurantId: fixtureRestaurantId,
          });
        })()
      : await retryEmailDeliveryLogEntry({
          deliveryLogId: parsedBody.deliveryLogId,
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

      if (error.code === 'FORBIDDEN') {
        return jsonError(403, 'FORBIDDEN', error.message);
      }

      return jsonError(error.status, 'INTERNAL', error.message);
    }

    if (error instanceof EmailDeliveryRetryError) {
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
