import { NextResponse } from 'next/server';

import { internalError } from '@/lib/api/errors';
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
    logger.error('[team/memberships] auth error', { route: ROUTE, error: authError.message });
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
