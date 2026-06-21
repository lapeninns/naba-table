import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { captureServerException } from '@/lib/posthog/server';
import { isGoogleBusinessProfileError } from '@/server/google-business-profile/errors';

import type { NextRequest } from 'next/server';

export type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function requireGoogleBusinessAdminAccess(
  params: RouteContext['params'],
  req?: NextRequest,
) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json(
      { message: 'Missing restaurant id', error: 'Missing restaurant id' },
      { status: 400 },
    );
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business', req);
  if (access instanceof NextResponse) {
    return access;
  }

  return { restaurantId, access };
}

export function googleBusinessErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = isGoogleBusinessProfileError(error) ? error.status : 500;
  const code = isGoogleBusinessProfileError(error) ? error.code : 'GBP_ERROR';

  // Capture only genuine server faults; typed GBP errors are expected outcomes.
  if (!isGoogleBusinessProfileError(error)) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'google-business', status },
    });
  }

  return NextResponse.json({ message, error: message, code }, { status });
}
