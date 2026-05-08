import { NextResponse } from 'next/server';

import {
  deleteRestaurantMenuItem,
  updateRestaurantMenuItem,
} from '@/server/menu-hierarchy/repository';
import { RestaurantMenuItemPatchSchema } from '@/server/menu-hierarchy/types';

import {
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveRouteParam,
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  const itemId = await resolveRouteParam(params, 'itemId');
  if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const parsed = RestaurantMenuItemPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error.flatten());

  try {
    const item = await updateRestaurantMenuItem(access.restaurantId, itemId, parsed.data);
    return NextResponse.json({ item });
  } catch (error) {
    return routeError('PATCH item', error, 'Unable to update menu item');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  const itemId = await resolveRouteParam(params, 'itemId');
  if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

  try {
    await deleteRestaurantMenuItem(access.restaurantId, itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE item', error, 'Unable to delete menu item');
  }
}

export const runtime = 'nodejs';
