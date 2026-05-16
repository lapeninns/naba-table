import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isOpsRejectionAnalyticsEnabled } from '@/server/feature-flags';
import { getRejectionAnalytics } from '@/server/ops/rejections';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  buildDashboardAccessErrorResponse,
  requireDashboardAccess,
} from '@/src/app/api/ops/dashboard/_shared';

import type { NextRequest } from 'next/server';

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().optional(),
  to: z.string().optional(),
  bucket: z.enum(['day', 'hour']).optional(),
});

type RejectionsQuery = z.infer<typeof querySchema>;

function parseQuery(request: NextRequest): RejectionsQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = querySchema.safeParse(entries);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export async function GET(request: NextRequest) {
  if (!isOpsRejectionAnalyticsEnabled()) {
    return NextResponse.json({ error: 'Rejection analytics is disabled' }, { status: 404 });
  }

  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  try {
    await requireDashboardAccess(query.restaurantId);
  } catch (error) {
    return buildDashboardAccessErrorResponse('rejections', error);
  }

  try {
    const analytics = await getRejectionAnalytics(query.restaurantId, {
      client: getServiceSupabaseClient(),
      from: query.from,
      to: query.to,
      bucket: query.bucket,
    });

    return NextResponse.json(analytics);
  } catch (analyticsError) {
    console.error('[ops/dashboard][rejections] failed to load analytics', analyticsError);
    return NextResponse.json({ error: 'Unable to load rejection analytics' }, { status: 500 });
  }
}
