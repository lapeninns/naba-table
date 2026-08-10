import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { getGoogleBusinessProfileConnectionState } from '@/server/google-business-profile/service';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return gbpNoStoreJson(
      { error: 'Missing restaurant id', code: 'INVALID_RESTAURANT_ID' },
      { status: 400 },
    );
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile-details');
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);

  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: 'connection-details-read',
    limit: 60,
  });
  if (rateLimit) return gbpNoStoreResponse(rateLimit);

  try {
    const state = await getGoogleBusinessProfileConnectionState(restaurantId);
    return gbpNoStoreJson(state);
  } catch {
    return gbpNoStoreJson(
      {
        error: 'Unable to load Google Business Profile details.',
        code: 'GBP_CONNECTION_DETAILS_FAILED',
      },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
