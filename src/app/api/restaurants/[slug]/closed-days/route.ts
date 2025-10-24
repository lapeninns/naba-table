import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';
import { getClosedDaysForRange } from '@/server/restaurants/closedDays';

const querySchema = z.object({
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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

function monthBoundsIso(date: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  const toIso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { start: toIso(start), end: toIso(end) };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const slug = await resolveSlug(params);
  if (!slug) {
    return NextResponse.json({ error: 'Missing restaurant slug' }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ start: url.searchParams.get('start') ?? undefined, end: url.searchParams.get('end') ?? undefined });
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

    let { start, end } = parsed.data;
    if (!start || !end) {
      const now = new Date();
      const bounds = monthBoundsIso(now);
      start = start ?? bounds.start;
      end = end ?? bounds.end;
    }

    const result = await getClosedDaysForRange(restaurant.id, start, end);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=1800',
      },
    });
  } catch (error) {
    console.error('[restaurants][closed-days] failed to load', { slug, error });
    return NextResponse.json({ error: 'Unable to load closed days' }, { status: 500 });
  }
}
