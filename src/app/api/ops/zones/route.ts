import { NextResponse } from 'next/server';
import { z } from 'zod';

import { forbidden, internalError, unauthenticated, validationError } from '@/lib/api/errors';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { captureServerException } from '@/lib/posthog/server';
import { createZone, listZones } from '@/server/ops/zones';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import { postgresCode, zoneNameBlank, zoneNameTaken, zoneRoleForbidden } from './_errors';

import type { NextRequest } from 'next/server';

const ROUTE = 'ops/zones';

const querySchema = z.object({
  restaurantId: z.string().uuid(),
});

const createSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthenticated();
    }

    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(searchParams);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { restaurantId } = parsed.data;

    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_memberships')
      .select('role')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return forbidden();
    }

    try {
      const zones = await listZones(supabase, restaurantId);
      return NextResponse.json({ zones });
    } catch (error) {
      captureServerException(error, {
        distinctId: user.id,
        groups: { restaurant: restaurantId },
        properties: { restaurantId, source: 'ops', kind: 'ops-zones' },
      });
      return internalError(error, { route: ROUTE, method: 'GET', restaurantId });
    }
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-zones' },
    });
    return internalError(error, { route: ROUTE, method: 'GET' });
  }
}

export async function POST(req: NextRequest) {
  return withCsrfProtectedMutation(req, () => postZone(req));
}

async function postZone(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthenticated();
    }

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const data = parsed.data;

    const trimmedName = data.name.trim();
    if (trimmedName.length === 0) {
      return zoneNameBlank();
    }

    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_memberships')
      .select('role')
      .eq('restaurant_id', data.restaurantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return forbidden();
    }

    if (!isRestaurantAdminRole(membership.role)) {
      return zoneRoleForbidden();
    }

    try {
      const zone = await createZone(supabase, {
        restaurantId: data.restaurantId,
        name: trimmedName,
        sortOrder: data.sortOrder ?? 0,
        active: data.active ?? true,
      });
      return NextResponse.json({ zone }, { status: 201 });
    } catch (error) {
      if (postgresCode(error) === '23505') {
        return zoneNameTaken();
      }
      captureServerException(error, {
        distinctId: user.id,
        groups: { restaurant: data.restaurantId },
        properties: { restaurantId: data.restaurantId, source: 'ops', kind: 'ops-zones' },
      });
      return internalError(error, {
        route: ROUTE,
        method: 'POST',
        restaurantId: data.restaurantId,
      });
    }
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-zones' },
    });
    return internalError(error, { route: ROUTE, method: 'POST' });
  }
}
