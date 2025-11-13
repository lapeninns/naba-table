import { DateTime } from 'luxon';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getRestaurantBySlug } from '@/server/restaurants';
import { getRestaurantCalendarMask } from '@/server/restaurants/calendarMask';

const querySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
});

type RouteContext = {
  params: Promise<{ slug: string | string[] }>;
};

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
    return NextResponse.json({ error: 'Missing restaurant slug' }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { from, to } = parsed.data;
  const fromDate = DateTime.fromISO(from, { zone: 'utc' });
  const toDate = DateTime.fromISO(to, { zone: 'utc' });

  if (!fromDate.isValid || !toDate.isValid) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

  if (toDate < fromDate) {
    return NextResponse.json({ error: '`to` must be on or after `from`' }, { status: 400 });
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
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
    console.error('[restaurants][calendar-mask] failed to load mask', { slug, error });
    return NextResponse.json({ error: 'Unable to load calendar mask' }, { status: 500 });
  }
}
