/**
 * Phase 3g of the unified dual-sync engine.
 *
 * POST /api/ops/restaurants/{id}/dual-sync/auto-export
 *
 * Drains the open outbound candidates for the restaurant and runs them
 * through the publish orchestrator with `defaultDualSyncPorts`. Returns
 * the auto-export summary plus the underlying publish summary so the
 * UI can show per-field outcomes.
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
  dualSyncUnavailableResponse,
} from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { isDualSyncEnabled } from '@/server/dual-sync/flag';
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
  if (!isDualSyncEnabled({ restaurantId })) {
    return dualSyncUnavailableResponse();
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-auto-export');
  if (access instanceof NextResponse) return access;

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
    const summary = await runAutoExportForRestaurant({
      client: getServiceSupabaseClient(),
      restaurantId,
      maxCandidates: body?.maxCandidates,
      actorUserId: access.userId,
    });
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auto-export failed';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_AUTO_EXPORT_ERROR');
  }
}

export const runtime = 'nodejs';
