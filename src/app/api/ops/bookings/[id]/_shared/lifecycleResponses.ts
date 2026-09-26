import { apiError, conflict, internalError, type ApiErrorBody } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { BookingLifecycleError } from '@/server/ops/booking-lifecycle/stateMachine';

import type { BookingStatus } from '@/server/ops/booking-lifecycle/rpcErrors';
import type { NextResponse } from 'next/server';

/**
 * C1 responses shared by the ops lifecycle routes (check-in, check-out, no-show,
 * undo-no-show). Contract: mw/handoffs/S3a-contract.md section 1.
 */

export const BOOKING_STATE_CONFLICT_MESSAGE =
  'This booking changed status. Refresh to see its current state.';

export type LifecycleBookingSnapshot = {
  id: string;
  restaurantId: string;
  status: BookingStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  updatedAt: string | null;
};

export type LifecycleAssignmentRow = {
  id: string;
  booking_id: string;
  table_id: string;
  assigned_at: string;
  assigned_by: string | null;
};

export type LifecycleSuccessBody = {
  status: BookingStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  changed: boolean;
  booking: LifecycleBookingSnapshot;
  assignments?: LifecycleAssignmentRow[];
  tablesRestored?: boolean;
  tableRestoration?: {
    status: 'restored' | 'not_needed' | 'unavailable' | 'unknown';
    tableIds: string[];
  };
};

export function bookingStateConflict(
  currentStatus: BookingStatus | null,
  extra: Record<string, unknown> = {},
): NextResponse<ApiErrorBody> {
  return conflict('BOOKING_STATE_CONFLICT', BOOKING_STATE_CONFLICT_MESSAGE, {
    retryable: false,
    details: { currentStatus, ...extra },
  });
}

export function missingBookingIdResponse(): NextResponse<ApiErrorBody> {
  return apiError(400, 'INVALID_BOOKING_ID', 'Booking id is missing.');
}

/**
 * Maps a `prepare*Transition` failure. Known lifecycle rules become 400/409 C1 errors;
 * anything else is logged and reported as a generic 500.
 */
export function lifecycleValidationErrorResponse(
  error: unknown,
  ctx: {
    route: string;
    bookingId: string;
    restaurantId: string;
    userId: string;
    currentStatus: BookingStatus;
  },
): NextResponse<ApiErrorBody> {
  if (error instanceof BookingLifecycleError) {
    switch (error.code) {
      case 'TIMESTAMP_INVALID':
        return apiError(400, 'INVALID_TIMESTAMP', 'That time is not valid for this booking.');
      case 'MISSING_HISTORY':
        return apiError(
          400,
          'NO_SHOW_HISTORY_MISSING',
          'There is no no-show to undo for this booking.',
        );
      default:
        return bookingStateConflict(ctx.currentStatus);
    }
  }

  captureServerException(error, {
    distinctId: ctx.userId,
    groups: { restaurant: ctx.restaurantId },
    properties: { bookingId: ctx.bookingId, source: 'ops', kind: ctx.route },
  });
  return internalError(error, { route: ctx.route, bookingId: ctx.bookingId });
}

export function buildLifecycleSuccessBody(input: {
  booking: { id: string; restaurant_id: string };
  result: {
    status: BookingStatus;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    updatedAt: string | null;
    changed: boolean;
  };
  assignments?: LifecycleAssignmentRow[];
  tableRestoration?: LifecycleSuccessBody['tableRestoration'];
}): LifecycleSuccessBody {
  const { booking, result, assignments, tableRestoration } = input;
  const body: LifecycleSuccessBody = {
    status: result.status,
    checkedInAt: result.checkedInAt,
    checkedOutAt: result.checkedOutAt,
    changed: result.changed,
    booking: {
      id: booking.id,
      restaurantId: booking.restaurant_id,
      status: result.status,
      checkedInAt: result.checkedInAt,
      checkedOutAt: result.checkedOutAt,
      updatedAt: result.updatedAt,
    },
  };
  if (assignments !== undefined) body.assignments = assignments;
  if (tableRestoration !== undefined) {
    body.tableRestoration = tableRestoration;
    body.tablesRestored =
      tableRestoration.status === 'restored' || tableRestoration.status === 'not_needed';
  }
  return body;
}
