import { NextResponse } from 'next/server';

import { RESTAURANT_ROLE_OWNER } from '@/lib/owner/auth/roles';
import { deleteRestaurant, updateRestaurant } from '@/server/restaurants';
import { ensureLogoColumnOnRow, isLogoUrlColumnMissing, logLogoColumnFallback } from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireAdminMembership, requireMembershipForRestaurant } from '@/server/team/access';

import {
  updateRestaurantSchema,
  type RestaurantResponse,
  type DeleteRestaurantResponse,
  type RestaurantDTO,
} from '../schema';

import type { Database } from '@/types/supabase';
import type { NextRequest} from 'next/server';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MembershipGuardErrorCode = 'MEMBERSHIP_NOT_FOUND' | 'MEMBERSHIP_ROLE_DENIED';

function getMembershipGuardErrorCode(error: unknown): MembershipGuardErrorCode | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code = (error as { code?: string }).code;
  if (code === 'MEMBERSHIP_NOT_FOUND' || code === 'MEMBERSHIP_ROLE_DENIED') {
    return code;
  }

  return null;
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
  let membershipRole: RestaurantDTO['role'] = 'viewer';
  try {
    const membership = await requireMembershipForRestaurant({ userId: user.id, restaurantId });
    membershipRole = (membership.role as RestaurantDTO['role']) ?? 'viewer';
  } catch (error) {
    const membershipErrorCode = getMembershipGuardErrorCode(error);
    if (membershipErrorCode === 'MEMBERSHIP_NOT_FOUND') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (membershipErrorCode === 'MEMBERSHIP_ROLE_DENIED') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('[ops/restaurants/[id]][GET] membership guard failed', error);
    return NextResponse.json({ error: 'Unable to verify access' }, { status: 500 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  try {
    const selectRestaurant = (includeLogo: boolean) =>
      serviceSupabase
        .from('restaurants')
        .select(restaurantSelectColumns(includeLogo))
        .eq('id', restaurantId)
        .single<RestaurantRow>();

    let { data, error } = await selectRestaurant(true);

    if (error && isLogoUrlColumnMissing(error)) {
      logLogoColumnFallback('ops/restaurants/[id] GET');
      ({ data, error } = await selectRestaurant(false));
      data = ensureLogoColumnOnRow(data);
    }

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const restaurantRow = ensureLogoColumnOnRow(data);
    const restaurant: RestaurantDTO = {
      id: restaurantRow.id,
      name: restaurantRow.name,
      slug: restaurantRow.slug,
      timezone: restaurantRow.timezone,
      capacity: restaurantRow.capacity,
      contactEmail: restaurantRow.contact_email,
      contactPhone: restaurantRow.contact_phone,
      address: restaurantRow.address,
      bookingPolicy: restaurantRow.booking_policy,
      logoUrl: restaurantRow.logo_url,
      reservationIntervalMinutes: restaurantRow.reservation_interval_minutes,
      reservationDefaultDurationMinutes: restaurantRow.reservation_default_duration_minutes,
      reservationLastSeatingBufferMinutes: restaurantRow.reservation_last_seating_buffer_minutes,
      createdAt: restaurantRow.created_at,
      updatedAt: restaurantRow.updated_at,
      role: membershipRole,
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
  let membershipRole: RestaurantDTO['role'] = 'viewer';
  try {
    const membership = await requireAdminMembership({ userId: user.id, restaurantId });
    membershipRole = (membership.role as RestaurantDTO['role']) ?? 'viewer';
  } catch (error) {
    const membershipErrorCode = getMembershipGuardErrorCode(error);
    if (membershipErrorCode === 'MEMBERSHIP_NOT_FOUND') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (membershipErrorCode === 'MEMBERSHIP_ROLE_DENIED') {
      return NextResponse.json({ error: 'Forbidden: Owner or manager role required' }, { status: 403 });
    }

    console.error('[ops/restaurants/[id]][PATCH] membership guard failed', error);
    return NextResponse.json({ error: 'Unable to verify access' }, { status: 500 });
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
        logoUrl: input.logoUrl,
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
        logoUrl: restaurant.logoUrl,
        reservationIntervalMinutes: restaurant.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: restaurant.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: restaurant.reservationLastSeatingBufferMinutes,
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt,
        role: membershipRole,
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
  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId,
      allowedRoles: [RESTAURANT_ROLE_OWNER],
    });
  } catch (error) {
    const membershipErrorCode = getMembershipGuardErrorCode(error);
    if (membershipErrorCode === 'MEMBERSHIP_NOT_FOUND') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (membershipErrorCode === 'MEMBERSHIP_ROLE_DENIED') {
      return NextResponse.json({ error: 'Forbidden: Owner role required' }, { status: 403 });
    }

    console.error('[ops/restaurants/[id]][DELETE] membership guard failed', error);
    return NextResponse.json({ error: 'Unable to verify access' }, { status: 500 });
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
