import { NextResponse } from 'next/server';

import { getRequestOrigin } from '@/app/api/ops/google-business-profile/_origin';
import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { captureRestaurantServerEvent, captureServerException } from '@/lib/posthog/server';
import { setGoogleBusinessProfileOAuthStateCookie } from '@/server/google-business-profile/oauth-state-cookie';
import { createGoogleBusinessProfileAuthorization } from '@/server/google-business-profile/service';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

const SETTINGS_RETURN_PATH = '/app/settings/restaurant/google-business-profile';

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to start Google Business Profile authorization.' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return access;
  }

  captureRestaurantServerEvent('gbp_authorization_started', {
    restaurantId,
    distinctId: access.userId,
    props: { source: 'ops' },
  });

  try {
    const authorization = await createGoogleBusinessProfileAuthorization({
      restaurantId,
      requestedByUserId: access.userId,
      returnPath: new URL(SETTINGS_RETURN_PATH, getRequestOrigin(req)).toString(),
    });

    const response = NextResponse.json({ authorizationUrl: authorization.authorizationUrl });
    setGoogleBusinessProfileOAuthStateCookie(response, authorization.stateToken);
    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to start Google Business Profile authorization.';

    captureRestaurantServerEvent('gbp_authorization_failed', {
      restaurantId,
      distinctId: access.userId,
      props: { source: 'ops' },
    });
    captureServerException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: {
        source: 'ops',
        path: '/api/ops/restaurants/[id]/google-business-profile/connect',
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
