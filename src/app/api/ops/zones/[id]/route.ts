import { NextResponse } from 'next/server';
import { z } from 'zod';

import { forbidden, internalError, unauthenticated, validationError } from '@/lib/api/errors';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { captureServerException } from '@/lib/posthog/server';
import { deleteZone, updateZone } from '@/server/ops/zones';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import {
  postgresCode,
  zoneInUse,
  zoneNameBlank,
  zoneNameTaken,
  zoneNotFound,
  zoneRoleForbidden,
} from '../_errors';

import type { NextRequest } from 'next/server';

const ROUTE = 'ops/zones/[id]';

const routeParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
  active: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RouteSupabase = Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;

/**
 * Loads the zone through RLS and checks the caller is an owner or manager of its restaurant.
 * An id that is malformed or not visible is a 404, never a hint that it exists elsewhere.
 */
async function authorizeZoneAdmin(
  supabase: RouteSupabase,
  userId: string,
  rawParams: { id: string },
): Promise<{ ok: true; zoneId: string; restaurantId: string } | { ok: false; response: Response }> {
  const params = routeParamsSchema.safeParse(rawParams);
  if (!params.success) {
    return { ok: false, response: zoneNotFound() };
  }
  const zoneId = params.data.id;

  const { data: zone, error: zoneError } = await supabase
    .from('zones')
    .select('id, restaurant_id')
    .eq('id', zoneId)
    .maybeSingle();

  if (zoneError || !zone) {
    return { ok: false, response: zoneNotFound() };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('restaurant_memberships')
    .select('role')
    .eq('restaurant_id', zone.restaurant_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError || !membership) {
    return { ok: false, response: forbidden() };
  }

  if (!isRestaurantAdminRole(membership.role)) {
    return { ok: false, response: zoneRoleForbidden() };
  }

  return { ok: true, zoneId, restaurantId: zone.restaurant_id };
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(req, () => patchZone(req, context));
}

async function patchZone(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthenticated();
    }

    const rawParams = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const updates = parsed.data;
    const access = await authorizeZoneAdmin(supabase, user.id, rawParams);
    if (!access.ok) {
      return access.response;
    }

    const trimmedName = updates.name?.trim();
    if (updates.name !== undefined && trimmedName?.length === 0) {
      return zoneNameBlank();
    }

    try {
      const updated = await updateZone(supabase, access.zoneId, {
        name: trimmedName ?? undefined,
        sortOrder: updates.sortOrder,
        active: updates.active,
      });

      return NextResponse.json({ zone: updated });
    } catch (error) {
      if (postgresCode(error) === '23505') {
        return zoneNameTaken();
      }
      captureServerException(error, {
        distinctId: user.id,
        groups: { restaurant: access.restaurantId },
        properties: { restaurantId: access.restaurantId, source: 'ops', kind: 'ops-zone' },
      });
      return internalError(error, {
        route: ROUTE,
        method: 'PATCH',
        restaurantId: access.restaurantId,
        zoneId: access.zoneId,
      });
    }
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-zone' },
    });
    return internalError(error, { route: ROUTE, method: 'PATCH' });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(_req, () => deleteZoneRoute(context));
}

async function deleteZoneRoute(context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthenticated();
    }

    const access = await authorizeZoneAdmin(supabase, user.id, await context.params);
    if (!access.ok) {
      return access.response;
    }

    try {
      await deleteZone(supabase, access.zoneId);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (postgresCode(error) === '23503') {
        return zoneInUse();
      }
      captureServerException(error, {
        distinctId: user.id,
        groups: { restaurant: access.restaurantId },
        properties: { restaurantId: access.restaurantId, source: 'ops', kind: 'ops-zone' },
      });
      return internalError(error, {
        route: ROUTE,
        method: 'DELETE',
        restaurantId: access.restaurantId,
        zoneId: access.zoneId,
      });
    }
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-zone' },
    });
    return internalError(error, { route: ROUTE, method: 'DELETE' });
  }
}
