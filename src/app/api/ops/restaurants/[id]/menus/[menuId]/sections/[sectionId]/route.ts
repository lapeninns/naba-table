import { NextResponse } from 'next/server';

import {
  deleteRestaurantMenuSection,
  updateRestaurantMenuSection,
} from '@/server/menu-hierarchy/repository';
import { RestaurantMenuSectionPatchSchema } from '@/server/menu-hierarchy/types';

import {
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveRouteParam,
  routeError,
} from '../../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    menuId: string | string[];
    sectionId: string | string[];
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  const [menuId, sectionId] = await Promise.all([
    resolveRouteParam(params, 'menuId'),
    resolveRouteParam(params, 'sectionId'),
  ]);
  if (!menuId) return NextResponse.json({ error: 'Missing menu id' }, { status: 400 });
  if (!sectionId) return NextResponse.json({ error: 'Missing section id' }, { status: 400 });

  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const parsed = RestaurantMenuSectionPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error.flatten());

  try {
    const section = await updateRestaurantMenuSection(
      access.restaurantId,
      menuId,
      sectionId,
      parsed.data,
    );
    return NextResponse.json({ section });
  } catch (error) {
    return routeError('PATCH section', error, 'Unable to update menu section');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  const [menuId, sectionId] = await Promise.all([
    resolveRouteParam(params, 'menuId'),
    resolveRouteParam(params, 'sectionId'),
  ]);
  if (!menuId) return NextResponse.json({ error: 'Missing menu id' }, { status: 400 });
  if (!sectionId) return NextResponse.json({ error: 'Missing section id' }, { status: 400 });

  try {
    await deleteRestaurantMenuSection(access.restaurantId, menuId, sectionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE section', error, 'Unable to delete menu section');
  }
}

export const runtime = 'nodejs';
