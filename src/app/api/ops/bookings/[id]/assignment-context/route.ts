import { withBookingAuthorization } from '@/server/auth/guards';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import { createOpsBookingApiTiming } from '../../_shared/performance';
import { loadAssignmentContextPayload } from '../_shared/dialogLoaders';

import type { NextRequest } from 'next/server';

/**
 * GET /api/ops/bookings/{id}/assignment-context
 *
 * Provides the data the direct table-assignment UI needs to render the
 * floor plan for a booking. The payload shape is the single source of truth
 * lived in `_shared/dialogLoaders.ts`.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const timing = createOpsBookingApiTiming('ops.bookings.assignment_context');
  const params = await props.params;
  const bookingId = params.id;
  const authorization = await timing.measure(
    'auth',
    withBookingAuthorization(req, bookingId, {
      action: 'assignment-context:read',
    }),
  );
  if (!authorization.ok) return timing.withHeaders(authorization.response);

  const serviceSupabase = getServiceSupabaseClient();
  const restaurantId = authorization.restaurantId;
  const restaurantClient = getTenantServiceSupabaseClient(restaurantId);

  const [rateLimit, contextResult] = await Promise.all([
    timing.measure(
      'rate_limit',
      requireApiRateLimit({
        request: req,
        scope: 'ops-bookings:assignment-context',
        tenantId: restaurantId,
        userId: authorization.user.id,
        limit: 45,
        windowMs: 60_000,
      }),
    ),
    timing.measure(
      'assignment_context',
      loadAssignmentContextPayload({ serviceSupabase, restaurantClient, bookingId, restaurantId }),
    ),
  ]);

  if (rateLimit) return timing.withHeaders(rateLimit);

  if (!contextResult.ok) {
    return timing.json(
      { error: contextResult.error, ...(contextResult.code ? { code: contextResult.code } : {}) },
      { status: contextResult.status },
    );
  }

  return timing.json(
    contextResult.payload,
    {
      status: 200,
      // Personalized data: keep CDN out, but allow back/forward cache and
      // browser-side SWR semantics. Realtime invalidation refreshes data
      // proactively so a small stale-while-revalidate window is safe.
      headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
    },
    {
      restaurant_id: restaurantId,
      table_count: contextResult.payload.tables.length,
      conflict_count: contextResult.payload.conflicts.length,
    },
  );
}
