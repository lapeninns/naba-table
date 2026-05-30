import { NextResponse } from 'next/server';

import {
  deleteRestaurantMenuOption,
  updateRestaurantMenuOption,
} from '@/server/menu-hierarchy/repository';
import { RestaurantMenuOptionPatchSchema } from '@/server/menu-hierarchy/types';

import {
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveRouteParam,
  routeError,
} from '../../../../../../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    menuId: string | string[];
    sectionId: string | string[];
    itemId: string | string[];
    optionId: string | string[];
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const [menuId, sectionId, itemId, optionId] = await Promise.all([
    resolveRouteParam(params, 'menuId'),
    resolveRouteParam(params, 'sectionId'),
    resolveRouteParam(params, 'itemId'),
    resolveRouteParam(params, 'optionId'),
  ]);
  if (!menuId) return NextResponse.json({ error: 'Missing menu id' }, { status: 400 });
  if (!sectionId) return NextResponse.json({ error: 'Missing section id' }, { status: 400 });
  if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
  if (!optionId) return NextResponse.json({ error: 'Missing option id' }, { status: 400 });

  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const parsed = RestaurantMenuOptionPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error.flatten());

  try {
    const option = await updateRestaurantMenuOption(
      access.restaurantId,
      menuId,
      sectionId,
      itemId,
      optionId,
      parsed.data,
    );
    return NextResponse.json({ option });
  } catch (error) {
    return routeError('PATCH option', error, 'Unable to update menu item option');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, _request);
  if (access.response) return access.response;

  const [menuId, sectionId, itemId, optionId] = await Promise.all([
    resolveRouteParam(params, 'menuId'),
    resolveRouteParam(params, 'sectionId'),
    resolveRouteParam(params, 'itemId'),
    resolveRouteParam(params, 'optionId'),
  ]);
  if (!menuId) return NextResponse.json({ error: 'Missing menu id' }, { status: 400 });
  if (!sectionId) return NextResponse.json({ error: 'Missing section id' }, { status: 400 });
  if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
  if (!optionId) return NextResponse.json({ error: 'Missing option id' }, { status: 400 });

  try {
    await deleteRestaurantMenuOption(access.restaurantId, menuId, sectionId, itemId, optionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE option', error, 'Unable to delete menu item option');
  }
}

export const runtime = 'nodejs';
