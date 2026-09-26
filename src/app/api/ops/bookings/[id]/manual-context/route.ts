import { NextResponse } from 'next/server';

import { apiError, forbidden, internalError, notFound, unauthenticated } from '@/lib/api/errors';
import { logger, sanitizeLogText } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { getManualAssignmentContext } from '@/server/capacity/table-assignment/manual';
import { ManualSelectionInputError } from '@/server/capacity/table-assignment/types';
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/bookings/[id]/manual-context';

/**
 * A failed Supabase lookup keeps its stable 500 code; only the PostgREST code
 * and sanitized message reach the log, never the response.
 */
function lookupFailed(
  error: { code?: string; message?: string },
  code: 'BOOKING_LOOKUP_FAILED' | 'ACCESS_LOOKUP_FAILED',
  message: string,
  ctx: Record<string, unknown>,
) {
  logger.error('ops.bookings.manual_context.lookup_failed', {
    route: ROUTE,
    ...ctx,
    errorKind: error.code,
    errorMessage: typeof error.message === 'string' ? sanitizeLogText(error.message) : undefined,
  });
  return apiError(500, code, message);
}

/**
 * GET /api/ops/bookings/{id}/manual-context
 *
 * Get the manual assignment context for a booking.
 * Returns tables, holds, conflicts, and booking assignments for manual table assignment.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  // === Authentication ===
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthenticated('Authentication required');
  }

  // === Authorization - Check restaurant access ===
  const bookingLookup = await supabase
    .from('bookings')
    .select('restaurant_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return lookupFailed(bookingLookup.error, 'BOOKING_LOOKUP_FAILED', 'Failed to load booking', {
      stage: 'booking_lookup',
      bookingId,
    });
  }

  const bookingRow = bookingLookup.data;
  if (!bookingRow?.restaurant_id) {
    return notFound('BOOKING_NOT_FOUND', 'Booking not found');
  }

  const membership = await supabase
    .from('restaurant_memberships')
    .select('role')
    .eq('restaurant_id', bookingRow.restaurant_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership.error) {
    return lookupFailed(membership.error, 'ACCESS_LOOKUP_FAILED', 'Failed to verify access', {
      stage: 'membership_lookup',
      bookingId,
    });
  }

  if (!membership.data) {
    return forbidden('ACCESS_DENIED', 'Access denied');
  }

  // === Get Manual Assignment Context ===
  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  try {
    const context = await getManualAssignmentContext({
      bookingId,
      client: serviceClient,
    });

    return NextResponse.json(context, { status: 200 });
  } catch (error) {
    // 4xx ManualSelectionInputErrors carry app-built messages; 5xx ones wrap DB text.
    if (error instanceof ManualSelectionInputError && error.status < 500) {
      return apiError(error.status, error.code, error.message);
    }

    captureServerException(error, {
      distinctId: user.id,
      properties: { bookingId, source: 'ops', kind: 'ops-booking-manual-context' },
    });

    // No raw error text to the client (C1); internalError logs it sanitized.
    return internalError(error, { route: ROUTE, bookingId });
  }
}
