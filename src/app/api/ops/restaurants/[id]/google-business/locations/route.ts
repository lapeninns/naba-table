import { NextResponse } from 'next/server';

import { getGoogleBusinessProfileConnectionState } from '@/server/google-business-profile/service';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from '../_shared';

import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  try {
    const state = await getGoogleBusinessProfileConnectionState(resolved.restaurantId);
    return NextResponse.json({ locations: state.availableLocations });
  } catch (error) {
    return googleBusinessErrorResponse(error, 'Unable to list Google Business Profile locations.');
  }
}
