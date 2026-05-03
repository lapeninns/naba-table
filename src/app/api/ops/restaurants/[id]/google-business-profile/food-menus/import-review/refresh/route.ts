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
import { refreshFoodMenusImportReviewFromGoogle } from '@/server/google-business-profile/food-menus-sync';
import { getGoogleBusinessProfileFoodMenusContext } from '@/server/google-business-profile/service';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-food-menus-import-review-refresh',
  );
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof FoodMenusImportReviewRefreshRequestSchema>;
  try {
    payload = FoodMenusImportReviewRefreshRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(invalidPayloadResponse(error), { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
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

    return NextResponse.json({
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
    console.error('[ops][gbp][food-menus][import-review][refresh] failed', error);
    const message =
      error instanceof Error ? error.message : 'Unable to refresh Google FoodMenus import review.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
