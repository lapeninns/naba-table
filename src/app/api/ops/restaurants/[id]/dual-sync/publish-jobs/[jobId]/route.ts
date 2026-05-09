/**
 * Phase 3n of the unified dual-sync engine.
 *
 * GET /api/ops/restaurants/{id}/dual-sync/publish-jobs/{jobId}
 *
 * Returns the rollup + the full operation list for one publish job.
 * Powers the inline detail expansion in the "Recent publishes" panel.
 *
 * Returns 404 when the job id does not match any operation for the
 * restaurant (defence in depth — the operations table is
 * restaurant-scoped and we deliberately avoid leaking activity from
 * other tenants).
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  dualSyncErrorResponse,
  dualSyncUnavailableResponse,
} from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { isDualSyncEnabled } from '@/server/dual-sync/flag';
import { getPublishJobDetailForRestaurant } from '@/server/dual-sync/publish/operations';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; jobId: string | string[] }>;
};

function resolveJobId(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (Array.isArray(value)) return value[0] && value[0].length > 0 ? value[0] : null;
  return null;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const resolved = await params;
  const restaurantId = await resolveRestaurantId(Promise.resolve({ id: resolved.id }));
  const jobId = resolveJobId(resolved.jobId);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  if (!jobId) {
    return dualSyncErrorResponse('Missing job id', 400);
  }
  if (!isDualSyncEnabled({ restaurantId })) {
    return dualSyncUnavailableResponse();
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-publish-job-detail');
  if (access instanceof NextResponse) return access;

  try {
    const detail = await getPublishJobDetailForRestaurant({
      client: getServiceSupabaseClient(),
      restaurantId,
      publishJobId: jobId,
    });
    if (!detail) {
      return dualSyncErrorResponse(
        'Publish job not found for this restaurant.',
        404,
        'DUAL_SYNC_PUBLISH_JOB_NOT_FOUND',
      );
    }
    return NextResponse.json({ restaurantId, ...detail }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load publish job detail';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_PUBLISH_JOB_ERROR');
  }
}

export const runtime = 'nodejs';
