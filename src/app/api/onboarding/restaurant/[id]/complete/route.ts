import { NextResponse } from 'next/server';

import { conflict } from '@/lib/api/errors';
import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { onboardingInternalError } from '@/server/onboarding/errors';
import { getOnboardingReadiness } from '@/server/onboarding/readiness';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const ROUTE = 'onboarding.restaurant.complete';

/**
 * Launch readiness check. There is no onboarding state column to flip (see
 * product-rules §2), so "complete" verifies that the restaurant can take bookings:
 * weekly operating hours, at least one service period and at least one table.
 * Read-only and idempotent. The client navigates to the ops dashboard on success.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const authorization = await withRestaurantAuthorization(req, restaurantId, {
    csrf: true,
    roles: RESTAURANT_ADMIN_ROLES,
  });
  if (!authorization.ok) {
    return authorization.response;
  }

  try {
    const readiness = await getOnboardingReadiness(getServiceSupabaseClient(), restaurantId);
    if (!readiness.ready) {
      return conflict(
        'ONBOARDING_INCOMPLETE',
        'Finish the remaining setup steps before launching.',
        { details: { missing: readiness.missing } },
      );
    }
    return NextResponse.json({ status: 'ok', ready: true, restaurantId });
  } catch (error) {
    return onboardingInternalError(error, {
      route: ROUTE,
      restaurantId,
      userId: authorization.user.id,
    });
  }
}
