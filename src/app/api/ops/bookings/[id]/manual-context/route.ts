import { NextResponse } from 'next/server';

import { apiError, internalError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { getManualAssignmentContext } from '@/server/capacity/table-assignment/manual';
import { ManualSelectionInputError } from '@/server/capacity/table-assignment/types';
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

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
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // === Authorization - Check restaurant access ===
  const bookingLookup = await supabase
    .from('bookings')
    .select('restaurant_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return NextResponse.json(
      { error: 'Failed to load booking', code: 'BOOKING_LOOKUP_FAILED' },
      { status: 500 },
    );
  }

  const bookingRow = bookingLookup.data;
  if (!bookingRow?.restaurant_id) {
    return NextResponse.json(
      { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
      { status: 404 },
    );
  }

  const membership = await supabase
    .from('restaurant_memberships')
    .select('role')
    .eq('restaurant_id', bookingRow.restaurant_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership.error) {
    return NextResponse.json(
      { error: 'Failed to verify access', code: 'ACCESS_LOOKUP_FAILED' },
      { status: 500 },
    );
  }

  if (!membership.data) {
    return NextResponse.json({ error: 'Access denied', code: 'ACCESS_DENIED' }, { status: 403 });
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
    return internalError(error, { route: 'ops.bookings.manual_context', bookingId });
  }
}
