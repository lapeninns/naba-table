/**
 * GET /api/ops/restaurants/{id}/dual-sync/jobs
 *
 * Returns recent durable dual-sync queue jobs for one restaurant. This
 * complements publish operation history with queue-level recovery state:
 * queued, running, retrying, succeeded, dead-letter, and cancelled.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { listRecentDualSyncJobs } from '@/server/dual-sync/queue';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { DualSyncJobStatus } from '@/server/dual-sync';
import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

const VALID_STATUSES: ReadonlyArray<DualSyncJobStatus> = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'retrying',
  'dead_letter',
  'cancelled',
];

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseStatuses(raw: string | null): ReadonlyArray<DualSyncJobStatus> | undefined {
  if (!raw) return undefined;
  const out: DualSyncJobStatus[] = [];
  for (const piece of raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    if ((VALID_STATUSES as ReadonlyArray<string>).includes(piece)) {
      out.push(piece as DualSyncJobStatus);
    }
  }
  return out.length > 0 ? out : undefined;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-jobs');
  if (access instanceof NextResponse) return access;

  try {
    const jobs = await listRecentDualSyncJobs({
      client: getServiceSupabaseClient(),
      restaurantId,
      limit: parseLimit(req.nextUrl.searchParams.get('limit')),
      statuses: parseStatuses(req.nextUrl.searchParams.get('status')),
    });

    return NextResponse.json({ restaurantId, jobs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load dual-sync jobs';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_JOBS_ERROR');
  }
}

export const runtime = 'nodejs';
