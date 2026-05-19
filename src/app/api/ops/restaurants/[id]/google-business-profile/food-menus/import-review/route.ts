import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  FoodMenusImportReviewRequestSchema,
  invalidPayloadResponse,
} from '@/app/api/ops/restaurants/[id]/google-business-profile/food-menus/_shared';
import { listPendingFoodMenusImportReviews } from '@/server/google-business-profile/food-menus-storage';
import { prepareFoodMenusImportReview } from '@/server/google-business-profile/food-menus-sync';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-food-menus-import-review',
  );
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    const rows = await listPendingFoodMenusImportReviews({
      client: getServiceSupabaseClient(),
      restaurantId,
    });

    return NextResponse.json({
      rows,
      pendingCount: rows.length,
    });
  } catch (error) {
    console.error('[ops][gbp][food-menus][import-review][list] failed', error);
    const message =
      error instanceof Error ? error.message : 'Unable to list Google FoodMenus import reviews.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-food-menus-import-review',
    request,
  );
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof FoodMenusImportReviewRequestSchema>;
  try {
    payload = FoodMenusImportReviewRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(invalidPayloadResponse(error), { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const result = await prepareFoodMenusImportReview({
      client: getServiceSupabaseClient(),
      restaurantId,
      googleFoodMenus: payload.googleFoodMenus,
      googleSnapshotId: payload.googleSnapshotId,
      projectionSnapshotId: payload.projectionSnapshotId,
      createdByUserId: access.userId,
      persist: payload.persist,
    });

    return NextResponse.json({
      localItemCount: result.localItemCount,
      previousIdentityCount: result.previousIdentityCount,
      projectionSnapshotId: result.projectionSnapshotId,
      googleSnapshot: result.googleSnapshot,
      review: result.review,
      rows: result.rows,
      persisted: Boolean(result.googleSnapshot || result.rows.length > 0),
    });
  } catch (error) {
    console.error('[ops][gbp][food-menus][import-review] failed', error);
    const message =
      error instanceof Error ? error.message : 'Unable to prepare Google FoodMenus import review.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
