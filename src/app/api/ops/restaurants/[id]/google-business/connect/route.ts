import { NextResponse } from 'next/server';

import { getRequestOrigin } from '@/app/api/ops/google-business-profile/_origin';
import { createGoogleBusinessProfileAuthorizationUrl } from '@/server/google-business-profile/service';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from '../_shared';

import type { NextRequest } from 'next/server';

const SETTINGS_RETURN_PATH = '/app/settings/restaurant/google-business-profile';

export async function POST(req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  try {
    const authorizationUrl = await createGoogleBusinessProfileAuthorizationUrl({
      restaurantId: resolved.restaurantId,
      requestedByUserId: resolved.access.userId,
      returnPath: new URL(SETTINGS_RETURN_PATH, getRequestOrigin(req)).toString(),
    });

    return NextResponse.json({ authorizationUrl });
  } catch (error) {
    return googleBusinessErrorResponse(
      error,
      'Unable to start Google Business Profile authorization.',
    );
  }
}
