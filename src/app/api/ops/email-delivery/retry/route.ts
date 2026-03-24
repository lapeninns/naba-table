import { NextResponse } from 'next/server';
import { z } from 'zod';

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
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  deliveryLogId: z.string().uuid(),
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

export async function POST(request: NextRequest) {
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

    const memberships = await listUserRestaurantMemberships(supabase, user.id);
    const fallbackRestaurantId =
      memberships.find((membership) => typeof membership.restaurant_id === 'string' && membership.restaurant_id.length > 0)
        ?.restaurant_id ?? null;

    const retriedEntry = await retryEmailDeliveryLogEntry({
      deliveryLogId: parsedBody.deliveryLogId,
      resendBookingEmail: async (bookingId, emailType, templateType) => {
        const serviceSupabase = getServiceSupabaseClient();
        const { data, error } = await serviceSupabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();

        if (error) {
          throw new Error(`Failed to load booking for retry (${error.code ?? 'unknown'}).`);
        }

        const booking = (data ?? null) as BookingRecord | null;
        if (!booking) {
          throw new EmailDeliveryRetryError('MISSING_BOOKING', 'The original booking could not be loaded for retry.');
        }

        const restaurantId = booking.restaurant_id ?? fallbackRestaurantId;
        if (!restaurantId) {
          throw new EmailDeliveryRetryError('MISSING_BOOKING', 'No restaurant access is available for this retry.');
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
      },
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
      return jsonError(503, 'DELIVERY_LOG_UNAVAILABLE', 'Delivery tracking is temporarily unavailable');
    }

    console.error('[ops/email-delivery/retry] unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonError(500, 'INTERNAL', 'Internal error');
  }
}
