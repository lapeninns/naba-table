import { DateTime } from 'luxon';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { apiError, internalError, notFound, validationError } from '@/lib/api/errors';
import { addUtcDays, daysBetweenInclusive, safeDate } from '@/lib/api/query-params';
import { getRestaurantBySlug } from '@/server/restaurants';
import { getRestaurantCalendarMask } from '@/server/restaurants/calendarMask';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';

const ROUTE = '/api/restaurants/[slug]/calendar-mask';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type RouteContext = {
  params: Promise<{ slug: string | string[] }>;
};

const CALENDAR_MASK_MAX_WINDOW_DAYS = 62;
const CALENDAR_MASK_MAX_HORIZON_DAYS = 370;

const resolveSlug = async (paramsPromise: RouteContext['params']): Promise<string | null> => {
  const { slug } = await paramsPromise;
  if (Array.isArray(slug)) {
    return slug[0] ?? null;
  }
  if (typeof slug === 'string' && slug.trim().length > 0) {
    return slug;
  }
  return null;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const slug = await resolveSlug(params);
  if (!slug) {
    return apiError(400, 'MISSING_SLUG', 'Missing restaurant slug.');
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: safeDate(url.searchParams, 'from'),
    to: safeDate(url.searchParams, 'to'),
  });

  if (!parsed.success) {
    return validationError(parsed.error, 'Invalid query parameters.');
  }

  const { from, to } = parsed.data;
  const fromDate = DateTime.fromISO(from, { zone: 'utc' });
  const toDate = DateTime.fromISO(to, { zone: 'utc' });

  if (!fromDate.isValid || !toDate.isValid) {
    return apiError(400, 'INVALID_DATE_RANGE', 'Invalid date range.');
  }

  if (toDate < fromDate) {
    return apiError(400, 'INVALID_DATE_RANGE', '`to` must be on or after `from`.');
  }

  const windowDays = daysBetweenInclusive(from, to);
  if (!Number.isFinite(windowDays) || windowDays > CALENDAR_MASK_MAX_WINDOW_DAYS) {
    return apiError(
      400,
      'DATE_RANGE_TOO_LONG',
      `Date range must be ${CALENDAR_MASK_MAX_WINDOW_DAYS} days or less.`,
    );
  }

  const maxHorizonDate = addUtcDays(new Date(), CALENDAR_MASK_MAX_HORIZON_DAYS);
  if (to > maxHorizonDate) {
    return apiError(400, 'BEYOND_BOOKING_HORIZON', 'Date range exceeds the booking horizon.');
  }

  const preflightRateLimit = await requireApiRateLimit({
    request,
    scope: 'calendar-mask:public',
    limit: 40,
    windowMs: 60_000,
    message: 'Too many calendar requests. Please try again in a moment.',
  });
  if (preflightRateLimit) {
    return preflightRateLimit;
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return notFound('RESTAURANT_NOT_FOUND', 'Restaurant not found.');
  }

  const tenantRateLimit = await requireApiRateLimit({
    request,
    scope: 'calendar-mask:tenant',
    tenantId: restaurant.id,
    limit: 30,
    windowMs: 60_000,
    message: 'Too many calendar requests. Please try again in a moment.',
  });
  if (tenantRateLimit) {
    return tenantRateLimit;
  }

  try {
    const mask = await getRestaurantCalendarMask({
      restaurantId: restaurant.id,
      timezone: restaurant.timezone ?? 'UTC',
      from,
      to,
    });

    return NextResponse.json(mask, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  } catch (error) {
    return internalError(error, { route: ROUTE, slug }, 'Unable to load calendar mask');
  }
}
