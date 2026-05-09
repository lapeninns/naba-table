/**
 * Phase 3b of the unified dual-sync engine.
 *
 * POST /api/ops/restaurants/{id}/dual-sync/publish
 *
 * Runs the per-field publish orchestrator with the project's default
 * concrete ports (profile imports wired; other sections + exports
 * pending). Returns the publish-job summary so the UI can render the
 * resulting per-field operation rows and any failures.
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
import { DUAL_SYNC_SECTION_KEYS } from '@/server/dual-sync';
import { isDualSyncEnabled } from '@/server/dual-sync/flag';
import { runPublish } from '@/server/dual-sync/publish/orchestrator';
import { defaultDualSyncPorts } from '@/server/dual-sync/publish/ports';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const decisionSchema = z.object({
  fieldKey: z.string().min(1),
  sectionKey: z.enum(DUAL_SYNC_SECTION_KEYS),
  action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
  pinnedCoreHash: z.string().nullable().default(null),
  pinnedGbpHash: z.string().nullable().default(null),
});

const publishRequestSchema = z.object({
  decisions: z.array(decisionSchema).min(1).max(200),
  pinnedCoreSnapshotHash: z.string().nullable().optional(),
  pinnedGbpSnapshotHash: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string | string[] }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  if (!isDualSyncEnabled({ restaurantId })) {
    return dualSyncUnavailableResponse();
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-publish');
  if (access instanceof NextResponse) return access;

  let body: unknown = null;
  try {
    const text = await req.text();
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    return dualSyncErrorResponse('Invalid JSON body', 400, 'DUAL_SYNC_INVALID_JSON');
  }
  const parsed = publishRequestSchema.safeParse(body);
  if (!parsed.success) {
    return dualSyncErrorResponse('Invalid request', 422, 'DUAL_SYNC_INVALID_REQUEST', {
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await runPublish(
      getServiceSupabaseClient(),
      {
        restaurantId,
        decisions: parsed.data.decisions,
        actorUserId: access.userId,
        pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null,
        pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null,
      },
      {
        ports: defaultDualSyncPorts(),
      },
    );
    return NextResponse.json(result.summary, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_PUBLISH_ERROR');
  }
}

export const runtime = 'nodejs';
