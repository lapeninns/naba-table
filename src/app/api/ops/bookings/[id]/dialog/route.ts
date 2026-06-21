/**
 * GET /api/ops/bookings/{id}/dialog
 *
 * Consolidated read endpoint that returns both the booking detail payload and
 * the assignment-context payload in a single round-trip. Powers the ops
 * booking dialog so its open path goes from N requests to 1.
 *
 * Auth: `withBookingAuthorization` (session + tenant membership). Safe-method
 * fast path consumes the trusted `x-ops-user-id` header forwarded by the
 * proxy middleware.
 */

import { withBookingAuthorization } from '@/server/auth/guards';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import { createOpsBookingApiTiming } from '../../_shared/performance';
import { loadAssignmentContextPayload, loadBookingDetailPayload } from '../_shared/dialogLoaders';

import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const timing = createOpsBookingApiTiming('ops.bookings.dialog');
  const { id: bookingId } = await props.params;

  const authorization = await timing.measure(
    'auth',
    withBookingAuthorization(req, bookingId, {
      action: 'dialog:read',
    }),
  );
  if (!authorization.ok) return timing.withHeaders(authorization.response);

  const restaurantId = authorization.restaurantId;
  const rateLimit = await timing.measure(
    'rate_limit',
    requireApiRateLimit({
      request: req,
      scope: 'ops-bookings:dialog',
      tenantId: restaurantId,
      userId: authorization.user.id,
      limit: 60,
      windowMs: 60_000,
    }),
  );

  if (rateLimit) return timing.withHeaders(rateLimit);

  const serviceSupabase = getServiceSupabaseClient();
  const restaurantClient = getTenantServiceSupabaseClient(restaurantId);
  const [detailResult, contextResult] = await Promise.all([
    timing.measure(
      'booking_detail',
      loadBookingDetailPayload({ serviceSupabase, bookingId, restaurantIdFilter: restaurantId }),
    ),
    timing.measure(
      'assignment_context',
      loadAssignmentContextPayload({
        serviceSupabase,
        restaurantClient,
        bookingId,
        restaurantId,
      }),
    ),
  ]);

  if (!detailResult.ok) {
    return timing.json(
      { error: detailResult.error, ...(detailResult.code ? { code: detailResult.code } : {}) },
      { status: detailResult.status },
    );
  }

  if (!contextResult.ok) {
    return timing.json(
      { error: contextResult.error, ...(contextResult.code ? { code: contextResult.code } : {}) },
      { status: contextResult.status },
    );
  }

  return timing.json(
    {
      booking: detailResult.payload,
      assignmentContext: contextResult.payload,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
    },
    {
      restaurant_id: restaurantId,
      table_count: contextResult.payload.tables.length,
      conflict_count: contextResult.payload.conflicts.length,
    },
  );
}
