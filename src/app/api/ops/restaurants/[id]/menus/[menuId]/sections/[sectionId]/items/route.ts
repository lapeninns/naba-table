import { NextResponse } from 'next/server';

import { createRestaurantMenuItem } from '@/server/menu-hierarchy/repository';
import { RestaurantMenuItemInputSchema } from '@/server/menu-hierarchy/types';

import {
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveRouteParam,
  routeError,
} from '../../../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    menuId: string | string[];
    sectionId: string | string[];
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
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

  const parsed = RestaurantMenuItemInputSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error.flatten());

  try {
    const item = await createRestaurantMenuItem(
      access.restaurantId,
      menuId,
      sectionId,
      parsed.data,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return routeError('POST item', error, 'Unable to create menu item');
  }
}

export const runtime = 'nodejs';
