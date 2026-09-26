import { NextResponse } from 'next/server';

import { apiError, internalError, unauthenticated } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

const ROUTE = '/api/ops/team/memberships';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    logger.warn('[team/memberships] auth error', { route: ROUTE, status: mapped.status });
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  try {
    const memberships = await fetchUserMemberships(user.id);
    return NextResponse.json({
      memberships: memberships.map((membership) => ({
        restaurantId: membership.restaurant_id,
        role: membership.role,
        restaurant: {
          id: membership.restaurants?.id ?? membership.restaurant_id,
          name: membership.restaurants?.name ?? null,
          slug: membership.restaurants?.slug ?? null,
        },
      })),
    });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-team-memberships' },
    });
    return internalError(error, { route: ROUTE }, 'Unable to load memberships');
  }
}
