import { NextResponse } from 'next/server';

import { deleteRestaurantMenu, updateRestaurantMenu } from '@/server/menu-hierarchy/repository';
import { RestaurantMenuPatchSchema } from '@/server/menu-hierarchy/types';

import {
  invalidJson,
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveMenuParams,
  routeError,
} from '../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; menuId: string | string[] }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId']);
  if (route.response) return route.response;

  const body = await readJsonBody(request);
  if (!body) return invalidJson();

  const parsed = RestaurantMenuPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const menu = await updateRestaurantMenu(access.restaurantId, route.values.menuId, parsed.data);
    return NextResponse.json({ menu });
  } catch (error) {
    return routeError('PATCH menu', error, 'Unable to update the menu.');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId']);
  if (route.response) return route.response;

  try {
    await deleteRestaurantMenu(access.restaurantId, route.values.menuId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE menu', error, 'Unable to delete the menu.');
  }
}

export const runtime = 'nodejs';
