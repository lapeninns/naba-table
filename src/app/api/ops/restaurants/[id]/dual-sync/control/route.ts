/**
 * GET/PATCH /api/ops/restaurants/{id}/dual-sync/control
 *
 * Restaurant-scoped kill switch for write-affecting dual-sync paths.
 * State reads remain available so operators can inspect why the workspace
 * is paused and safely resume it.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import {
  getDualSyncRestaurantControl,
  setDualSyncRestaurantPaused,
} from '@/server/dual-sync/controls';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

const controlPatchSchema = z.object({
  syncPaused: z.boolean(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-control');
  if (access instanceof NextResponse) return access;

  try {
    const control = await getDualSyncRestaurantControl({
      client: getServiceSupabaseClient(),
      restaurantId,
    });
    return NextResponse.json({ restaurantId, control }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load dual-sync control';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_CONTROL_ERROR');
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-control');
  if (access instanceof NextResponse) return access;

  let body: z.infer<typeof controlPatchSchema>;
  try {
    const json = await req.json();
    body = controlPatchSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return dualSyncErrorResponse('Invalid request body', 422, 'DUAL_SYNC_INVALID_REQUEST', {
        details: error.flatten(),
      });
    }
    return dualSyncErrorResponse('Invalid JSON body', 400, 'DUAL_SYNC_INVALID_JSON');
  }

  try {
    const control = await setDualSyncRestaurantPaused({
      client: getServiceSupabaseClient(),
      restaurantId,
      paused: body.syncPaused,
      reason: body.reason ?? null,
      actorUserId: access.userId,
    });
    return NextResponse.json({ restaurantId, control }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update dual-sync control';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_CONTROL_ERROR');
  }
}

export const runtime = 'nodejs';
