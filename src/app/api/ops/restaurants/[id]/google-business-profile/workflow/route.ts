// TODO(gbp-ia-audit-20260502-1201): Orphan route handler; no client caller after the F-10 hook deletions. See tasks/google-business-profile-ia-audit-20260502-1201/FINDINGS.md (F-11). Decide whether to delete or rewire in a follow-up.
import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import { getGoogleBusinessProfileWorkflow } from '@/server/google-business-profile/workflow';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-workflow',
  );
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    return NextResponse.json(await getGoogleBusinessProfileWorkflow(restaurantId));
  } catch (error) {
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to load Google Business Profile workflow.',
      status: 500,
    });
  }
}

export const runtime = 'nodejs';
