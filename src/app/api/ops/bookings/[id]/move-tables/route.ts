import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  conflict,
  internalError,
  notFound,
  validationError,
  type ApiErrorBody,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureRestaurantServerEvent, captureServerException } from '@/lib/posthog/server';
import { withBookingAuthorization } from '@/server/auth/guards';
import {
  moveBookingTables,
  MoveBookingTablesError,
  type MoveBookingTablesFailure,
} from '@/server/ops/booking-table-move';
import { invalidateOpsDashboardCaches } from '@/server/ops/bookings';
import { getTenantServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

/**
 * POST /api/ops/bookings/{id}/move-tables
 *
 * Atomically moves a booking from `fromTableIds` to `toTableIds` in one DB transaction
 * (`move_booking_tables`). The booking status never changes and no guest notification is
 * sent. Success mirrors POST /assign-tables. Contract: mw/handoffs/S3a-contract.md section 4.
 */

const moveLogger = logger.child({ module: 'api.ops.bookings.move_tables' });

const tableIdsSchema = z
  .array(z.string().uuid('Each table id must be a UUID'))
  .min(1, 'Select at least one table')
  .max(20, 'Select at most 20 tables')
  .refine((ids) => new Set(ids).size === ids.length, 'Table ids must be unique');

const moveSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  fromTableIds: tableIdsSchema,
  toTableIds: tableIdsSchema,
  idempotencyKey: z.string().trim().min(1, 'Idempotency key is required').max(200),
  // Accepted for forward compatibility; staleness is detected by the fromTableIds check.
  contextVersion: z.string().max(200).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

const STATE_CONFLICT_MESSAGE = 'This booking changed. Refresh to see its current tables.';

/** Re-shapes a guard failure (`{ error, code }`) into the C1 body, keeping its status. */
async function toC1GuardResponse(response: NextResponse): Promise<NextResponse> {
  if (response.headers.has('set-cookie')) return response;
  try {
    const body = (await response.clone().json()) as { error?: unknown; code?: unknown };
    if (typeof body.error !== 'string') return response;
    const code = typeof body.code === 'string' ? body.code : `HTTP_${response.status}`;
    return apiError(response.status, code, body.error);
  } catch {
    return response;
  }
}

function failureResponse(failure: MoveBookingTablesFailure): NextResponse<ApiErrorBody> {
  switch (failure.kind) {
    case 'BOOKING_NOT_FOUND':
      return notFound('BOOKING_NOT_FOUND', 'Booking not found');
    case 'INVALID_REQUEST':
      return apiError(400, 'VALIDATION_FAILED', 'Choose the tables to move from and to.');
    case 'IDEMPOTENCY_KEY_REUSED':
      return conflict(
        'IDEMPOTENCY_KEY_REUSED',
        'This request key was already used for a different move.',
      );
    case 'BOOKING_STATE_CONFLICT':
      return conflict('BOOKING_STATE_CONFLICT', STATE_CONFLICT_MESSAGE, {
        retryable: false,
        details: { currentStatus: failure.currentStatus, reason: failure.reason },
      });
    case 'TABLES_UNAVAILABLE':
      return conflict('TABLES_UNAVAILABLE', 'Those tables are no longer free for this booking.', {
        retryable: false,
        details: { reason: failure.reason, tableIds: failure.tableIds },
      });
    case 'TABLE_SELECTION_INVALID':
      return apiError(422, 'TABLE_SELECTION_INVALID', 'Those tables cannot seat this booking.', {
        details: { reason: failure.reason },
      });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: bookingId } = await params;

  // Session, CSRF (unsafe method) and booking-derived restaurant membership.
  const auth = await withBookingAuthorization(req, bookingId, { action: 'move-tables' });
  if (!auth.ok) {
    return toC1GuardResponse(auth.response);
  }

  const rawBody: unknown = await req.json().catch(() => undefined);
  if (rawBody === undefined) {
    return apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
  const parsed = moveSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { restaurantId } = auth;
  if (parsed.data.restaurantId && parsed.data.restaurantId !== restaurantId) {
    // Same answer as an unknown booking: no cross-tenant existence oracle.
    return notFound('BOOKING_NOT_FOUND', 'Booking not found');
  }

  const client = getTenantServiceSupabaseClient(restaurantId);

  try {
    const outcome = await moveBookingTables({
      client,
      bookingId,
      restaurantId,
      fromTableIds: parsed.data.fromTableIds,
      toTableIds: parsed.data.toTableIds,
      idempotencyKey: parsed.data.idempotencyKey,
      movedBy: auth.user.id,
    });

    if (!outcome.replayed) {
      invalidateOpsDashboardCaches(restaurantId, { summaryDates: [outcome.bookingDate] });
      captureRestaurantServerEvent('table_assignment_completed', {
        restaurantId,
        distinctId: auth.user.id,
        props: {
          bookingId,
          source: 'ops',
          kind: 'move',
          assignedCount: outcome.body.summary.tableCount,
        },
      });
    }

    return NextResponse.json(outcome.body, { status: 200 });
  } catch (error) {
    if (error instanceof MoveBookingTablesError) {
      moveLogger.info('move_tables.rejected', { bookingId, errorKind: error.failure.kind });
      return failureResponse(error.failure);
    }

    captureServerException(error, {
      distinctId: auth.user.id,
      groups: { restaurant: restaurantId },
      properties: { bookingId, source: 'ops', path: '/api/ops/bookings/[id]/move-tables' },
    });
    return internalError(error, { route: 'ops.bookings.move_tables', bookingId });
  }
}
