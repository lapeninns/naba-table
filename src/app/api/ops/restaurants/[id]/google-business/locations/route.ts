import { NextResponse } from 'next/server';

import { safeBool } from '@/lib/api/query-params';
import { getGoogleBusinessProfileAvailableLocations } from '@/server/google-business-profile/service';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from '../_shared';

import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  const forceRefresh = safeBool(req.nextUrl.searchParams, 'refresh', false);
  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId: resolved.restaurantId,
    action: forceRefresh ? 'location-discovery-refresh' : 'location-discovery-read',
    limit: forceRefresh ? undefined : 30,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const locations = await getGoogleBusinessProfileAvailableLocations(
      resolved.restaurantId,
      undefined,
      {
        forceRefresh,
      },
    );
    return NextResponse.json({ locations });
  } catch (error) {
    return googleBusinessErrorResponse(error, 'Unable to list Google Business Profile locations.');
  }
}
