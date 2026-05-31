/**
 * POST /api/ops/restaurants/{id}/dual-sync/jobs/{jobId}/retry
 *
 * Requeues a terminal durable dual-sync job for operator recovery.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { retryDualSyncJob } from '@/server/dual-sync/queue';
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

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const resolved = await params;
  const restaurantId = await resolveRestaurantId(Promise.resolve({ id: resolved.id }));
  const jobId = resolveJobId(resolved.jobId);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  if (!jobId) {
    return dualSyncErrorResponse('Missing job id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-job-retry', _req);
  if (access instanceof NextResponse) return access;

  try {
    const job = await retryDualSyncJob({
      client: getServiceSupabaseClient(),
      restaurantId,
      jobId,
    });
    if (!job) {
      return dualSyncErrorResponse(
        'Dual-sync job is not retryable for this restaurant.',
        404,
        'DUAL_SYNC_JOB_NOT_RETRYABLE',
      );
    }
    return NextResponse.json({ restaurantId, job }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retry dual-sync job';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_JOB_RETRY_ERROR');
  }
}

export const runtime = 'nodejs';
