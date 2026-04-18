import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { createGoogleBusinessProfileAuthorizationUrl } from '@/server/google-business-profile/service';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

const SETTINGS_RETURN_PATH = '/settings/restaurant/google-business-profile';

function getAppOrigin(req: NextRequest): string {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const protocol = forwardedProto ?? req.nextUrl.protocol.replace(/:$/, '');
  const hostHeader = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const [hostname, port] = hostHeader.split(':');
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost').toLowerCase();
  const appHostname =
    hostname?.startsWith('app.')
      ? hostname
      : rootDomain === 'localhost'
        ? 'app.localhost'
        : `app.${rootDomain}`;

  return `${protocol}://${port ? `${appHostname}:${port}` : appHostname}`;
}

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
      returnPath: new URL(SETTINGS_RETURN_PATH, getAppOrigin(req)).toString(),
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
