import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  forbidden,
  internalError,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getTableAvailabilityTimeline } from '@/server/ops/table-timeline';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  zoneId: z.string().uuid().optional(),
  service: z.enum(['lunch', 'dinner', 'all']).optional(),
  includeSummary: z.enum(['0', '1', 'true', 'false']).optional(),
});

const ROUTE = 'ops/tables/timeline';

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const query = parsed.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    logger.warn('ops.tables_timeline.auth_failed', { route: ROUTE, status: mapped.status });
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    // MembershipAccessError carries this code when the membership lookup itself failed.
    if (
      typeof membershipError === 'object' &&
      membershipError !== null &&
      (membershipError as { code?: unknown }).code === 'MEMBERSHIP_VALIDATION_UNAVAILABLE'
    ) {
      return apiError(
        503,
        'MEMBERSHIP_VALIDATION_UNAVAILABLE',
        'We couldn’t check your access just now. Try again.',
        { retryable: true },
      );
    }
    return forbidden();
  }

  try {
    const timeline = await getTableAvailabilityTimeline({
      restaurantId: query.restaurantId,
      date: query.date,
      zoneId: query.zoneId,
      service: query.service,
      includeSummary: query.includeSummary
        ? query.includeSummary !== '0' && query.includeSummary !== 'false'
        : true,
      client: supabase,
    });

    return NextResponse.json(timeline);
  } catch (timelineError) {
    captureServerException(timelineError, {
      distinctId: user.id,
      groups: { restaurant: query.restaurantId },
      properties: { restaurantId: query.restaurantId, source: 'ops', kind: 'ops-tables-timeline' },
    });
    return internalError(timelineError, {
      route: ROUTE,
      method: 'GET',
      restaurantId: query.restaurantId,
    });
  }
}
