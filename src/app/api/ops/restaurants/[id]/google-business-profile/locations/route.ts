import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { safeBool } from '@/lib/api/query-params';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { getGoogleBusinessProfileAvailableLocations } from '@/server/google-business-profile/service';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';

import type { NextRequest } from 'next/server';

type RouteContext = { readonly params: Promise<{ readonly id: string | string[] }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return gbpNoStoreJson(
      { error: 'Missing restaurant id', code: 'INVALID_RESTAURANT_ID' },
      { status: 400 },
    );
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-locations',
  );
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);

  const forceRefresh = safeBool(request.nextUrl.searchParams, 'refresh', false);
  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: forceRefresh ? 'location-discovery-refresh' : 'location-discovery-read',
    limit: forceRefresh ? undefined : 30,
  });
  if (rateLimit) return gbpNoStoreResponse(rateLimit);

  try {
    const locations = await getGoogleBusinessProfileAvailableLocations(restaurantId, undefined, {
      forceRefresh,
    });
    return gbpNoStoreJson({ locations });
  } catch {
    return gbpNoStoreJson(
      {
        error: 'Unable to list Google Business Profile locations.',
        code: 'GBP_LOCATION_DISCOVERY_FAILED',
      },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
