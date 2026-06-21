import { NextResponse } from 'next/server';

import { getRequestOrigin } from '@/app/api/ops/google-business-profile/_origin';
import { setGoogleBusinessProfileOAuthStateCookie } from '@/server/google-business-profile/oauth-state-cookie';
import { createGoogleBusinessProfileAuthorization } from '@/server/google-business-profile/service';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from '../_shared';

import type { NextRequest } from 'next/server';

const SETTINGS_RETURN_PATH = '/app/settings/restaurant/google-business-profile';

export async function POST(req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params, req);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  try {
    const authorization = await createGoogleBusinessProfileAuthorization({
      restaurantId: resolved.restaurantId,
      requestedByUserId: resolved.access.userId,
      returnPath: new URL(SETTINGS_RETURN_PATH, getRequestOrigin(req)).toString(),
    });

    const response = NextResponse.json({ authorizationUrl: authorization.authorizationUrl });
    setGoogleBusinessProfileOAuthStateCookie(response, authorization.stateToken);
    return response;
  } catch (error) {
    return googleBusinessErrorResponse(
      error,
      'Unable to start Google Business Profile authorization.',
    );
  }
}
