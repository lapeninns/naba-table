import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { GuardError, requireRestaurantMember, requireSession } from '@/server/auth/guards';
import {
  listSmsDeliveryEventsForBooking,
  SmsDeliveryLogUnavailableError,
} from '@/server/sms/delivery-log';
import { sanitizeOpsSmsDeliveryEvents } from '@/src/lib/sms-delivery/sanitize';

import type { BookingSmsDeliveryResponse } from '@/types/smsDelivery';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(
  status: number,
  payload: Omit<Extract<BookingSmsDeliveryResponse, { ok: false }>, 'ok'> & { message?: string },
) {
  return NextResponse.json(
    {
      ok: false,
      ...payload,
      message: payload.message ?? payload.error,
    } satisfies BookingSmsDeliveryResponse & { message: string },
    { status },
  );
}

function parseLimit(raw: string | null): { ok: true; value: number } | { ok: false } {
  if (raw === null) return { ok: true, value: 50 };
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return { ok: false };
  return { ok: true, value: Math.max(1, Math.min(200, parsed)) };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: bookingId } = await context.params;

  if (!bookingId || !z.string().uuid().safeParse(bookingId).success) {
    return NextResponse.json(
      { error: 'Invalid booking id', code: 'INVALID_BOOKING_ID', message: 'Invalid booking id' },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get('limit'));
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Invalid limit', code: 'INVALID_LIMIT', message: 'Invalid limit' },
      { status: 400 },
    );
  }

  try {
    const { supabase, user } = await requireSession();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, restaurant_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) {
      console.error('[ops][bookings][sms-delivery] failed to load booking', {
        bookingId,
        code: bookingError.code ?? null,
        message: bookingError.message,
      });
      return jsonError(500, { code: 'INTERNAL', error: 'Unable to load booking' });
    }

    if (!booking) {
      return jsonError(404, { code: 'BOOKING_NOT_FOUND', error: 'Booking not found' });
    }

    await requireRestaurantMember({
      supabase,
      userId: user.id,
      restaurantId: booking.restaurant_id,
    });

    const events = await listSmsDeliveryEventsForBooking({
      bookingId,
      limit: limit.value,
    });

    return NextResponse.json(
      {
        ok: true,
        bookingId,
        events: sanitizeOpsSmsDeliveryEvents(events),
      } satisfies Extract<BookingSmsDeliveryResponse, { ok: true }>,
      {
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
      },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      const mapped =
        error.code === 'UNAUTHENTICATED'
          ? { status: 401 as const, code: 'UNAUTHENTICATED' as const, error: error.message }
          : error.code === 'FORBIDDEN'
            ? { status: 403 as const, code: 'FORBIDDEN' as const, error: error.message }
            : {
                status: error.status as 401 | 403 | 404 | 500,
                code: 'INTERNAL' as const,
                error: error.message,
              };
      return jsonError(mapped.status, { code: mapped.code, error: mapped.error });
    }

    if (error instanceof SmsDeliveryLogUnavailableError) {
      return jsonError(503, {
        code: 'DELIVERY_LOG_UNAVAILABLE',
        error: 'Delivery tracking is temporarily unavailable',
      });
    }

    console.error('[ops][bookings][sms-delivery] unexpected error', {
      bookingId,
      error: error instanceof Error ? error.message : String(error),
    });
    captureServerException(error, {
      properties: { bookingId, source: 'ops', kind: 'ops-booking-sms-delivery' },
    });

    return jsonError(500, { code: 'INTERNAL', error: 'Internal error' });
  }
}
