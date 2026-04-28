import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { isGoogleBusinessProfileError } from '@/server/google-business-profile/errors';

export type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function requireGoogleBusinessAdminAccess(params: RouteContext['params']) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business');
  if (access instanceof NextResponse) {
    return access;
  }

  return { restaurantId, access };
}

export function googleBusinessErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = isGoogleBusinessProfileError(error) ? error.status : 500;
  const code = isGoogleBusinessProfileError(error) ? error.code : 'GBP_ERROR';

  return NextResponse.json({ error: message, code }, { status });
}
