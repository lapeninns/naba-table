// TODO(gbp-ia-audit-20260502-1201): Orphan route handler; no client caller after the F-10 hook deletions. See tasks/google-business-profile-ia-audit-20260502-1201/FINDINGS.md (F-11). Decide whether to delete or rewire in a follow-up.
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import { updateGoogleBusinessProfileWorkflowDraft } from '@/server/google-business-profile/workflow';

import type { GoogleBusinessProfileFieldDecisionInput } from '@/server/google-business-profile/workflow';
import type { NextRequest } from 'next/server';

const patchSchema = z.object({
  selectedApprovals: z.record(z.string(), z.boolean()).optional(),
  decisions: z
    .array(
      z.object({
        sectionKey: z.string().trim().min(1),
        fieldKey: z.string().trim().min(1),
        action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
        reviewedNabatableValueHash: z.string().trim().min(1),
        reviewedGoogleValueHash: z.string().trim().min(1),
      }),
    )
    .optional(),
  status: z.enum(['review_ready', 'approved']).optional(),
});

type RouteContext = {
  params: Promise<{ id: string | string[]; draftId: string | string[] }>;
};

function getDraftErrorStatus(error: unknown): number {
  if (error instanceof Error && error.name === 'GBP_DRAFT_INVALID_STATE') return 409;
  if (error instanceof Error && error.name === 'GBP_DECISION_INVALID') return 400;
  return 500;
}

async function resolveDraftId(paramsPromise: RouteContext['params']): Promise<string | null> {
  const params = await paramsPromise;
  const { draftId } = params;
  if (typeof draftId === 'string') return draftId;
  if (Array.isArray(draftId)) return draftId[0] ?? null;
  return null;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const [restaurantId, draftId] = await Promise.all([
    resolveRestaurantId(params),
    resolveDraftId(params),
  ]);
  if (!restaurantId || !draftId) {
    return NextResponse.json({ error: 'Missing restaurant or draft id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-drafts',
    req,
  );
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await updateGoogleBusinessProfileWorkflowDraft({
        restaurantId,
        draftId,
        actorUserId: access.userId,
        selectedApprovals: payload.selectedApprovals,
        decisions: payload.decisions as GoogleBusinessProfileFieldDecisionInput[] | undefined,
        status: payload.status,
      }),
    );
  } catch (error) {
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to update Google Business Profile review draft.',
      status: getDraftErrorStatus(error),
    });
  }
}

export const runtime = 'nodejs';
