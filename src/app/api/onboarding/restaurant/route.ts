import { NextResponse } from 'next/server';

import { createRestaurantSchema } from '@/app/api/ops/restaurants/schema';
import { apiError, conflict, forbidden, unauthenticated, validationError } from '@/lib/api/errors';
import { onboardingInternalError } from '@/server/onboarding/errors';
import { createRestaurant } from '@/server/restaurants/create';
import {
  RestaurantAccessExistsError,
  RestaurantCreateValidationError,
  RestaurantSlugUnavailableError,
} from '@/server/restaurants/create-errors';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { validateCsrfToken } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const ROUTE = 'onboarding.restaurant.create';
const ALREADY_ONBOARDED_MESSAGE =
  'This account already has a restaurant. Open the dashboard to manage it.';

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) {
    return forbidden(
      'CSRF_INVALID',
      'Your session token is out of date. Refresh the page and try again.',
    );
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return onboardingInternalError(error, { route: ROUTE });
  }

  if (!user) {
    return unauthenticated();
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
    return onboardingInternalError(membershipError, { route: ROUTE, userId: user.id });
  }

  const hasExistingRestaurant = memberships.some(
    (membership) =>
      typeof membership.restaurant_id === 'string' && membership.restaurant_id.length > 0,
  );
  if (hasExistingRestaurant) {
    return conflict('ONBOARDING_ALREADY_COMPLETED', ALREADY_ONBOARDED_MESSAGE);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = createRestaurantSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
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
    if (creationError instanceof RestaurantAccessExistsError) {
      return conflict('ONBOARDING_ALREADY_COMPLETED', ALREADY_ONBOARDED_MESSAGE);
    }
    if (creationError instanceof RestaurantSlugUnavailableError) {
      return conflict('SLUG_TAKEN', 'That web address is taken. Try a different slug.', {
        fields: { slug: ['That web address is taken. Try a different slug.'] },
      });
    }
    if (creationError instanceof RestaurantCreateValidationError) {
      return apiError(400, 'VALIDATION_FAILED', creationError.message);
    }
    return onboardingInternalError(creationError, { route: ROUTE, userId: user.id });
  }
}
