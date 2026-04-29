/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * GET    /api/ops/restaurants/{id}/google-business-profile/v2/drafts/{draftId}
 * PATCH  /api/ops/restaurants/{id}/google-business-profile/v2/drafts/{draftId}
 *
 * GET returns the draft + current decisions. PATCH upserts decisions.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import {
  listDecisionsForDraft,
  upsertDecisions,
} from '@/server/google-business-profile-v2/decisions/store';
import { getDraft } from '@/server/google-business-profile-v2/drafts/store';
import { isGbpSyncV2Enabled } from '@/server/google-business-profile-v2/flag';
import { getServiceSupabaseClient } from '@/server/supabase';

import { upsertDecisionsRequestSchema } from '../../_v2-schemas';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; draftId: string | string[] }>;
};

async function resolveDraftId(paramsPromise: RouteContext['params']): Promise<string | null> {
  const params = await paramsPromise;
  const { draftId } = params;
  if (typeof draftId === 'string') return draftId;
  if (Array.isArray(draftId)) return draftId[0] ?? null;
  return null;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  const draftId = await resolveDraftId(params);
  if (!restaurantId || !draftId) {
    return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
  }
  if (!isGbpSyncV2Enabled({ restaurantId })) {
    return NextResponse.json(
      { error: 'V2 sync is not enabled for this restaurant.' },
      { status: 404 },
    );
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'gbp-sync-v2-draft-detail');
  if (access instanceof NextResponse) return access;

  try {
    const client = getServiceSupabaseClient();
    const draft = await getDraft({ client, restaurantId, draftId });
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    const decisions = await listDecisionsForDraft({ client, restaurantId, draftId });
    return NextResponse.json({ draft, decisions });
  } catch (error) {
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to read V2 sync draft.',
      status: 500,
    });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  const draftId = await resolveDraftId(params);
  if (!restaurantId || !draftId) {
    return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
  }
  if (!isGbpSyncV2Enabled({ restaurantId })) {
    return NextResponse.json(
      { error: 'V2 sync is not enabled for this restaurant.' },
      { status: 404 },
    );
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'gbp-sync-v2-draft-decisions');
  if (access instanceof NextResponse) return access;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = upsertDecisionsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const client = getServiceSupabaseClient();
    const decisions = await upsertDecisions({
      client,
      restaurantId,
      draftId,
      decidedByUserId: access.userId,
      decisions: parsed.data.decisions,
    });
    return NextResponse.json({ decisions });
  } catch (error) {
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to update V2 sync decisions.',
      status: 500,
    });
  }
}

export const runtime = 'nodejs';
