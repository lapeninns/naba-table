import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  FoodMenusImportReviewDecisionRequestSchema,
  invalidPayloadResponse,
} from '@/app/api/ops/restaurants/[id]/google-business-profile/food-menus/_shared';
import { decideFoodMenusImportReview } from '@/server/google-business-profile/food-menus-sync';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; reviewId: string | string[] }>;
};

async function resolveReviewId(paramsPromise: RouteContext['params']): Promise<string | null> {
  const params = await paramsPromise;
  const { reviewId } = params;
  if (typeof reviewId === 'string') return reviewId;
  if (Array.isArray(reviewId)) return reviewId[0] ?? null;
  return null;
}

function decisionErrorResponse(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.name === 'GBP_FOOD_MENUS_REVIEW_NOT_FOUND') {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 404 });
    }
    if (
      error.name === 'GBP_FOOD_MENUS_REVIEW_ALREADY_DECIDED' ||
      error.name === 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE' ||
      error.name === 'GBP_FOOD_MENUS_MENU_ITEM_NOT_FOUND'
    ) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 409 });
    }
  }

  const message =
    error instanceof Error ? error.message : 'Unable to decide Google FoodMenus import review.';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const [restaurantId, reviewId] = await Promise.all([
    resolveRestaurantId(params),
    resolveReviewId(params),
  ]);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }
  if (!reviewId) {
    return NextResponse.json({ error: 'Missing review id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-food-menus-import-review-decision',
  );
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof FoodMenusImportReviewDecisionRequestSchema>;
  try {
    payload = FoodMenusImportReviewDecisionRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(invalidPayloadResponse(error), { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const result = await decideFoodMenusImportReview({
      client: getServiceSupabaseClient(),
      restaurantId,
      reviewId,
      action: payload.action,
      decidedByUserId: access.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops][gbp][food-menus][import-review-decision] failed', error);
    return decisionErrorResponse(error);
  }
}

export const runtime = 'nodejs';
