import { NextResponse } from 'next/server';
import { z } from 'zod';

import { internalError } from '@/lib/api/errors';
import { daysBetweenInclusive, firstString, safeDate } from '@/lib/api/query-params';
import { captureServerException } from '@/lib/posthog/server';
import { getBookingsHeatmap } from '@/server/ops/bookings';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  buildDashboardAccessErrorResponse,
  requireDashboardAccess,
} from '@/src/app/api/ops/dashboard/_shared';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/dashboard/heatmap';

const heatmapQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  startDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  endDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
});

type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;
const HEATMAP_MAX_WINDOW_DAYS = 93;

function parseQuery(request: NextRequest): HeatmapQuery | null {
  const params = request.nextUrl.searchParams;
  const result = heatmapQuerySchema.safeParse({
    restaurantId: firstString(params, 'restaurantId'),
    startDate: safeDate(params, 'startDate'),
    endDate: safeDate(params, 'endDate'),
  });
  if (!result.success) {
    return null;
  }
  return result.data;
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  try {
    await requireDashboardAccess(query.restaurantId);
  } catch (error) {
    return buildDashboardAccessErrorResponse('heatmap', error);
  }

  const windowDays = daysBetweenInclusive(query.startDate, query.endDate);
  if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > HEATMAP_MAX_WINDOW_DAYS) {
    return NextResponse.json(
      { error: `Heatmap range must be between 1 and ${HEATMAP_MAX_WINDOW_DAYS} days` },
      { status: 400 },
    );
  }

  const rateLimit = await requireApiRateLimit({
    request,
    scope: 'ops-dashboard:heatmap',
    tenantId: query.restaurantId,
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const heatmap = await getBookingsHeatmap(query.restaurantId, {
      client: getServiceSupabaseClient(),
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return NextResponse.json(heatmap);
  } catch (heatmapError) {
    captureServerException(heatmapError, {
      groups: { restaurant: query.restaurantId },
      properties: {
        restaurantId: query.restaurantId,
        source: 'ops',
        kind: 'ops-dashboard-heatmap',
      },
    });
    return internalError(heatmapError, { route: ROUTE }, 'Unable to load heatmap');
  }
}
