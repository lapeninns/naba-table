import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import { preflightGoogleBusinessProfileWorkflowDraft } from '@/server/google-business-profile/workflow';

import type { GoogleBusinessProfileFieldDecisionInput } from '@/server/google-business-profile/workflow';
import type { NextRequest } from 'next/server';

const directionIntentSchema = z.enum([
  'google_to_nabatable',
  'google_to_nabatable_with_google_sync',
  'nabatable_to_google',
]);

const preflightSchema = z.object({
  selectedApprovals: z.record(z.string(), z.boolean()).default({}),
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
  directionIntent: directionIntentSchema.optional(),
  pushToGoogle: z.boolean().optional(),
});

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

function getPreflightErrorStatus(error: unknown): number {
  if (error instanceof Error) {
    if (error.name === 'GBP_DRAFT_STALE' || error.name === 'GBP_DRAFT_INVALID_STATE') return 409;
    if (error.name === 'GBP_DRAFT_NOT_APPROVED') return 409;
    if (error.name === 'GBP_GOOGLE_PUSH_DISABLED') return 409;
    if (error.name === 'GBP_DRAFT_NO_SELECTION') return 400;
    if (error.name === 'GBP_DIRECTION_CONFLICT') return 400;
    if (error.name === 'GBP_DECISION_INVALID') return 400;
  }
  return 500;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const [restaurantId, draftId] = await Promise.all([
    resolveRestaurantId(params),
    resolveDraftId(params),
  ]);
  if (!restaurantId || !draftId) {
    return NextResponse.json({ error: 'Missing restaurant or draft id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-preflight',
  );
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof preflightSchema>;
  try {
    payload = preflightSchema.parse(await req.json());
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
      await preflightGoogleBusinessProfileWorkflowDraft({
        restaurantId,
        draftId,
        actorUserId: access.userId,
        selectedApprovals: payload.selectedApprovals,
        decisions: payload.decisions as GoogleBusinessProfileFieldDecisionInput[] | undefined,
        directionIntent: payload.directionIntent,
        pushToGoogle: payload.pushToGoogle,
      }),
    );
  } catch (error) {
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to preflight Google Business Profile draft publish.',
      status: getPreflightErrorStatus(error),
    });
  }
}

export const runtime = 'nodejs';
