import { NextResponse } from 'next/server';

import { deleteRestaurant, updateRestaurant } from '@/server/restaurants';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import {
  updateRestaurantSchema,
  type RestaurantResponse,
  type DeleteRestaurantResponse,
  type RestaurantDTO,
} from '../schema';

import type { NextRequest} from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function verifyRestaurantAccess(
  userId: string,
  restaurantId: string,
  requiredRole?: 'owner' | 'admin',
): Promise<{ hasAccess: boolean; role?: string; error?: string }> {
  const supabase = getServiceSupabaseClient();

  try {
    const memberships = await fetchUserMemberships(userId, supabase);
    const membership = memberships.find((m) => m.restaurant_id === restaurantId);

    if (!membership) {
      return { hasAccess: false, error: 'Forbidden' };
    }

    if (requiredRole === 'owner' && membership.role !== 'owner') {
      return { hasAccess: false, error: 'Forbidden: Owner role required' };
    }

    if (requiredRole === 'admin' && !['owner', 'admin'].includes(membership.role)) {
      return { hasAccess: false, error: 'Forbidden: Admin or Owner role required' };
    }

    return { hasAccess: true, role: membership.role };
  } catch (error) {
    console.error('[verifyRestaurantAccess] Failed', error);
    return { hasAccess: false, error: 'Unable to verify access' };
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/restaurants/[id]][GET] failed to resolve auth', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: restaurantId } = await context.params;
  const access = await verifyRestaurantAccess(user.id, restaurantId);

  if (!access.hasAccess) {
    return NextResponse.json({ error: access.error ?? 'Forbidden' }, { status: 403 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  try {
    const { data, error } = await serviceSupabase
      .from('restaurants')
      .select(
        'id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy, reservation_interval_minutes, reservation_default_duration_minutes, reservation_last_seating_buffer_minutes, created_at, updated_at',
      )
      .eq('id', restaurantId)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const restaurant: RestaurantDTO = {
      id: data.id,
      name: data.name,
      slug: data.slug,
      timezone: data.timezone,
      capacity: data.capacity,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      address: data.address,
      bookingPolicy: data.booking_policy,
      reservationIntervalMinutes: data.reservation_interval_minutes,
      reservationDefaultDurationMinutes: data.reservation_default_duration_minutes,
      reservationLastSeatingBufferMinutes: data.reservation_last_seating_buffer_minutes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      role: (access.role as RestaurantDTO['role']) ?? 'viewer',
    };

    const response: RestaurantResponse = {
      restaurant,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ops/restaurants/[id]][GET] query failed', error);
    return NextResponse.json({ error: 'Unable to fetch restaurant' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/restaurants/[id]][PATCH] failed to resolve auth', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: restaurantId } = await context.params;
  const access = await verifyRestaurantAccess(user.id, restaurantId, 'admin');

  if (!access.hasAccess) {
    return NextResponse.json({ error: access.error ?? 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const serviceSupabase = getServiceSupabaseClient();

  try {
    const restaurant = await updateRestaurant(
      restaurantId,
      {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone,
        capacity: input.capacity,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        address: input.address,
        bookingPolicy: input.bookingPolicy,
        reservationIntervalMinutes: input.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: input.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: input.reservationLastSeatingBufferMinutes,
      },
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
        reservationIntervalMinutes: restaurant.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: restaurant.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: restaurant.reservationLastSeatingBufferMinutes,
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt,
        role: (access.role as RestaurantDTO['role']) ?? 'viewer',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ops/restaurants/[id]][PATCH] update failed', error);
    const message = error instanceof Error ? error.message : 'Unable to update restaurant';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/restaurants/[id]][DELETE] failed to resolve auth', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: restaurantId } = await context.params;
  const access = await verifyRestaurantAccess(user.id, restaurantId, 'owner');

  if (!access.hasAccess) {
    return NextResponse.json({ error: access.error ?? 'Forbidden' }, { status: 403 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  try {
    await deleteRestaurant(restaurantId, serviceSupabase);

    const response: DeleteRestaurantResponse = {
      success: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ops/restaurants/[id]][DELETE] deletion failed', error);
    const message = error instanceof Error ? error.message : 'Unable to delete restaurant';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
