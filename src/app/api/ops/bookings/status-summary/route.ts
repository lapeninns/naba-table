import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  forbidden,
  internalError,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { daysBetweenInclusive, firstString, safeDate, stringArray } from '@/lib/api/query-params';
import { logger, sanitizeLogText } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getBookingStatusSummary } from '@/server/ops/booking-lifecycle/summary';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import type { BookingStatus } from '@/server/ops/booking-lifecycle/stateMachine';

const ROUTE = '/api/ops/bookings/status-summary';

const bookingStatusSchema = z.enum([
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
  'PRIORITY_WAITLIST',
]);

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be ISO-8601 date (YYYY-MM-DD)'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be ISO-8601 date (YYYY-MM-DD)'),
  statuses: z.array(bookingStatusSchema).max(8).optional(),
});

type QueryParams = z.infer<typeof querySchema>;
const STATUS_SUMMARY_MAX_WINDOW_DAYS = 93;

function parseQuery(request: NextRequest): QueryParams {
  const searchParams = request.nextUrl.searchParams;
  return querySchema.parse({
    restaurantId: firstString(searchParams, 'restaurantId'),
    from: safeDate(searchParams, 'from'),
    to: safeDate(searchParams, 'to'),
    statuses: stringArray(searchParams, 'statuses'),
  });
}

export async function GET(request: NextRequest) {
  let params: QueryParams;
  try {
    params = parseQuery(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationError(error, 'Invalid query parameters');
    }
    return apiError(400, 'VALIDATION_FAILED', 'Invalid query parameters');
  }

  const windowDays = daysBetweenInclusive(params.from, params.to);
  if (
    !Number.isFinite(windowDays) ||
    windowDays < 1 ||
    windowDays > STATUS_SUMMARY_MAX_WINDOW_DAYS
  ) {
    return apiError(
      400,
      'VALIDATION_FAILED',
      `Status summary range must be between 1 and ${STATUS_SUMMARY_MAX_WINDOW_DAYS} days`,
    );
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    logger.error('[ops][booking-status-summary] auth lookup failed', {
      route: ROUTE,
      errorMessage: sanitizeLogText(authError.message),
    });
    const mapped = mapSupabaseAuthError(authError);
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated('Authentication required');
  }

  try {
    const memberships = await fetchUserMemberships(user.id, supabase);
    const hasAccess = memberships.some(
      (membership) => membership.restaurant_id === params.restaurantId,
    );
    if (!hasAccess) {
      return forbidden();
    }
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-booking-status-summary' },
    });
    return internalError(error, { route: ROUTE }, 'Unable to verify permissions');
  }

  const rateLimit = await requireApiRateLimit({
    request,
    scope: 'ops-bookings:status-summary',
    tenantId: params.restaurantId,
    userId: user.id,
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const summaryRows = await getBookingStatusSummary({
      restaurantId: params.restaurantId,
      startDate: params.from,
      endDate: params.to,
      statuses:
        params.statuses && params.statuses.length > 0 ? (params.statuses as BookingStatus[]) : null,
    });

    const totals: Record<BookingStatus, number> = {
      pending: 0,
      pending_allocation: 0,
      confirmed: 0,
      checked_in: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      PRIORITY_WAITLIST: 0,
    };

    for (const row of summaryRows) {
      totals[row.status] = Number(row.total);
    }

    return NextResponse.json({
      restaurantId: params.restaurantId,
      range: {
        from: params.from,
        to: params.to,
      },
      filter: {
        statuses:
          params.statuses && params.statuses.length > 0
            ? (params.statuses as BookingStatus[])
            : null,
      },
      totals,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: params.restaurantId },
      properties: {
        restaurantId: params.restaurantId,
        source: 'ops',
        kind: 'ops-booking-status-summary',
      },
    });
    return internalError(error, { route: ROUTE }, 'Unable to compute booking status summary');
  }
}
