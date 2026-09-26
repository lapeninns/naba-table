import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, internalError, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { getTodayBookingChanges } from '@/server/ops/bookings';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  buildDashboardAccessErrorResponse,
  requireDashboardAccess,
} from '@/src/app/api/ops/dashboard/_shared';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/dashboard/changes';

const changesQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

type ChangesQuery = z.infer<typeof changesQuerySchema>;
const CHANGES_MAX_LIMIT = 100;

function parseQuery(request: NextRequest) {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = changesQuerySchema.safeParse(entries);
  return result;
}

export async function GET(request: NextRequest) {
  const parsedQuery = parseQuery(request);
  if (!parsedQuery.success) {
    return validationError(parsedQuery.error, 'Invalid query');
  }
  const query: ChangesQuery = parsedQuery.data;

  try {
    await requireDashboardAccess(query.restaurantId);
  } catch (error) {
    return buildDashboardAccessErrorResponse('changes', error);
  }

  const limit = query.limit ? parseInt(query.limit, 10) : 50;
  if (!Number.isFinite(limit) || limit < 1 || limit > CHANGES_MAX_LIMIT) {
    return apiError(
      400,
      'VALIDATION_FAILED',
      `Change feed limit must be between 1 and ${CHANGES_MAX_LIMIT}`,
      { fields: { limit: [`Must be between 1 and ${CHANGES_MAX_LIMIT}`] } },
    );
  }

  const rateLimit = await requireApiRateLimit({
    request,
    scope: 'ops-dashboard:changes',
    tenantId: query.restaurantId,
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const changesData = await getTodayBookingChanges(query.restaurantId, {
      date: query.date,
      limit,
      client: getServiceSupabaseClient(),
    });

    return NextResponse.json(changesData);
  } catch (changesError) {
    captureServerException(changesError, {
      groups: { restaurant: query.restaurantId },
      properties: {
        restaurantId: query.restaurantId,
        source: 'ops',
        kind: 'ops-dashboard-changes',
      },
    });
    return internalError(changesError, { route: ROUTE }, 'Unable to load booking changes');
  }
}
