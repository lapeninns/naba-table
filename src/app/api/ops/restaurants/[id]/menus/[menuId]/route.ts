import { NextResponse } from 'next/server';

import { deleteRestaurantMenu, updateRestaurantMenu } from '@/server/menu-hierarchy/repository';
import { RestaurantMenuPatchSchema } from '@/server/menu-hierarchy/types';

import {
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveRouteParam,
  routeError,
} from '../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; menuId: string | string[] }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const menuId = await resolveRouteParam(params, 'menuId');
  if (!menuId) return NextResponse.json({ error: 'Missing menu id' }, { status: 400 });

  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const parsed = RestaurantMenuPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error.flatten());

  try {
    const menu = await updateRestaurantMenu(access.restaurantId, menuId, parsed.data);
    return NextResponse.json({ menu });
  } catch (error) {
    return routeError('PATCH menu', error, 'Unable to update menu');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, _request);
  if (access.response) return access.response;

  const menuId = await resolveRouteParam(params, 'menuId');
  if (!menuId) return NextResponse.json({ error: 'Missing menu id' }, { status: 400 });

  try {
    await deleteRestaurantMenu(access.restaurantId, menuId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE menu', error, 'Unable to delete menu');
  }
}

export const runtime = 'nodejs';
