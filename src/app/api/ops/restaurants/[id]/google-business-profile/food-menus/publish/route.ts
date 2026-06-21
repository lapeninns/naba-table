import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  FoodMenusPublishRequestSchema,
  invalidPayloadResponse,
} from '@/app/api/ops/restaurants/[id]/google-business-profile/food-menus/_shared';
import { publishFoodMenusProjectionToGoogle } from '@/server/google-business-profile/food-menus-sync';
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
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-food-menus-publish',
    request,
  );
  if (access instanceof NextResponse) {
    return access;
  }

  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: 'food-menus-publish',
  });
  if (rateLimit) {
    return rateLimit;
  }

  let payload: z.infer<typeof FoodMenusPublishRequestSchema>;
  try {
    payload = FoodMenusPublishRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(invalidPayloadResponse(error), { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const client = getServiceSupabaseClient();
  let canHaveFoodMenus: boolean | null = null;
  try {
    const context = await getGoogleBusinessProfileFoodMenusContext({
      client,
      restaurantId,
      requirePushEnabled: true,
    });
    canHaveFoodMenus = context.canHaveFoodMenus;
    const result = await publishFoodMenusProjectionToGoogle({
      client,
      restaurantId,
      accessToken: context.accessToken,
      foodMenusName: context.foodMenusName,
      menuLabel: payload.menuLabel,
      sourceUrl: payload.sourceUrl,
      languageCode: payload.languageCode,
      includeUnavailable: payload.includeUnavailable,
      cuisines: payload.cuisines,
      externalProfileId: context.externalProfileId,
      createdByUserId: access.userId,
      expectedGoogleHash: payload.expectedGoogleHash,
      expectedProjectionHash: payload.expectedProjectionHash,
    });

    return NextResponse.json({
      projectionHash: result.projection.projectionHash,
      baselineGoogleHash: result.baselineGoogleHash,
      canHaveFoodMenus: context.canHaveFoodMenus,
      baselineGoogleSnapshot: result.baselineGoogleSnapshot,
      attempt: result.attempt,
      googleResponse: result.googleResponse,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'GBP_FOOD_MENUS_PREFLIGHT_CHANGED' ||
        error.name === 'GBP_FOOD_MENUS_PROJECTION_CHANGED')
    ) {
      const details = error as Error & {
        baselineGoogleHash?: string;
        expectedGoogleHash?: string;
        projectionHash?: string;
        expectedProjectionHash?: string;
        attempt?: unknown;
      };
      return NextResponse.json(
        {
          error: error.message,
          code: error.name,
          baselineGoogleHash: details.baselineGoogleHash ?? null,
          expectedGoogleHash: details.expectedGoogleHash ?? null,
          projectionHash: details.projectionHash ?? null,
          expectedProjectionHash: details.expectedProjectionHash ?? null,
          canHaveFoodMenus,
          attempt: details.attempt ?? null,
        },
        { status: 409 },
      );
    }

    console.error('[ops][gbp][food-menus][publish] failed', error);
    captureServerException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'gbp-food-menus-publish' },
    });
    const message = error instanceof Error ? error.message : 'Unable to publish Google FoodMenus.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
