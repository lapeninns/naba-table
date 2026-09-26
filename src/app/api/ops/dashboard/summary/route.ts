import { NextResponse } from 'next/server';
import { z } from 'zod';

import { internalError } from '@/lib/api/errors';
import { firstString, safeDate } from '@/lib/api/query-params';
import { captureServerException } from '@/lib/posthog/server';
import { getTodayBookingsSummary } from '@/server/ops/bookings';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  buildDashboardAccessErrorResponse,
  requireDashboardAccess,
} from '@/src/app/api/ops/dashboard/_shared';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/dashboard/summary';

const summaryQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
});

type SummaryQuery = z.infer<typeof summaryQuerySchema>;

function parseQuery(request: NextRequest): SummaryQuery | null {
  const params = request.nextUrl.searchParams;
  const rawDate = firstString(params, 'date');
  const result = summaryQuerySchema.safeParse({
    restaurantId: firstString(params, 'restaurantId'),
    date: rawDate === undefined ? undefined : (safeDate(params, 'date') ?? '__invalid_date__'),
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
    return buildDashboardAccessErrorResponse('summary', error);
  }

  const rateLimit = await requireApiRateLimit({
    request,
    scope: 'ops-dashboard:summary',
    tenantId: query.restaurantId,
    limit: 90,
    windowMs: 60_000,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const summary = await getTodayBookingsSummary(query.restaurantId, {
      client: getServiceSupabaseClient(),
      targetDate: query.date ?? undefined,
    });

    return NextResponse.json(summary);
  } catch (summaryError) {
    captureServerException(summaryError, {
      groups: { restaurant: query.restaurantId },
      properties: {
        restaurantId: query.restaurantId,
        source: 'ops',
        kind: 'ops-dashboard-summary',
      },
    });
    return internalError(summaryError, { route: ROUTE }, 'Unable to load summary');
  }
}
