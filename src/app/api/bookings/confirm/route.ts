import { apiError } from '@/lib/api/errors';
import { clearLegacyGuestCookies } from '@/server/bookings/guest-booking-access';

/**
 * GET /api/bookings/confirm (retired)
 *
 * This endpoint used to exchange a one-time confirmation token (query string
 * or the `sr_confirm` cookie) for booking details. It was a second bearer
 * that bypassed booking-scoped access, and nothing in the app calls it. It now
 * answers 410 for every request, reads no token and returns no booking data,
 * and clears the retired `sr_confirm`/`sr_access` cookies.
 */
function retiredResponse() {
  const response = apiError(
    410,
    'CONFIRMATION_ENDPOINT_RETIRED',
    'This confirmation link is no longer supported. Use the link in your booking email.',
  );
  response.headers.set('Cache-Control', 'no-store');
  clearLegacyGuestCookies(response);
  return response;
}

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}

export const dynamic = 'force-dynamic';
