/**
 * Phase 3b of the unified dual-sync engine.
 *
 * POST /api/ops/restaurants/{id}/dual-sync/refresh
 *
 * Triggers a transactional pull of the Google Business Profile state and
 * recomputes every registry field's `DualSyncFieldState`. Returns the
 * snapshot run id and a transition log so the UI can highlight which
 * fields changed since the last refresh.
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
import { refreshFromGoogle } from '@/server/dual-sync/refresh';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  if (!isDualSyncEnabled({ restaurantId })) {
    return dualSyncUnavailableResponse();
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-refresh');
  if (access instanceof NextResponse) return access;

  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: 'dual-sync-refresh',
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const result = await refreshFromGoogle({
      client: getServiceSupabaseClient(),
      restaurantId,
      runKind: 'manual',
    });
    return NextResponse.json(
      {
        snapshotRun: result.snapshotRun,
        foodMenusRefresh: result.foodMenusRefresh,
        transitions: result.recompute.transitions,
        evaluatedFieldKeys: result.recompute.evaluatedFieldKeys,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh failed';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_REFRESH_ERROR');
  }
}

export const runtime = 'nodejs';
