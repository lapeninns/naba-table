import { NextResponse } from 'next/server';

import { internalError } from '@/lib/api/errors';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

import type { RestaurantFilters } from '@/lib/restaurants/types';
import type { NextRequest } from 'next/server';

const ROUTE = '/api/restaurants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const timezone = searchParams.get('timezone') || undefined;
    const minCapacity = searchParams.get('minCapacity')
      ? Number.parseInt(searchParams.get('minCapacity')!, 10)
      : undefined;

    const filters: RestaurantFilters = {
      search,
      timezone,
      minCapacity,
    };

    const restaurants = await listRestaurants(filters);

    return NextResponse.json({ data: restaurants });
  } catch (error) {
    return internalError(error, { route: ROUTE }, 'Failed to list restaurants.');
  }
}
