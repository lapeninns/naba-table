import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, internalError, notFound } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import {
  getRestaurantBySlug,
  type RestaurantDetail,
} from '@/server/restaurants/getRestaurantBySlug';

import type { VenueDetails } from '@reserve/shared/config/venue';
import type { NextRequest } from 'next/server';

const ROUTE = '/api/restaurants/[slug]';

const slugSchema = z.string().min(1);

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

function toVenueDetails(restaurant: RestaurantDetail): VenueDetails {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name ?? '',
    address: restaurant.address ?? '',
    phone: restaurant.contactPhone ?? '',
    email: restaurant.contactEmail ?? '',
    policy: restaurant.bookingPolicy ?? '',
    timezone: restaurant.timezone ?? '',
    logoUrl: restaurant.logoUrl ?? null,
    googleMapUrl: restaurant.googleMapUrl ?? null,
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const slug = await resolveSlug(params);
  if (!slug) {
    return apiError(400, 'MISSING_SLUG', 'Missing restaurant slug.');
  }

  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return apiError(400, 'INVALID_SLUG', 'Invalid restaurant slug.');
  }

  try {
    const restaurant = await getRestaurantBySlug(parsed.data);
    if (!restaurant) {
      return notFound('RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }

    return NextResponse.json(
      { restaurant: toVenueDetails(restaurant) },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=120',
        },
      },
    );
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'api', kind: 'restaurant-detail' },
    });
    return internalError(error, { route: ROUTE, slug }, 'Unable to load restaurant');
  }
}
