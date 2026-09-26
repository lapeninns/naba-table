import { NextResponse } from 'next/server';

import {
  deleteRestaurantMenuItem,
  updateRestaurantMenuItem,
} from '@/server/menu-hierarchy/repository';
import { RestaurantMenuItemPatchSchema } from '@/server/menu-hierarchy/types';

import {
  invalidJson,
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveMenuParams,
  routeError,
} from '../../../../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    menuId: string | string[];
    sectionId: string | string[];
    itemId: string | string[];
  }>;
};

/**
 * `attributes` / `extensions` replace stored values; `attributesMerge` / `extensionsMerge`
 * merge only the keys sent, so partial edits keep concurrent changes to other fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId', 'sectionId', 'itemId']);
  if (route.response) return route.response;

  const body = await readJsonBody(request);
  if (!body) return invalidJson();

  const parsed = RestaurantMenuItemPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const item = await updateRestaurantMenuItem(
      access.restaurantId,
      route.values.menuId,
      route.values.sectionId,
      route.values.itemId,
      parsed.data,
    );
    return NextResponse.json({ item });
  } catch (error) {
    return routeError('PATCH item', error, 'Unable to update the menu item.');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId', 'sectionId', 'itemId']);
  if (route.response) return route.response;

  try {
    await deleteRestaurantMenuItem(
      access.restaurantId,
      route.values.menuId,
      route.values.sectionId,
      route.values.itemId,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE item', error, 'Unable to delete the menu item.');
  }
}

export const runtime = 'nodejs';
