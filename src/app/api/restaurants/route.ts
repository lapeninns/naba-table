import { NextResponse } from 'next/server';

import { listRestaurants } from '@/server/restaurants/listRestaurants';

import type { RestaurantFilters } from '@/lib/restaurants/types';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const search = searchParams.get('search') || undefined;
        const timezone = searchParams.get('timezone') || undefined;
        const fixture = searchParams.get('fixture') || undefined;
        const minCapacity = searchParams.get('minCapacity')
            ? Number.parseInt(searchParams.get('minCapacity')!, 10)
            : undefined;

        const filters: RestaurantFilters = {
            search,
            timezone,
            minCapacity,
            fixture,
        };

        const restaurants = await listRestaurants(filters);

        return NextResponse.json({ data: restaurants });
    } catch (error) {
        console.error('[api/restaurants] failed to list restaurants', error);
        return NextResponse.json(
            { error: 'Failed to list restaurants' },
            { status: 500 }
        );
    }
}
