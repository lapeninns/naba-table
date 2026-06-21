import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { deleteZone, updateZone } from '@/server/ops/zones';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

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
      return NextResponse.json({ error: 'Unauthorized', message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = routeParamsSchema.parse(await context.params);
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const updates = parsed.data;

    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .select('id, restaurant_id')
      .eq('id', id)
      .maybeSingle();

    if (zoneError || !zone) {
      return NextResponse.json(
        { error: 'Zone not found', message: 'Zone not found' },
        { status: 404 },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_memberships')
      .select('role')
      .eq('restaurant_id', zone.restaurant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to this restaurant', message: 'Access denied to this restaurant' },
        { status: 403 },
      );
    }

    if (!isRestaurantAdminRole(membership.role)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions for zone management',
          message: 'Insufficient permissions for zone management',
        },
        { status: 403 },
      );
    }

    const trimmedName = updates.name?.trim();
    if (updates.name !== undefined && trimmedName?.length === 0) {
      return NextResponse.json(
        { error: 'Zone name cannot be blank', message: 'Zone name cannot be blank' },
        { status: 400 },
      );
    }

    try {
      const updated = await updateZone(supabase, id, {
        name: trimmedName ?? undefined,
        sortOrder: updates.sortOrder,
        active: updates.active,
      });

      return NextResponse.json({ zone: updated });
    } catch (error) {
      console.error('[ops/zones][PATCH] Update error', { error, zoneId: id });
      captureServerException(error, {
        distinctId: user.id,
        groups: { restaurant: zone.restaurant_id },
        properties: { restaurantId: zone.restaurant_id, source: 'ops', kind: 'ops-zone' },
      });
      return NextResponse.json(
        { error: 'Failed to update zone', message: 'Failed to update zone' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('[ops/zones][PATCH] Unexpected error', { error });
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-zone' },
    });
    return NextResponse.json(
      { error: 'An unexpected error occurred', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(_req, () => deleteZoneRoute(_req, context));
}

async function deleteZoneRoute(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = routeParamsSchema.parse(await context.params);

    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .select('id, restaurant_id')
      .eq('id', id)
      .maybeSingle();

    if (zoneError || !zone) {
      return NextResponse.json(
        { error: 'Zone not found', message: 'Zone not found' },
        { status: 404 },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_memberships')
      .select('role')
      .eq('restaurant_id', zone.restaurant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to this restaurant', message: 'Access denied to this restaurant' },
        { status: 403 },
      );
    }

    if (!isRestaurantAdminRole(membership.role)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions for zone management',
          message: 'Insufficient permissions for zone management',
        },
        { status: 403 },
      );
    }

    try {
      await deleteZone(supabase, id);
      return NextResponse.json({ success: true });
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error && 'code' in error
          ? (error as { code?: string }).code
          : undefined;

      if (errorCode === '23503') {
        return NextResponse.json(
          {
            error: 'Zone is still in use by existing tables',
            message: 'Zone is still in use by existing tables',
          },
          { status: 409 },
        );
      }

      console.error('[ops/zones][DELETE] Delete error', { error, zoneId: id });
      captureServerException(error, {
        distinctId: user.id,
        groups: { restaurant: zone.restaurant_id },
        properties: { restaurantId: zone.restaurant_id, source: 'ops', kind: 'ops-zone' },
      });
      return NextResponse.json(
        { error: 'Failed to delete zone', message: 'Failed to delete zone' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('[ops/zones][DELETE] Unexpected error', { error });
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-zone' },
    });
    return NextResponse.json(
      { error: 'An unexpected error occurred', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
