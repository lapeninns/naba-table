/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * POST /api/ops/restaurants/{id}/google-business-profile/v2/drafts/{draftId}/preflight
 *
 * Re-runs the diff for the live snapshots of `draftId`, runs the preflight
 * validator over the live decisions, and persists a `preflight_locked`
 * publish job carrying the frozen contract hashes.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import { getGoogleBusinessProfileConnectionState } from '@/server/google-business-profile/service';
import { listDecisionsForDraft } from '@/server/google-business-profile-v2/decisions/store';
import { getDraft, setDraftStatus } from '@/server/google-business-profile-v2/drafts/store';
import { isGbpSyncV2Enabled } from '@/server/google-business-profile-v2/flag';
import { persistPreflight } from '@/server/google-business-profile-v2/preflight/store';
import { runPreflight } from '@/server/google-business-profile-v2/preflight/validator';
import { getServiceSupabaseClient } from '@/server/supabase';

import { preflightRequestSchema } from '../../../_v2-schemas';

import type { SyncV2DiffItem } from '@/server/google-business-profile-v2/types';
import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; draftId: string | string[] }>;
};

async function resolveDraftId(p: RouteContext['params']): Promise<string | null> {
  const { draftId } = await p;
  if (typeof draftId === 'string') return draftId;
  if (Array.isArray(draftId)) return draftId[0] ?? null;
  return null;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
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
  const access = await ensureRestaurantAdminAccess(restaurantId, 'gbp-sync-v2-preflight');
  if (access instanceof NextResponse) return access;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = preflightRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const client = getServiceSupabaseClient();
    const draft = await getDraft({ client, restaurantId, draftId });
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    if (draft.status !== 'open' && draft.status !== 'preflight_locked') {
      return NextResponse.json(
        {
          error:
            draft.status === 'published'
              ? 'This V2 draft has already been published. Refresh snapshots to review new changes.'
              : 'This V2 draft is no longer preflightable. Refresh snapshots to review current changes.',
        },
        { status: 409 },
      );
    }
    const decisions = await listDecisionsForDraft({ client, restaurantId, draftId });
    const connection = await getGoogleBusinessProfileConnectionState(restaurantId, client);
    const googleWriteEligible = Boolean(
      connection &&
      'pushEnabled' in connection &&
      (connection as { pushEnabled?: boolean }).pushEnabled,
    );

    const outcome = runPreflight({
      directionIntent: parsed.data.directionIntent,
      diffItems: draft.diffItems as ReadonlyArray<SyncV2DiffItem>,
      decisions,
      nabatableSnapshotHash: draft.nabatableSnapshot.hash,
      googleSnapshotHash: draft.googleSnapshot.hash,
      googleWriteEligible,
    });
    if (!outcome.ok) {
      return NextResponse.json({ ok: false, errors: outcome.errors }, { status: 422 });
    }

    const frozenDecisions = outcome.result.publishablePlanItems.map((item) => {
      const live = decisions.find(
        (d) => d.sectionKey === item.sectionKey && d.fieldKey === item.fieldKey,
      );
      return {
        sectionKey: item.sectionKey,
        fieldKey: item.fieldKey,
        action: item.action,
        nabatableValueHash: live?.nabatableValueHash ?? '',
        googleValueHash: live?.googleValueHash ?? '',
      };
    });

    const job = await persistPreflight({
      client,
      workflowId: draft.workflowId,
      draftId,
      restaurantId,
      directionIntent: parsed.data.directionIntent,
      idempotencyKey: parsed.data.idempotencyKey,
      preflightResult: outcome.result,
      frozenDecisions,
      createdByUserId: access.userId,
    });

    await setDraftStatus({ client, draftId, status: 'preflight_locked' });
    return NextResponse.json({ ok: true, publishJob: job, preflight: outcome.result });
  } catch (error) {
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to run V2 sync preflight.',
      status: 500,
    });
  }
}

export const runtime = 'nodejs';
