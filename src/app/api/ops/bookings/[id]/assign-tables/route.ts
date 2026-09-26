import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, forbidden, internalError, notFound, validationError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureRestaurantServerEvent, captureServerException } from '@/lib/posthog/server';
import {
  assignTablesDirectly,
  unassignTablesDirect,
  DirectAssignmentError,
} from '@/server/capacity/table-assignment/direct-assignment';
import {
  enqueueBookingUpdatedSideEffects,
  safeBookingPayload,
} from '@/server/jobs/booking-side-effects';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { NextRequest } from 'next/server';

const assignLogger = logger.child({ module: 'api.ops.bookings.assign_tables' });

/** Keys of DirectAssignmentError.details that are built by the app (never DB text). */
const SAFE_DETAIL_KEYS = [
  'checks',
  'conflicts',
  'missingTableIds',
  'requestedTableIds',
  'existingTableIds',
] as const;

const GENERIC_MESSAGE_BY_STATUS: Record<number, string> = {
  404: 'That booking or table no longer exists.',
  409: 'Those tables are no longer available for this booking.',
  422: 'Those tables cannot be assigned to this booking.',
};

/**
 * C1 body for a DirectAssignmentError. Errors wrapped from the atomic RPC carry Postgres
 * text in `message` and `details.details`/`details.hint`, so those get a generic message
 * and no details. App-built errors keep their message and whitelisted details.
 */
function directAssignmentErrorResponse(error: DirectAssignmentError) {
  const rawDetails = error.details ?? {};
  const fromDatabase = 'hint' in rawDetails || 'details' in rawDetails;
  const safeDetails: Record<string, unknown> = {};
  if (!fromDatabase) {
    for (const key of SAFE_DETAIL_KEYS) {
      if (key in rawDetails) safeDetails[key] = rawDetails[key];
    }
  }
  const message = fromDatabase
    ? (GENERIC_MESSAGE_BY_STATUS[error.status] ?? 'Those tables cannot be assigned.')
    : error.message;
  return apiError(error.status, error.code, message, {
    details: Object.keys(safeDetails).length > 0 ? safeDetails : undefined,
  });
}

