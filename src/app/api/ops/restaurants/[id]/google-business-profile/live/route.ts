import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import { classifyGoogleBusinessProfileRouteError } from '@/server/google-business-profile/routeErrors';
import { readGoogleBusinessProfileLiveConnection } from '@/server/google-business-profile/serviceLiveConnection';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId)
    return gbpNoStoreJson(
      { error: 'Missing restaurant id', code: 'INVALID_RESTAURANT_ID' },
      { status: 400 },
    );
  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile-live');
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);
  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: 'live-connection-read',
    limit: 10,
  });
  if (rateLimit) return gbpNoStoreResponse(rateLimit);
  try {
    return gbpNoStoreJson(
      await readGoogleBusinessProfileLiveConnection(restaurantId, getServiceSupabaseClient()),
    );
  } catch (error) {
    if (
      error instanceof GoogleBusinessProfileError &&
      error.code === 'GBP_LIVE_CONNECTION_CHANGED'
    ) {
      return gbpNoStoreJson(
        { error: 'The linked Google connection changed. Check again.', code: error.code },
        { status: 409 },
      );
    }
    const known = classifyGoogleBusinessProfileRouteError(error, 'read');
    return gbpNoStoreJson(
      {
        error: known?.message ?? 'Unable to verify the live Google connection. Try again.',
        code: known?.code ?? 'GBP_LIVE_CONNECTION_FAILED',
      },
      { status: known?.status ?? 502 },
    );
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
