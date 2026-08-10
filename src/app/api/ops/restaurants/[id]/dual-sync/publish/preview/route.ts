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
import { logger } from '@/lib/logger';
import { DUAL_SYNC_SECTION_KEYS } from '@/server/dual-sync';
import { parseGbpExactPreviewResponseV1 } from '@/server/dual-sync/contracts';
import { buildSupportedExactConsentPlan } from '@/server/dual-sync/publish/exact-consent';
import { exactConsentPublicError } from '@/server/dual-sync/publish/exact-consent/public-errors';
import { buildPublishPlan } from '@/server/dual-sync/publish/planner';
import { gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
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

function privateNoStore(response: NextResponse): NextResponse {
  return gbpNoStoreResponse(response);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return privateNoStore(dualSyncErrorResponse('Missing restaurant id', 400));
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-publish-preview', req);
  if (access instanceof NextResponse) return privateNoStore(access);

  let body: unknown = null;
  try {
    const text = await req.text();
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    return privateNoStore(
      dualSyncErrorResponse('Invalid JSON body', 400, 'DUAL_SYNC_INVALID_JSON'),
    );
  }
  const parsed = publishPreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return privateNoStore(
      dualSyncErrorResponse('Invalid request', 422, 'DUAL_SYNC_INVALID_REQUEST', {
        details: parsed.error.flatten(),
      }),
    );
  }

  try {
    const client = getServiceSupabaseClient();
    const publishInput = {
      restaurantId,
      decisions: parsed.data.decisions,
      actorUserId: access.userId,
      clientRequestId: parsed.data.clientRequestId ?? null,
      publishBatchId: parsed.data.publishBatchId ?? null,
      pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null,
      pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null,
    };
    const hasGoogleExport = parsed.data.decisions.some(
      (decision) => decision.action === 'export_to_google',
    );
    const plan = hasGoogleExport
      ? (await buildSupportedExactConsentPlan({ client, publish: publishInput })).preview
      : await buildPublishPlan(client, publishInput);
    if (hasGoogleExport) {
      const exactResponse = parseGbpExactPreviewResponseV1(plan);
      if (!exactResponse.success) throw exactResponse.error;
      return privateNoStore(NextResponse.json(exactResponse.data, { status: 200 }));
    }
    return privateNoStore(NextResponse.json(plan, { status: 200 }));
  } catch (error) {
    const publicError = exactConsentPublicError(error, 'preview');
    logger.error('Exact Google write preview failed.', {
      restaurantId,
      failureKind: publicError.code,
    });
    return privateNoStore(
      dualSyncErrorResponse(publicError.message, publicError.status, publicError.code),
    );
  }
}

export const runtime = 'nodejs';
