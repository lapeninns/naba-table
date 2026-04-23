import { NextResponse } from 'next/server';

import { getRequestOrigin } from '@/app/api/ops/google-business-profile/_origin';
import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { createGoogleBusinessProfileAuthorizationUrl } from '@/server/google-business-profile/service';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

const SETTINGS_RETURN_PATH = '/app/settings/restaurant/google-business-profile';

export async function GET(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile');
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    const authorizationUrl = await createGoogleBusinessProfileAuthorizationUrl({
      restaurantId,
      requestedByUserId: access.userId,
      returnPath: new URL(SETTINGS_RETURN_PATH, getRequestOrigin(req)).toString(),
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to start Google Business Profile authorization.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
