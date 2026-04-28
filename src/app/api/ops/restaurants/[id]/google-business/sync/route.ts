import { NextResponse } from 'next/server';

import {
  getGoogleBusinessProfileBusinessDetailsStatus,
  syncGoogleBusinessProfileBusinessInformation,
} from '@/server/google-business-profile/service';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from '../_shared';

import type { NextRequest } from 'next/server';

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  try {
    await syncGoogleBusinessProfileBusinessInformation(resolved.restaurantId);
    return NextResponse.json(
      await getGoogleBusinessProfileBusinessDetailsStatus(resolved.restaurantId),
    );
  } catch (error) {
    return googleBusinessErrorResponse(error, 'Unable to sync Google Business Profile snapshot.');
  }
}
