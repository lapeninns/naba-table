/**
 * GET /api/ops/restaurants/{id}/dual-sync/metrics
 *
 * Returns operator-facing dual-sync health metrics for one restaurant:
 * queue backlog, dead letters, failure codes, partial publishes, and
 * alert flags. This is backend support for the rollout dashboard/runbook
 * workflow; it does not mutate sync state.
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
import { loadDualSyncOperationalMetrics } from '@/server/dual-sync/observability';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

function parsePositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  if (!isDualSyncEnabled({ restaurantId })) {
    return dualSyncUnavailableResponse();
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-metrics');
  if (access instanceof NextResponse) return access;

  try {
    const windowHours = parsePositiveInt(req.nextUrl.searchParams.get('windowHours'));
    const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'));
    const metrics = await loadDualSyncOperationalMetrics({
      client: getServiceSupabaseClient(),
      restaurantId,
      windowMs: windowHours === undefined ? undefined : windowHours * 60 * 60 * 1000,
      limit,
    });
    return NextResponse.json(metrics, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load dual-sync metrics';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_METRICS_ERROR');
  }
}

export const runtime = 'nodejs';
