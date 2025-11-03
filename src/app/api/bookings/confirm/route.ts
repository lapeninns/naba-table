import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  validateConfirmationToken,
  markTokenUsed,
  toPublicConfirmation,
  TokenValidationError,
} from '@/server/bookings/confirmation-token';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { extractClientIp, anonymizeIp } from '@/server/security/request';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest} from 'next/server';

const tokenSchema = z.string().min(64).max(64);

/**
 * GET /api/bookings/confirm?token=xxx
 * 
 * Public endpoint for guest confirmation page access.
 * Validates a one-time confirmation token and returns booking details.
 * 
 * Rate limited: 20 requests per minute per IP
 * 
 * @returns 200 with booking details if valid
 * @returns 400 if token format invalid
 * @returns 404 if token not found
 * @returns 410 if token expired or already used
 * @returns 429 if rate limit exceeded
 * @returns 500 on server error
 */
export async function GET(req: NextRequest) {
  const clientIp = extractClientIp(req);

  // Rate limiting: Prevent brute-force token guessing
  const rateResult = await consumeRateLimit({
    identifier: `bookings:confirm:${anonymizeIp(clientIp)}`,
    limit: 20,
    windowMs: 60_000, // 20 requests per minute
  });

  if (!rateResult.ok) {
    const retryAfter = Math.ceil((rateResult.resetAt - Date.now()) / 1000);

    return NextResponse.json(
      {
        error: 'Too many confirmation requests',
        code: 'RATE_LIMITED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': rateResult.limit.toString(),
          'X-RateLimit-Remaining': rateResult.remaining.toString(),
          'X-RateLimit-Reset': rateResult.resetAt.toString(),
        },
      },
    );
  }

  // Read token from query or secure cookie (PRG pattern)
  const queryToken = req.nextUrl.searchParams.get('token');
  const cookieToken = req.cookies.get('sr_confirm')?.value ?? null;
  const candidate = queryToken ?? cookieToken ?? null;

  if (!candidate || !tokenSchema.safeParse(candidate).success) {
    return NextResponse.json(
      {
        error: 'Invalid or missing confirmation token',
        code: 'INVALID_TOKEN',
      },
      { status: 400 },
    );
  }
  const token = candidate;

  try {
    // Validate token and get booking
    const booking = await validateConfirmationToken(token);

    // Mark token as used (prevents replay)
    await markTokenUsed(token);

    // Get restaurant name for display
    const supabase = getServiceSupabaseClient();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', booking.restaurant_id)
      .single();

    const restaurantName = restaurant?.name ?? 'Restaurant';

    // Transform to public-safe data (no PII)
    const publicBooking = toPublicConfirmation(booking, restaurantName);

    const res = NextResponse.json({ booking: publicBooking });
    // Clear the ephemeral confirmation cookie if present
    res.cookies.set('sr_confirm', '', { path: '/thank-you', maxAge: 0 });
    return res;
  } catch (error: unknown) {
    // Handle token validation errors
    if (error instanceof TokenValidationError) {
      const statusCode = error.code === 'TOKEN_NOT_FOUND' ? 404 : 410;

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: statusCode },
      );
    }

    // Handle unexpected errors
    console.error('[bookings/confirm] Unexpected error', error);

    return NextResponse.json(
      {
        error: 'Unable to confirm booking',
        code: 'SERVER_ERROR',
      },
      { status: 500 },
    );
  }
}
