import { NextResponse } from 'next/server';

import { createRestaurantSchema } from '@/app/api/ops/restaurants/schema';
import { createRestaurant } from '@/server/restaurants/create';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { validateCsrfToken } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ message: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ message: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'onboarding.restaurant.create',
    userId: user.id,
    limit: 5,
    windowMs: 60_000,
    message: 'Too many restaurant setup attempts. Please try again later.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  let memberships;
  try {
    memberships = await fetchUserMemberships(user.id, supabase);
  } catch (membershipError) {
    console.error('[onboarding][restaurant][POST] membership lookup failed', membershipError);
    return NextResponse.json({ message: 'Unable to verify onboarding state' }, { status: 500 });
  }

  const hasExistingRestaurant = memberships.some(
    (membership) =>
      typeof membership.restaurant_id === 'string' && membership.restaurant_id.length > 0,
  );
  if (hasExistingRestaurant) {
    return NextResponse.json(
      { message: 'Restaurant onboarding has already been completed for this account' },
      { status: 409 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const parsed = createRestaurantSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const created = await createRestaurant(parsed.data, user.id, getServiceSupabaseClient());
    return NextResponse.json(
      {
        restaurant: {
          id: created.id,
          name: created.name,
          slug: created.slug,
          timezone: created.timezone,
        },
      },
      { status: 201 },
    );
  } catch (creationError) {
    console.error('[onboarding][restaurant][POST]', creationError);
    const message =
      creationError instanceof Error ? creationError.message : 'Unable to create restaurant';
    return NextResponse.json({ message }, { status: 500 });
  }
}
