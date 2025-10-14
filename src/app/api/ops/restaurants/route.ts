import { NextRequest, NextResponse } from 'next/server';

import { createRestaurant, listRestaurantsForOps } from '@/server/restaurants';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import {
  createRestaurantSchema,
  listRestaurantsQuerySchema,
  type RestaurantDTO,
  type RestaurantsListResponse,
  type RestaurantResponse,
} from './schema';

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/restaurants][GET] failed to resolve auth', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const rawParams = {
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    pageSize: req.nextUrl.searchParams.get('pageSize') ?? undefined,
    search: req.nextUrl.searchParams.get('search') ?? undefined,
    sort: req.nextUrl.searchParams.get('sort') ?? undefined,
  };

  const parsed = listRestaurantsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  const params = parsed.data;
  const serviceSupabase = getServiceSupabaseClient();

  try {
    const result = await listRestaurantsForOps(
      {
        userId: user.id,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sort: params.sort,
      },
      serviceSupabase,
    );

    const items: RestaurantDTO[] = result.restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      timezone: restaurant.timezone,
      capacity: restaurant.capacity,
      contactEmail: restaurant.contactEmail,
      contactPhone: restaurant.contactPhone,
      address: restaurant.address,
      bookingPolicy: restaurant.bookingPolicy,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
      role: restaurant.role,
    }));

    const response: RestaurantsListResponse = {
      items,
      pageInfo: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasNext: result.hasNext,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ops/restaurants][GET] query failed', error);
    return NextResponse.json({ error: 'Unable to fetch restaurants' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/restaurants][POST] failed to resolve auth', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const serviceSupabase = getServiceSupabaseClient();

  try {
    const restaurant = await createRestaurant(
      {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone,
        capacity: input.capacity,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        address: input.address,
        bookingPolicy: input.bookingPolicy,
      },
      user.id,
      serviceSupabase,
    );

    const response: RestaurantResponse = {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        timezone: restaurant.timezone,
        capacity: restaurant.capacity,
        contactEmail: restaurant.contactEmail,
        contactPhone: restaurant.contactPhone,
        address: restaurant.address,
        bookingPolicy: restaurant.bookingPolicy,
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt,
        role: 'owner',
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[ops/restaurants][POST] creation failed', error);
    const message = error instanceof Error ? error.message : 'Unable to create restaurant';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
