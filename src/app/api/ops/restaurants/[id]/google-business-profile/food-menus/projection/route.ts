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
import { internalError } from '@/lib/api/errors';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { captureSafeGbpException } from '@/server/dual-sync/retention/telemetry';
import { prepareFoodMenusProjection } from '@/server/google-business-profile/food-menus-sync';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
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
    'google-business-profile-food-menus-projection',
    request,
  );
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  let payload: z.infer<typeof FoodMenusProjectionRequestSchema>;
  try {
    payload = FoodMenusProjectionRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return gbpNoStoreJson(invalidPayloadResponse(error), { status: 400 });
    }
    return gbpNoStoreJson({ error: 'Invalid payload' }, { status: 400 });
  }

  const rateLimitResponse = await requireApiRateLimit({
    request,
    scope: 'ops.gbp.food_menus.projection',
    tenantId: restaurantId,
    userId: access.userId,
    limit: 12,
    windowMs: 60_000,
    message: 'Too many FoodMenus projection requests',
  });
  if (rateLimitResponse) {
    return gbpNoStoreResponse(rateLimitResponse);
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

    return gbpNoStoreJson({
      localItemCount: result.localItemCount,
      projectionHash: result.projectionHash,
      projection: result.projection,
      snapshot: result.snapshot,
      identities: result.identities,
      persisted: Boolean(result.snapshot),
    });
  } catch (error) {
    captureSafeGbpException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'gbp-food-menus-projection' },
    });
    return gbpNoStoreResponse(
      internalError(
        error,
        {
          route: '/api/ops/restaurants/[id]/google-business-profile/food-menus/projection',
          restaurantId,
        },
        'Unable to prepare Google FoodMenus projection.',
      ),
    );
  }
}

export const runtime = 'nodejs';
