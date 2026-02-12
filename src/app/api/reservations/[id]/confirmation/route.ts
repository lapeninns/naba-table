import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { normalizeEmail, normalizePhone } from '@/server/customers';
import { buildReservationConfirmationPdfBuffer } from '@/server/reservations/confirmation-pdf';
import { validateSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });

function extractSessionRecoveryAccessToken(req: NextRequest): string | null {
  return (
    req.headers.get('x-session-recovery-token') ??
    req.nextUrl.searchParams.get('access_token') ??
    req.nextUrl.searchParams.get('accessToken') ??
    req.cookies.get('sr_access')?.value ??
    null
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string | string[] }> },
) {
  const { id } = await params;
  const normalized = Array.isArray(id) ? id[0] : id;

  if (!normalized) {
    return NextResponse.json({ error: 'Reservation id required' }, { status: 400 });
  }

  const service = getServiceSupabaseClient();
  const { data: booking, error } = await service
    .from('bookings')
    .select(
      'id, reference, auth_user_id, customer_email, customer_phone, restaurant_id, customer_name, start_at, booking_date, start_time, party_size, status, notes',
    )
    .eq('id', normalized)
    .maybeSingle();

  if (error) {
    console.error('[api.reservations.confirmation] booking lookup failed', error);
    return NextResponse.json({ error: 'Unable to load reservation' }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
  }

  const recoveryToken = extractSessionRecoveryAccessToken(req);
  if (recoveryToken) {
    const secret = env.security.sessionRecoveryAccessTokenSecret;
    if (!secret) {
      return NextResponse.json(
        { error: 'Session recovery token not configured', code: 'ACCESS_TOKEN_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    const tokenResult = validateSessionRecoveryAccessToken(recoveryToken, { secret });
    if (!tokenResult.ok) {
      const code =
        tokenResult.reason === 'expired' ? 'ACCESS_TOKEN_EXPIRED' : 'INVALID_ACCESS_TOKEN';
      const status = tokenResult.reason === 'expired' ? 410 : 401;
      return NextResponse.json({ error: 'Invalid session recovery token', code }, { status });
    }

    const bookingEmail = booking.customer_email ? normalizeEmail(booking.customer_email) : null;
    const bookingPhone = booking.customer_phone ? normalizePhone(booking.customer_phone) : null;
    const tokenEmail = normalizeEmail(tokenResult.payload.email);
    const tokenPhone = normalizePhone(tokenResult.payload.phone);

    const tokenMatches =
      booking.restaurant_id === tokenResult.payload.restaurantId &&
      Boolean(bookingEmail) &&
      Boolean(bookingPhone) &&
      bookingEmail === tokenEmail &&
      bookingPhone === tokenPhone;

    if (!tokenMatches) {
      return forbidden;
    }
  } else {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized;
    }

    const customerEmail = booking.customer_email ? normalizeEmail(booking.customer_email) : null;
    const userEmail = user.email ? normalizeEmail(user.email) : null;
    const matchesAuthUser =
      (booking.auth_user_id && booking.auth_user_id === user.id) ||
      (customerEmail && userEmail && customerEmail === userEmail);

    if (!matchesAuthUser) {
      return forbidden;
    }
  }

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
      console.error(
        '[api.reservations.confirmation] restaurant lookup failed',
        restaurantError,
      );
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

  return new NextResponse(pdfArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reservation-${reference}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
