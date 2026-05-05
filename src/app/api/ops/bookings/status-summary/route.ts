import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { daysBetweenInclusive, firstString, safeDate, stringArray } from '@/lib/api/query-params';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getBookingStatusSummary } from '@/server/ops/booking-lifecycle/summary';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import type { BookingStatus } from '@/server/ops/booking-lifecycle/stateMachine';

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
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const windowDays = daysBetweenInclusive(params.from, params.to);
  if (
    !Number.isFinite(windowDays) ||
    windowDays < 1 ||
    windowDays > STATUS_SUMMARY_MAX_WINDOW_DAYS
  ) {
    return NextResponse.json(
      {
        error: `Status summary range must be between 1 and ${STATUS_SUMMARY_MAX_WINDOW_DAYS} days`,
      },
      { status: 400 },
    );
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops][booking-status-summary] auth lookup failed', authError.message);
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
    const memberships = await fetchUserMemberships(user.id, supabase);
    const hasAccess = memberships.some(
      (membership) => membership.restaurant_id === params.restaurantId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (error) {
    console.error('[ops][booking-status-summary] membership lookup failed', error);
    return NextResponse.json({ error: 'Unable to verify permissions' }, { status: 500 });
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
    console.error('[ops][booking-status-summary] failed to compute summary', error);
    return NextResponse.json(
      { error: 'Unable to compute booking status summary' },
      { status: 500 },
    );
  }
}
