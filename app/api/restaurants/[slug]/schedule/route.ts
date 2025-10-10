import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';
import { getRestaurantSchedule } from '@/server/restaurants/schedule';

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(
      z.literal('').transform((): undefined => undefined),
    ),
});

type RouteParams = {
  params: Promise<{
    slug: string | string[];
  }>;
};

async function resolveSlug(paramsPromise: Promise<{ slug: string | string[] }> | undefined): Promise<string | null> {
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
  const parsed = querySchema.safeParse({ date: url.searchParams.get('date') ?? undefined });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const schedule = await getRestaurantSchedule(restaurant.id, {
      date: parsed.data.date,
    });

    return NextResponse.json(schedule, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  } catch (error) {
    console.error('[restaurants][schedule] failed to load schedule', { slug, error });
    return NextResponse.json({ error: 'Unable to load schedule' }, { status: 500 });
  }
}
