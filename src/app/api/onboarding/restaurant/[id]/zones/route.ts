import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, validationError } from '@/lib/api/errors';
import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { onboardingInternalError } from '@/server/onboarding/errors';
import { createZone } from '@/server/ops/zones';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_ONBOARDING_ZONES = 25;
const MAX_RESTAURANT_ZONES = 75;

const zoneSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
});

const requestSchema = z.object({
  zones: z.array(zoneSchema).max(MAX_ONBOARDING_ZONES),
});

export async function POST(req: NextRequest, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const authorization = await withRestaurantAuthorization(req, restaurantId, {
    csrf: true,
    roles: RESTAURANT_ADMIN_ROLES,
  });
  if (!authorization.ok) {
    return authorization.response;
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'onboarding:zones',
    tenantId: restaurantId,
    userId: authorization.user.id,
    limit: 10,
    windowMs: 60_000,
    message: 'Too many onboarding zone updates. Please try again in a moment.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const { count, error: countError } = await authorization.supabase
      .from('zones')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId);

    if (countError) {
      return onboardingInternalError(countError, {
        route: 'onboarding.restaurant.zones',
        restaurantId,
        userId: authorization.user.id,
      });
    }

    if ((count ?? 0) + parsed.data.zones.length > MAX_RESTAURANT_ZONES) {
      return apiError(
        400,
        'ZONE_LIMIT_EXCEEDED',
        `Restaurants can have at most ${MAX_RESTAURANT_ZONES} zones.`,
      );
    }

    const client = getServiceSupabaseClient();
    const created = [];
    for (const [index, zone] of parsed.data.zones.entries()) {
      created.push(
        await createZone(client, {
          restaurantId,
          name: zone.name,
          sortOrder: zone.sortOrder ?? index,
          active: zone.active ?? true,
        }),
      );
    }
    return NextResponse.json({ zones: created }, { status: 201 });
  } catch (creationError) {
    return onboardingInternalError(creationError, {
      route: 'onboarding.restaurant.zones',
      restaurantId,
      userId: authorization.user.id,
    });
  }
}
