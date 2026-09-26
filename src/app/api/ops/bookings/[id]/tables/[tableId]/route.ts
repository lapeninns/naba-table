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
import { getBookingTableAssignments, unassignTableFromBooking } from '@/server/capacity';
import { AssignTablesRpcError } from '@/server/capacity/holds';
import { invalidateOpsDashboardCaches } from '@/server/ops/bookings';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const idsSchema = z.object({
  bookingId: z.string().uuid(),
  tableId: z.string().uuid(),
});

const unassignLogger = logger.child({ module: 'api.ops.bookings.tables.unassign' });

type RouteContext = {
  params: Promise<{ id: string; tableId: string }>;
};

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(request, () => deleteBookingTableAssignment(request, context));
}

async function deleteBookingTableAssignment(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const rawBookingId = normalizeParam(params.id);
  const rawTableId = normalizeParam(params.tableId);

  const parsedParams = idsSchema.safeParse({ bookingId: rawBookingId, tableId: rawTableId });
  if (!parsedParams.success) {
    return apiError(400, 'INVALID_IDENTIFIERS', 'Invalid identifiers');
  }

  const { bookingId, tableId } = parsedParams.data;

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
      route: 'ops.bookings.tables.delete',
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

  try {
    await unassignTableFromBooking(bookingId, tableId, serviceClient);
  } catch (error) {
    if (!(error instanceof AssignTablesRpcError)) {
      return internalError(error, { route: 'ops.bookings.tables.delete', bookingId });
    }
    if (error.code === 'P0002') {
      return notFound('BOOKING_NOT_FOUND', 'Booking not found');
    }
    unassignLogger.info('unassign_table.conflict', { bookingId, errorKind: error.code ?? null });
    return conflict('ASSIGNMENT_CONFLICT', 'That table could not be removed from this booking.');
  }

  // Check remaining table assignments
  let tableAssignments;
  try {
    tableAssignments = await getBookingTableAssignments(bookingId, serviceClient);
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: booking.restaurant_id },
      properties: {
        bookingId,
        restaurantId: booking.restaurant_id,
        source: 'ops',
        kind: 'ops-booking-table',
      },
    });
    return internalError(error, {
      route: 'ops.bookings.tables.delete',
      stage: 'reload',
      bookingId,
    });
  }

  invalidateOpsDashboardCaches(booking.restaurant_id, {
    summaryDates: [booking.booking_date],
  });

  return NextResponse.json({ tableAssignments });
}
