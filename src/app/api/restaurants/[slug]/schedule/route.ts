import { NextResponse } from 'next/server';
import { z } from 'zod';

import { addUtcDays, safeDate } from '@/lib/api/query-params';
import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';
import { logger } from '@/lib/logger';
import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';
import { getGuestBookingSchedule } from '@/server/restaurants/guestBookingSchedule';
import { getRestaurantSchedule } from '@/server/restaurants/schedule';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/restaurants/[slug]/schedule';

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('').transform((): undefined => undefined)),
  party: z.coerce.number().int().min(MIN_ONLINE_PARTY_SIZE).max(MAX_ONLINE_PARTY_SIZE).optional(),
});

const RESTAURANT_SCHEDULE_MAX_HORIZON_DAYS = 370;

type RouteParams = {
  params: Promise<{
    slug: string | string[];
  }>;
};

async function resolveSlug(
  paramsPromise: Promise<{ slug: string | string[] }> | undefined,
): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { slug } = params;
  if (typeof slug === 'string') return slug;
  if (Array.isArray(slug)) return slug[0] ?? null;
  return null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const slug = await resolveSlug(params);
  if (!slug) {
    return NextResponse.json({ error: 'Missing restaurant slug' }, { status: 400 });
  }

  const url = new URL(request.url);
  const rawDate = url.searchParams.get('date');
  const rawParty = url.searchParams.get('party');
  const queryDate =
    rawDate === null || rawDate.trim() === '' ? undefined : safeDate(url.searchParams, 'date');
  const parsed = querySchema.safeParse({
    date: queryDate ?? (rawDate ? '__invalid_date__' : undefined),
    party: rawParty === null || rawParty.trim() === '' ? undefined : rawParty,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const maxHorizonDate = addUtcDays(new Date(), RESTAURANT_SCHEDULE_MAX_HORIZON_DAYS);
  if (parsed.data.date && parsed.data.date > maxHorizonDate) {
    return NextResponse.json({ error: 'Date exceeds the booking horizon' }, { status: 400 });
  }

  const rateLimitResponse = await requireApiRateLimit({
    request,
    scope: 'restaurant-schedule:public',
    limit: 40,
    windowMs: 60_000,
    message: 'Too many schedule requests. Please try again in a moment.',
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const tenantRateLimitResponse = await requireApiRateLimit({
      request,
      scope: 'restaurant-schedule:tenant',
      tenantId: restaurant.id,
      limit: 30,
      windowMs: 60_000,
      message: 'Too many schedule requests. Please try again in a moment.',
    });
    if (tenantRateLimitResponse) {
      return tenantRateLimitResponse;
    }

    const schedule =
      parsed.data.party === undefined
        ? await getRestaurantSchedule(restaurant.id, { date: parsed.data.date })
        : await getGuestBookingSchedule(restaurant.id, {
            date: parsed.data.date,
            partySize: parsed.data.party,
          });

    return NextResponse.json(schedule, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  } catch (error) {
    logger.error('[restaurants][schedule] failed to load schedule', {
      route: ROUTE,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unable to load schedule' }, { status: 500 });
  }
}
