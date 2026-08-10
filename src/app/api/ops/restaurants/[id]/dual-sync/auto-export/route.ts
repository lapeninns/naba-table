/**
 * Phase 3g of the unified dual-sync engine.
 *
 * POST /api/ops/restaurants/{id}/dual-sync/auto-export
 *
 * Discovers open outbound candidates for operator review. This route never
 * enqueues or executes a provider mutation.
 *
 * Manual ops trigger only — a cross-tenant cron path can call the
 * `runAutoExportForRestaurant` helper directly without going through
 * this HTTP surface.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

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
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { captureSafeGbpException } from '@/server/dual-sync/retention/telemetry';
import { isDualSyncAutoCandidatesEnabled } from '@/server/dual-sync/runtime-controls';
import { runAutoExportForRestaurant } from '@/server/dual-sync/scheduling/auto-export';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

const requestSchema = z
  .object({
    maxCandidates: z.number().int().min(1).max(100).optional(),
  })
  .optional();

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  if (!isDualSyncAutoCandidatesEnabled({ restaurantId })) {
    return dualSyncErrorResponse(
      'Dual-sync auto-candidate export is disabled for this deployment.',
      409,
      'DUAL_SYNC_AUTO_CANDIDATES_DISABLED',
    );
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-auto-export', req);
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await req.json().catch(() => undefined);
    body = requestSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return dualSyncErrorResponse('Invalid request body', 400, 'DUAL_SYNC_INVALID_REQUEST', {
        details: error.issues,
      });
    }
    return dualSyncErrorResponse('Invalid request body', 400, 'DUAL_SYNC_INVALID_REQUEST');
  }

  try {
    const client = getServiceSupabaseClient();
    await assertDualSyncRestaurantNotPaused({ client, restaurantId });
    const summary = await runAutoExportForRestaurant({
      client,
      restaurantId,
      maxCandidates: body?.maxCandidates,
      actorUserId: access.userId,
    });
    return gbpNoStoreJson(summary, { status: 200 });
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
    const message = error instanceof Error ? error.message : 'Auto-export failed';
    captureSafeGbpException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'dual-sync-auto-export' },
    });
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_AUTO_EXPORT_ERROR');
  }
}

export const runtime = 'nodejs';
