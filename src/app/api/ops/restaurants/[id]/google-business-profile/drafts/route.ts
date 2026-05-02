// TODO(gbp-ia-audit-20260502-1201): Orphan route handler; no client caller after the F-10 hook deletions. See tasks/google-business-profile-ia-audit-20260502-1201/FINDINGS.md (F-11). Decide whether to delete or rewire in a follow-up.
import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import { createGoogleBusinessProfileWorkflowDraft } from '@/server/google-business-profile/workflow';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile-drafts');
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    return NextResponse.json(
      await createGoogleBusinessProfileWorkflowDraft({
        restaurantId,
        actorUserId: access.userId,
      }),
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status =
      message.includes('Link a Google Business Profile location') ||
      message.includes('not connected')
        ? 409
        : 500;
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to generate Google Business Profile review draft.',
      status,
      publicMessage: status === 409,
    });
  }
}

export const runtime = 'nodejs';
