import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  FoodMenusProjectionRequestSchema,
  invalidPayloadResponse,
} from '@/app/api/ops/restaurants/[id]/google-business-profile/food-menus/_shared';
import { prepareFoodMenusProjection } from '@/server/google-business-profile/food-menus-sync';
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
    'google-business-profile-food-menus-projection',
  );
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof FoodMenusProjectionRequestSchema>;
  try {
    payload = FoodMenusProjectionRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(invalidPayloadResponse(error), { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const result = await prepareFoodMenusProjection({
      client: getServiceSupabaseClient(),
      restaurantId,
      foodMenusName: payload.foodMenusName,
      menuLabel: payload.menuLabel,
      sourceUrl: payload.sourceUrl,
      languageCode: payload.languageCode,
      includeUnavailable: payload.includeUnavailable,
      cuisines: payload.cuisines,
      createdByUserId: access.userId,
      persist: payload.persist,
    });

    return NextResponse.json({
      localItemCount: result.localItemCount,
      projectionHash: result.projectionHash,
      projection: result.projection,
      snapshot: result.snapshot,
      identities: result.identities,
      persisted: Boolean(result.snapshot),
    });
  } catch (error) {
    console.error('[ops][gbp][food-menus][projection] failed', error);
    const message =
      error instanceof Error ? error.message : 'Unable to prepare Google FoodMenus projection.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
