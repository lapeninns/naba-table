import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  conflict,
  forbidden,
  internalError,
  notFound,
  unauthenticated,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import {
  assignTableToBooking,
  evaluateManualSelection,
  getBookingTableAssignments,
} from '@/server/capacity';
import { AssignTablesRpcError } from '@/server/capacity/holds';
import { invalidateOpsDashboardCaches } from '@/server/ops/bookings';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const assignTableSchema = z.object({
  tableId: z.string().uuid(),
});

const tablesLogger = logger.child({ module: 'api.ops.bookings.tables' });

/**
 * Maps an assignment failure to C1 without forwarding Postgres message/details/hint.
 * AssignTablesRpcError codes come from the allocator (ASSIGNMENT_CONFLICT,
 * ASSIGNMENT_VALIDATION, ASSIGNMENT_REPOSITORY_ERROR, ...) or raw SQLSTATEs.
 */
function assignmentFailureResponse(
  error: unknown,
  ctx: { bookingId: string; restaurantId: string; userId: string },
) {
  if (error instanceof AssignTablesRpcError) {
    const code = (error.code ?? '').toUpperCase();
    if (code === 'ASSIGNMENT_VALIDATION') {
      return apiError(
        422,
        'ASSIGNMENT_VALIDATION',
        'Those tables cannot be assigned to this booking.',
      );
    }
    if (code === 'ASSIGNMENT_REPOSITORY_ERROR') {
      return apiError(
        503,
        'ASSIGNMENT_UNAVAILABLE',
        'Table assignment is temporarily unavailable. Try again.',
        {
          retryable: true,
        },
      );
    }
    if (code.includes('NOT_FOUND') || code === 'P0002') {
      return notFound('TABLE_NOT_FOUND', 'That table or booking no longer exists.');
    }
    tablesLogger.info('assign_table.conflict', { bookingId: ctx.bookingId, errorKind: code });
    return conflict('ASSIGNMENT_CONFLICT', 'That table is no longer available for this booking.');
  }

  captureServerException(error, {
    distinctId: ctx.userId,
    groups: { restaurant: ctx.restaurantId },
    properties: { bookingId: ctx.bookingId, source: 'ops', kind: 'ops-booking-tables' },
  });
  return internalError(error, { route: 'ops.bookings.tables.post', bookingId: ctx.bookingId });
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(request, () => postBookingTable(request, context));
}

async function postBookingTable(request: NextRequest, context: RouteContext) {
  const { id: bookingId } = await context.params;

  if (!bookingId || !z.string().uuid().safeParse(bookingId).success) {
    return apiError(400, 'INVALID_BOOKING_ID', 'Invalid booking id');
  }

  const body = await request.json().catch(() => null);
  const parsedBody = assignTableSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError(400, 'VALIDATION_FAILED', 'Invalid request body', {
      fields: { tableId: ['Choose a table.'] },
    });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated('Authentication required');
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, restaurant_id, booking_date')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    return internalError(bookingError, {
      route: 'ops.bookings.tables.post',
      stage: 'load_booking',
    });
  }

  if (!booking) {
    return notFound('BOOKING_NOT_FOUND', 'Booking not found');
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: booking.restaurant_id });
  } catch {
    return forbidden('FORBIDDEN', 'Forbidden');
  }

  const serviceClient = getServiceSupabaseClient();
  const idempotencyKey = request.headers.get('Idempotency-Key');

  try {
    // Strict pre-check: reject direct assignment if any conflicting hold exists
    // Reuse manual selection evaluation to leverage shared conflict detection.
    const validation = await evaluateManualSelection({
      bookingId,
      tableIds: [parsedBody.data.tableId],
      requireAdjacency: false,
      skipSoftHolds: true,
      client: serviceClient,
    });

    const holdsCheck = validation.checks.find((c) => c.id === 'holds');
    const holdConflicts = (holdsCheck?.details as { holds?: unknown[] } | undefined)?.holds;
    if (
      holdsCheck?.status === 'error' &&
      Array.isArray(holdConflicts) &&
      holdConflicts.length > 0
    ) {
      const blockingHoldIds = holdConflicts
        .map((h) => (h && typeof h === 'object' ? (h as { holdId?: string }).holdId : null))
        .filter((v): v is string => Boolean(v));

      return conflict('HOLD_CONFLICT', 'Existing holds conflict with requested tables', {
        details: {
          tables: [parsedBody.data.tableId],
          blockingHoldIds,
        },
      });
    }

    const failedChecks = validation.checks.filter((check) => check.status === 'error');
    if (!validation.ok || failedChecks.length > 0) {
      return apiError(422, 'ASSIGNMENT_VALIDATION', 'Selected tables cannot be assigned', {
        details: {
          summary: validation.summary,
          checks: failedChecks.length > 0 ? failedChecks : validation.checks,
        },
      });
    }

    await assignTableToBooking(bookingId, parsedBody.data.tableId, user.id, serviceClient, {
      idempotencyKey: idempotencyKey?.trim() || null,
    });
  } catch (error) {
    return assignmentFailureResponse(error, {
      bookingId,
      restaurantId: booking.restaurant_id,
      userId: user.id,
    });
  }

  try {
    const tableAssignments = await getBookingTableAssignments(bookingId, serviceClient);
    invalidateOpsDashboardCaches(booking.restaurant_id, {
      summaryDates: [booking.booking_date],
    });
    return NextResponse.json({ tableAssignments });
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: booking.restaurant_id },
      properties: {
        bookingId,
        restaurantId: booking.restaurant_id,
        source: 'ops',
        kind: 'ops-booking-tables',
      },
    });
    return internalError(error, { route: 'ops.bookings.tables.post', stage: 'reload', bookingId });
  }
}
