import { NextResponse } from 'next/server';

import { createRestaurantMenuOption } from '@/server/menu-hierarchy/repository';
import { RestaurantMenuOptionInputSchema } from '@/server/menu-hierarchy/types';

import {
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveRouteParam,
  routeError,
} from '../../../../../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    menuId: string | string[];
    sectionId: string | string[];
    itemId: string | string[];
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  const [menuId, sectionId, itemId] = await Promise.all([
    resolveRouteParam(params, 'menuId'),
    resolveRouteParam(params, 'sectionId'),
    resolveRouteParam(params, 'itemId'),
  ]);
  if (!menuId) return NextResponse.json({ error: 'Missing menu id' }, { status: 400 });
  if (!sectionId) return NextResponse.json({ error: 'Missing section id' }, { status: 400 });
  if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const parsed = RestaurantMenuOptionInputSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error.flatten());

  try {
    const option = await createRestaurantMenuOption(
      access.restaurantId,
      menuId,
      sectionId,
      itemId,
      parsed.data,
    );
    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return routeError('POST option', error, 'Unable to create menu item option');
  }
}

export const runtime = 'nodejs';
