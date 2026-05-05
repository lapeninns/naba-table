import { NextResponse } from 'next/server';
import { z } from 'zod';

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { createZone } from '@/server/ops/zones';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const zoneSchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const requestSchema = z.object({
  zones: z.array(zoneSchema),
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
    const client = getServiceSupabaseClient();
    const created = await Promise.all(
      parsed.data.zones.map((zone, index) =>
        createZone(client, {
          restaurantId,
          name: zone.name,
          sortOrder: zone.sortOrder ?? index,
          active: zone.active ?? true,
        }),
      ),
    );
    return NextResponse.json({ zones: created }, { status: 201 });
  } catch (creationError) {
    console.error('[onboarding][zones][POST]', creationError);
    const message =
      creationError instanceof Error ? creationError.message : 'Unable to create zones';
    return NextResponse.json({ message }, { status: 500 });
  }
}