const assignSchema = z.object({
  tableIds: z.array(z.string().uuid()).min(1, 'At least one table must be selected'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
  requireAdjacency: z.boolean().optional(),
});

const unassignSchema = z.object({
  tableIds: z.array(z.string().uuid()).min(1, 'At least one table must be selected'),
});

/**
 * POST /api/ops/bookings/{id}/assign-tables
 *
 * Atomically assign tables to a booking in a single operation.
 * This is a simplified alternative to the session-based manual assignment flow.
 *
 * Features:
 * - Single atomic operation (no holds, no sessions)
 * - Built-in idempotency
 * - Clear validation and error messages
 * - Fast and reliable
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCsrfProtectedMutation(req, () => postAssignTables(req, { params }));
}

async function postAssignTables(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  // === Authentication ===
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return apiError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  // === Parse Request Body ===
  const body = await req.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, 'Invalid request payload');
  }

  const { tableIds, idempotencyKey, requireAdjacency } = parsed.data;

  // === Authorization - Check restaurant access ===
  const bookingLookup = await supabase
    .from('bookings')
    .select('restaurant_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return internalError(bookingLookup.error, {
      route: 'ops.bookings.assign_tables',
      stage: 'load_booking',
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
    return internalError(membership.error, {
      route: 'ops.bookings.assign_tables',
      stage: 'membership',
      bookingId,
    });
  }

  if (!membership.data) {
    return forbidden('ACCESS_DENIED', 'Access denied');
  }

  captureRestaurantServerEvent('table_assignment_started', {
    restaurantId: bookingRow.restaurant_id,
    distinctId: user.id,
    props: { bookingId, source: 'ops', kind: 'v1' },
  });

  // === Execute Assignment ===
  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  const { data: previousBooking, error: previousError } = await serviceClient
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();

  if (previousError) {
    assignLogger.warn('assign_tables.previous_load_failed', { bookingId });
  }

  try {
    const result = await assignTablesDirectly({
      bookingId,
      tableIds,
      idempotencyKey,
      requireAdjacency,
      assignedBy: user.id,
      client: serviceClient,
    });

    if (previousBooking) {
      try {
        const { data: currentBooking, error: currentError } = await serviceClient
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .maybeSingle();

        if (currentError) {
          assignLogger.warn('assign_tables.current_load_failed', { bookingId });
        } else if (currentBooking) {
          const prevStatus = (previousBooking as { status?: string | null }).status ?? null;
          const currStatus = (currentBooking as { status?: string | null }).status ?? null;

          if (
            (prevStatus === 'pending' || prevStatus === 'pending_allocation') &&
            currStatus === 'confirmed'
          ) {
            await enqueueBookingUpdatedSideEffects(
              {
                previous: safeBookingPayload(previousBooking as BookingRecord),
                current: safeBookingPayload(currentBooking as BookingRecord),
                restaurantId: currentBooking.restaurant_id ?? bookingRow.restaurant_id,
              },
              { supabase: serviceClient },
            );
          }
        }
      } catch (jobError) {
        assignLogger.warn('assign_tables.side_effects_failed', {
          bookingId,
          errorName: jobError instanceof Error ? jobError.name : typeof jobError,
        });
      }
    }

    captureRestaurantServerEvent('table_assignment_completed', {
      restaurantId: bookingRow.restaurant_id,
      distinctId: user.id,
      props: { bookingId, source: 'ops', assignedCount: tableIds.length },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof DirectAssignmentError && error.status < 500) {
      assignLogger.info('assign_tables.rejected', {
        bookingId,
        errorKind: error.code,
        status: error.status,
      });
      captureRestaurantServerEvent('table_assignment_failed', {
        restaurantId: bookingRow.restaurant_id,
        distinctId: user.id,
        props: { bookingId, source: 'ops', code: error.code, reason: 'validation' },
      });
      return directAssignmentErrorResponse(error);
    }

    captureRestaurantServerEvent('table_assignment_failed', {
      restaurantId: bookingRow.restaurant_id,
      distinctId: user.id,
      props: { bookingId, source: 'ops', reason: 'unexpected' },
    });
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: bookingRow.restaurant_id },
      properties: { bookingId, source: 'ops', path: '/api/ops/bookings/[id]/assign-tables' },
    });

    return internalError(error, { route: 'ops.bookings.assign_tables', bookingId });
  }
}

/**
 * DELETE /api/ops/bookings/{id}/assign-tables
 *
 * Remove table assignments from a booking.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCsrfProtectedMutation(req, () => deleteAssignTables(req, { params }));
}

async function deleteAssignTables(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params;

  // === Authentication ===
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return apiError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  // === Parse Request Body ===
  const body = await req.json().catch(() => null);
  const parsed = unassignSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error, 'Invalid request payload');
  }

  const { tableIds } = parsed.data;

  // === Authorization - Check restaurant access ===
  const bookingLookup = await supabase
    .from('bookings')
    .select('restaurant_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingLookup.error) {
    return internalError(bookingLookup.error, {
      route: 'ops.bookings.assign_tables',
      stage: 'load_booking',
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
    return internalError(membership.error, {
      route: 'ops.bookings.assign_tables',
      stage: 'membership',
      bookingId,
    });
  }

  if (!membership.data) {
    return forbidden('ACCESS_DENIED', 'Access denied');
  }

  // === Execute Unassignment ===
  const serviceClient = getTenantServiceSupabaseClient(bookingRow.restaurant_id);

  try {
    const result = await unassignTablesDirect({
      bookingId,
      tableIds,
      client: serviceClient,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof DirectAssignmentError && error.status < 500) {
      return directAssignmentErrorResponse(error);
    }

    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: bookingRow.restaurant_id },
      properties: { bookingId, source: 'ops', path: '/api/ops/bookings/[id]/assign-tables' },
    });

    return internalError(error, { route: 'ops.bookings.unassign_tables', bookingId });
  }
}
