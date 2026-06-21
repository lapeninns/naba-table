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
import { captureServerException } from '@/lib/posthog/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  dualSyncErrorResponse,
  dualSyncPausedResponse,
} from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { DUAL_SYNC_SECTION_KEYS } from '@/server/dual-sync';
import {
  assertDualSyncRestaurantNotPaused,
  isDualSyncRestaurantPausedError,
} from '@/server/dual-sync/controls';
import { isDualSyncLockError } from '@/server/dual-sync/locks';
import { createDurableDualSyncGoogleEditThrottle } from '@/server/dual-sync/publish/google-safety';
import { runPublish } from '@/server/dual-sync/publish/orchestrator';
import { defaultDualSyncPorts } from '@/server/dual-sync/publish/ports';
import { enqueueDualSyncJob } from '@/server/dual-sync/queue';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const decisionSchema = z.object({
  fieldKey: z.string().min(1),
  sectionKey: z.enum(DUAL_SYNC_SECTION_KEYS),
  action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
  pinnedCoreHash: z.string().nullable(),
  pinnedGbpHash: z.string().nullable(),
});

const publishRequestSchema = z.object({
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
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-publish', req);
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
    const client = getServiceSupabaseClient();
    await assertDualSyncRestaurantNotPaused({ client, restaurantId });
    if (req.nextUrl.searchParams.get('queue') === '1') {
      const job = await enqueueDualSyncJob({
        client,
        restaurantId,
        jobKind: 'publish_batch',
        idempotencyKey: parsed.data.clientRequestId ?? null,
        payload: {
          decisions: parsed.data.decisions,
          actorUserId: access.userId,
          clientRequestId: parsed.data.clientRequestId ?? null,
          publishBatchId: parsed.data.publishBatchId ?? null,
          pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null,
          pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null,
        },
        priority: 50,
      });
      return NextResponse.json({ queued: true, job }, { status: 202 });
    }

    const result = await runPublish(
      client,
      {
        restaurantId,
        decisions: parsed.data.decisions,
        actorUserId: access.userId,
        clientRequestId: parsed.data.clientRequestId ?? null,
        publishBatchId: parsed.data.publishBatchId ?? null,
        pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null,
        pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null,
      },
      {
        ports: defaultDualSyncPorts(),
        googleEditThrottle: createDurableDualSyncGoogleEditThrottle(client),
        refreshGoogleBeforePublish: true,
      },
    );
    return NextResponse.json(result.summary, { status: 200 });
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
    const message = error instanceof Error ? error.message : 'Publish failed';
    captureServerException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'dual-sync-publish' },
    });
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_PUBLISH_ERROR');
  }
}

export const runtime = 'nodejs';
