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
  dualSyncPausedResponse,
} from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import {
  assertDualSyncRestaurantNotPaused,
  isDualSyncRestaurantPausedError,
} from '@/server/dual-sync/controls';
import { isDualSyncLockError } from '@/server/dual-sync/locks';
import { enqueueDualSyncJob } from '@/server/dual-sync/queue';
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
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-refresh', _req);
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
    const client = getServiceSupabaseClient();
    await assertDualSyncRestaurantNotPaused({ client, restaurantId });
    if (_req.nextUrl.searchParams.get('queue') === '1') {
      const job = await enqueueDualSyncJob({
        client,
        restaurantId,
        jobKind: 'google_refresh_manual',
        idempotencyKey: _req.headers.get('idempotency-key'),
        payload: {
          actorUserId: access.userId,
          skipPull: false,
        },
        priority: 40,
      });
      return NextResponse.json({ queued: true, job }, { status: 202 });
    }

    const result = await refreshFromGoogle({
      client,
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
    if (isDualSyncRestaurantPausedError(error)) {
      return dualSyncPausedResponse(error.message);
    }
    if (isDualSyncLockError(error)) {
      return dualSyncErrorResponse(
        error.message,
        409,
        'DUAL_SYNC_LOCK_HELD',
        error.activeLock ? { activeLock: error.activeLock } : undefined,
      );
    }
    const message = error instanceof Error ? error.message : 'Refresh failed';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_REFRESH_ERROR');
  }
}

export const runtime = 'nodejs';
