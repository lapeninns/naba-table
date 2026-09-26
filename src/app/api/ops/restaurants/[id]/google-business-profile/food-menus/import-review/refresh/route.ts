import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  FoodMenusImportReviewRefreshRequestSchema,
  invalidPayloadResponse,
} from '@/app/api/ops/restaurants/[id]/google-business-profile/food-menus/_shared';
import { internalError } from '@/lib/api/errors';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { captureSafeGbpException } from '@/server/dual-sync/retention/telemetry';
import { refreshFoodMenusImportReviewFromGoogle } from '@/server/google-business-profile/food-menus-sync';
import { getGoogleBusinessProfileFoodMenusContext } from '@/server/google-business-profile/service';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return gbpNoStoreJson({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-food-menus-import-review-refresh',
    request,
  );
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  let payload: z.infer<typeof FoodMenusImportReviewRefreshRequestSchema>;
  try {
    payload = FoodMenusImportReviewRefreshRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return gbpNoStoreJson(invalidPayloadResponse(error), { status: 400 });
    }
    return gbpNoStoreJson({ error: 'Invalid payload' }, { status: 400 });
  }

  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: 'food-menus-import-refresh',
  });
  if (rateLimit) {
    return gbpNoStoreResponse(rateLimit);
  }

  const client = getServiceSupabaseClient();
  try {
    const context = await getGoogleBusinessProfileFoodMenusContext({
      client,
      restaurantId,
    });
    const result = await refreshFoodMenusImportReviewFromGoogle({
      client,
      restaurantId,
      accessToken: context.accessToken,
      foodMenusName: context.foodMenusName,
      externalProfileId: context.externalProfileId,
      projectionSnapshotId: payload.projectionSnapshotId,
      createdByUserId: access.userId,
      persist: payload.persist,
    });

    return gbpNoStoreJson({
      googleFoodMenusHash: result.googleFoodMenusHash,
      canHaveFoodMenus: context.canHaveFoodMenus,
      googleFoodMenus: result.googleFoodMenus,
      localItemCount: result.importReview.localItemCount,
      previousIdentityCount: result.importReview.previousIdentityCount,
      projectionSnapshotId: result.importReview.projectionSnapshotId,
      googleSnapshot: result.importReview.googleSnapshot,
      review: result.importReview.review,
      rows: result.importReview.rows,
      persisted: Boolean(result.importReview.googleSnapshot || result.importReview.rows.length > 0),
    });
  } catch (error) {
    captureSafeGbpException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'gbp-food-menus-import-review-refresh' },
    });
    return gbpNoStoreResponse(
      internalError(
        error,
        {
          route:
            '/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/refresh',
          restaurantId,
        },
        'Unable to refresh Google FoodMenus import review.',
      ),
    );
  }
}

export const runtime = 'nodejs';
