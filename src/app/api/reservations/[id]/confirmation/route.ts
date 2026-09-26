import { NextResponse } from 'next/server';

import { apiError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import {
  finalizeGuestAccessResponse,
  resolveGuestBookingAccess,
} from '@/server/bookings/guest-booking-access';
import { buildReservationConfirmationPdfBuffer } from '@/server/reservations/confirmation-pdf';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/reservations/[id]/confirmation
 *
 * Downloads the reservation confirmation PDF. Access goes through the
 * booking-scoped guest resolver (booking cookie or owning session).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string | string[] }> },
) {
  const { id } = await params;
  const normalized = Array.isArray(id) ? id[0] : id;

  if (!normalized) {
    return apiError(400, 'MISSING_BOOKING_ID', 'Reservation id required.');
  }

  if (!UUID_REGEX.test(normalized)) {
    return apiError(400, 'INVALID_BOOKING_ID', 'Invalid reservation id.');
  }

  const resolution = await resolveGuestBookingAccess(req, normalized, { op: 'read' });
  if (!resolution.ok) {
    return resolution.response;
  }

  const booking = resolution.booking;
  const service = getServiceSupabaseClient();

  const reference = booking.reference ?? normalized;
  let venueName: string | null = null;
  let venueAddress: string | null = null;
  let venueTimezone: string | null = null;

  if (booking.restaurant_id) {
    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .select('name, address, timezone')
      .eq('id', booking.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      logger.warn('reservations.confirmation.restaurant_lookup_failed', {
        bookingId: normalized,
      });
    } else if (restaurant) {
      venueName = restaurant.name ?? null;
      venueAddress = restaurant.address ?? null;
      venueTimezone = restaurant.timezone ?? null;
    }
  }

  const file = buildReservationConfirmationPdfBuffer({
    reference,
    guestName: booking.customer_name,
    startAt: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    venueName,
    venueAddress,
    timezone: venueTimezone,
    status: booking.status,
    notes: booking.notes,
  });
  const pdfArrayBuffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;

  const response = new NextResponse(pdfArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reservation-${reference}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
  return finalizeGuestAccessResponse(req, response, {
    bookingId: normalized,
    clearCookie: resolution.clearCookie,
  });
}
