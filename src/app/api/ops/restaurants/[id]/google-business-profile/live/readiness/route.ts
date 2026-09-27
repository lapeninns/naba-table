import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { readGoogleBusinessProfileRetentionStatus } from '@/server/google-business-profile/serviceLiveConnection';
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
  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-retention-readiness',
  );
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);
  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: 'retention-readiness-read',
    limit: 60,
  });
  if (rateLimit) return gbpNoStoreResponse(rateLimit);
  return gbpNoStoreJson(await readGoogleBusinessProfileRetentionStatus(getServiceSupabaseClient()));
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
