import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, forbidden, internalError, notFound, unauthenticated } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { GuardError, requireRestaurantMember, requireSession } from '@/server/auth/guards';
import {
  EmailDeliveryLogUnavailableError,
  listEmailDeliveryEventsForBooking,
} from '@/server/emails/email-delivery-log';

import type { BookingEmailDeliveryResponse } from '@/types/emailDelivery';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROUTE = '/api/ops/bookings/[id]/email-delivery';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseLimit(raw: string | null): { ok: true; value: number } | { ok: false } {
  if (raw === null) return { ok: true, value: 50 };
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return { ok: false };
  const clamped = Math.max(1, Math.min(200, parsed));
  return { ok: true, value: clamped };
}

class BookingLookupFailedError extends Error {
  constructor(readonly dbCode: string | null) {
    super('Booking lookup failed');
    this.name = 'BookingLookupFailedError';
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: bookingId } = await context.params;

  if (!bookingId || !z.string().uuid().safeParse(bookingId).success) {
    return apiError(400, 'INVALID_BOOKING_ID', 'Invalid booking id.');
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get('limit'));
  if (!limit.ok) {
    return apiError(400, 'INVALID_LIMIT', 'Invalid limit.');
  }

  try {
    const { supabase, user } = await requireSession();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, restaurant_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      throw new BookingLookupFailedError(bookingError.code ?? null);
    }

    if (!booking) {
      return notFound('BOOKING_NOT_FOUND', 'Booking not found.');
    }

    await requireRestaurantMember({
      supabase,
      userId: user.id,
      restaurantId: booking.restaurant_id,
    });

    const events = await listEmailDeliveryEventsForBooking({
      bookingId,
      limit: limit.value,
    });

    return NextResponse.json(
      { ok: true, bookingId, events } satisfies Extract<BookingEmailDeliveryResponse, { ok: true }>,
      {
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
      },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      if (error.code === 'UNAUTHENTICATED') return unauthenticated();
      if (error.status === 404) return notFound('BOOKING_NOT_FOUND', 'Booking not found.');
      return forbidden();
    }

    if (error instanceof EmailDeliveryLogUnavailableError) {
      return apiError(
        503,
        'DELIVERY_LOG_UNAVAILABLE',
        'Delivery tracking is temporarily unavailable. Try again shortly.',
        { retryable: true },
      );
    }

    captureServerException(error, {
      properties: { bookingId, source: 'ops', kind: 'ops-booking-email-delivery' },
    });
    return internalError(error, { route: ROUTE, bookingId });
  }
}
