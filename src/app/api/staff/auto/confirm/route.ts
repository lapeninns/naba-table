import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapAssignTablesErrorToHttp } from '@/app/api/staff/_utils/assign-tables-error';
import { apiError, internalError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { confirmHold } from '@/server/capacity/engine';
import { AssignTablesRpcError, HoldNotFoundError } from '@/server/capacity/holds';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const confirmPayloadSchema = z.object({
  holdId: z.string().uuid(),
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  requireAdjacency: z.boolean().optional(),
});

const ROUTE = '/api/staff/auto/confirm';

/**
 * AssignTablesRpcError messages, details and hints can carry repository or
 * Postgres text, so only the status and code from the shared mapper reach the
 * client, with fixed copy per status class.
 */
function assignTablesErrorResponse(error: AssignTablesRpcError, ctx: Record<string, unknown>) {
  const { status, payload } = mapAssignTablesErrorToHttp(error);
  if (status >= 500) {
    logger.error('staff.auto_confirm.assign_failed', {
      route: ROUTE,
      ...ctx,
      status,
      errorKind: payload.code,
      error,
    });
    return apiError(status, payload.code, 'Unable to confirm hold. Try again.', {
      retryable: status === 503,
    });
  }
  const message =
    status === 422
      ? 'This hold can no longer be confirmed. Re-quote the booking and try again.'
      : 'This hold conflicts with another assignment. Re-quote the booking and try again.';
  return apiError(status, payload.code, message);
}

export async function POST(req: NextRequest) {
  return withCsrfProtectedMutation(req, () => postStaffAutoConfirm(req));
}

async function postStaffAutoConfirm(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { holdId, bookingId, idempotencyKey, requireAdjacency } = parsed.data;

  const holdLookup = await supabase
    .from('table_holds')
    .select('id, restaurant_id')
    .eq('id', holdId)
    .maybeSingle();

  if (holdLookup.error) {
    return internalError(
      holdLookup.error,
      { route: ROUTE, stage: 'hold_lookup', errorKind: holdLookup.error.code },
      'Unable to confirm hold',
    );
  }

  const holdRow = holdLookup.data;
  if (!holdRow || !holdRow.restaurant_id) {
    return NextResponse.json({ error: 'Hold not found' }, { status: 404 });
  }

  const membership = await supabase
    .from('restaurant_memberships')
    .select('role')
    .eq('restaurant_id', holdRow.restaurant_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership.error) {
    return internalError(
      membership.error,
      { route: ROUTE, stage: 'membership_lookup', errorKind: membership.error.code },
      'Unable to confirm hold',
    );
  }

  if (!membership.data) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const bookingLookup = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('restaurant_id', holdRow.restaurant_id)
    .maybeSingle();

  if (bookingLookup.error) {
    return internalError(
      bookingLookup.error,
      { route: ROUTE, stage: 'booking_lookup', holdId, bookingId },
      'Unable to confirm hold',
    );
  }

  if (!bookingLookup.data) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const serviceClient = getTenantServiceSupabaseClient(holdRow.restaurant_id);

  try {
    const assignments = await confirmHold({
      holdId,
      bookingId,
      idempotencyKey,
      requireAdjacency,
      assignedBy: user.id,
      client: serviceClient,
    });

    return NextResponse.json({ holdId, bookingId, assignments });
  } catch (error) {
    if (error instanceof HoldNotFoundError) {
      return NextResponse.json({ error: 'Hold not found' }, { status: 404 });
    }

    if (error instanceof AssignTablesRpcError) {
      if ((error.code ?? '').toUpperCase() === 'HOLD_RESTAURANT_MISMATCH') {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      return assignTablesErrorResponse(error, {
        holdId,
        bookingId,
        restaurantId: holdRow.restaurant_id,
      });
    }

    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: holdRow.restaurant_id },
      properties: {
        bookingId,
        restaurantId: holdRow.restaurant_id,
        source: 'ops',
        kind: 'staff-auto-confirm',
      },
    });
    return internalError(
      error,
      { route: ROUTE, holdId, bookingId, restaurantId: holdRow.restaurant_id },
      'Unable to confirm hold',
    );
  }
}
