/**
 * Phase 3m of the unified dual-sync engine.
 *
 * GET /api/ops/restaurants/{id}/dual-sync/publish-jobs
 *
 * Returns a list of recent publish-job rollups for the restaurant.
 * Each rollup aggregates the operations from one publish job into a
 * single row showing succeeded / failed / skipped counts, the affected
 * sections, and the unique error codes seen on failure.
 *
 * Query params (all optional):
 *  - `jobLimit` (1..100, default 25)
 *  - `operationLimit` (1..200, default 200)
 *  - `since` (ISO-8601 timestamp; rows older than this are dropped)
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { listRecentPublishJobsForRestaurant } from '@/server/dual-sync/publish/operations';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { captureSafeGbpException } from '@/server/dual-sync/retention/telemetry';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseSince(raw: string | null): string | null {
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-publish-jobs');
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);

  try {
    const url = new URL(req.url);
    const jobLimit = parseLimit(url.searchParams.get('jobLimit'));
    const operationLimit = parseLimit(url.searchParams.get('operationLimit'));
    const since = parseSince(url.searchParams.get('since'));

    const jobs = await listRecentPublishJobsForRestaurant({
      client: getServiceSupabaseClient(),
      restaurantId,
      jobLimit,
      operationLimit,
      since,
    });

    return gbpNoStoreJson({ restaurantId, jobs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load publish jobs';
    captureSafeGbpException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'dual-sync-publish-jobs' },
    });
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_PUBLISH_JOBS_ERROR');
  }
}

export const runtime = 'nodejs';
