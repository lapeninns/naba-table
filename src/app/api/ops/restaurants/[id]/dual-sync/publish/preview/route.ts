/**
 * Phase 3d of the unified dual-sync engine.
 *
 * POST /api/ops/restaurants/{id}/dual-sync/publish/preview
 *
 * Builds a read-only publish plan from fresh Core + Google snapshots.
 * The route validates the operator's pinned hashes and field policy
 * before any write route can run.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { DUAL_SYNC_SECTION_KEYS } from '@/server/dual-sync';
import { buildPublishPlan } from '@/server/dual-sync/publish/planner';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const decisionSchema = z.object({
  fieldKey: z.string().min(1),
  sectionKey: z.enum(DUAL_SYNC_SECTION_KEYS),
  action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
  pinnedCoreHash: z.string().nullable(),
  pinnedGbpHash: z.string().nullable(),
});

const publishPreviewRequestSchema = z.object({
  decisions: z.array(decisionSchema).min(1).max(200),
  clientRequestId: z.string().trim().min(1).max(128).optional(),
  publishBatchId: z.string().trim().min(1).max(128).optional(),
  pinnedCoreSnapshotHash: z.string().nullable().optional(),
  pinnedGbpSnapshotHash: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string | string[] }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-publish-preview', req);
  if (access instanceof NextResponse) return access;

  let body: unknown = null;
  try {
    const text = await req.text();
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    return dualSyncErrorResponse('Invalid JSON body', 400, 'DUAL_SYNC_INVALID_JSON');
  }
  const parsed = publishPreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return dualSyncErrorResponse('Invalid request', 422, 'DUAL_SYNC_INVALID_REQUEST', {
      details: parsed.error.flatten(),
    });
  }

  try {
    const plan = await buildPublishPlan(getServiceSupabaseClient(), {
      restaurantId,
      decisions: parsed.data.decisions,
      actorUserId: access.userId,
      clientRequestId: parsed.data.clientRequestId ?? null,
      publishBatchId: parsed.data.publishBatchId ?? null,
      pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null,
      pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null,
    });
    return NextResponse.json(plan, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build publish preview';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_PUBLISH_PREVIEW_ERROR');
  }
}

export const runtime = 'nodejs';
