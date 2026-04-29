/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * POST /api/ops/restaurants/{id}/google-business-profile/v2/drafts
 * Creates a fresh V2 draft from live Nabatable + Google snapshots.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import { composeDraft } from '@/server/google-business-profile-v2/drafts/composer';
import { isGbpSyncV2Enabled } from '@/server/google-business-profile-v2/flag';
import { getServiceSupabaseClient } from '@/server/supabase';

import { createDraftRequestSchema } from '../_v2-schemas';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }
  if (!isGbpSyncV2Enabled({ restaurantId })) {
    return NextResponse.json(
      { error: 'V2 sync is not enabled for this restaurant.' },
      { status: 404 },
    );
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'gbp-sync-v2-drafts');
  if (access instanceof NextResponse) return access;

  let body: unknown = {};
  try {
    const text = await req.text();
    body = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = createDraftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const draft = await composeDraft({
      client: getServiceSupabaseClient(),
      restaurantId,
      createdByUserId: access.userId,
      refresh: parsed.data.refresh ?? false,
    });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    const isRefreshConflict =
      error instanceof Error && error.name === 'GBP_SYNC_V2_DRAFT_REFRESH_CONFLICT';
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to create V2 sync draft.',
      status: isRefreshConflict ? 409 : 500,
      publicMessage: isRefreshConflict,
    });
  }
}

export const runtime = 'nodejs';
