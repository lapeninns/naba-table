import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
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
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { count, error: countError } = await authorization.supabase
      .from('zones')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId);

    if (countError) {
      return NextResponse.json({ message: 'Unable to verify zone capacity' }, { status: 500 });
    }

    if ((count ?? 0) + parsed.data.zones.length > MAX_RESTAURANT_ZONES) {
      return NextResponse.json(
        { message: `Restaurants can have at most ${MAX_RESTAURANT_ZONES} zones.` },
        { status: 400 },
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
    console.error('[onboarding][zones][POST]', creationError);
    captureServerException(creationError, {
      distinctId: authorization.user.id,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'api', kind: 'onboarding-zones' },
    });
    const message =
      creationError instanceof Error ? creationError.message : 'Unable to create zones';
    return NextResponse.json({ message }, { status: 500 });
  }
}
