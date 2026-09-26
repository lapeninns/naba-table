import { NextResponse } from 'next/server';

import { createRestaurantMenuOption } from '@/server/menu-hierarchy/repository';
import { RestaurantMenuOptionInputSchema } from '@/server/menu-hierarchy/types';

import {
  invalidJson,
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveMenuParams,
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
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId', 'sectionId', 'itemId']);
  if (route.response) return route.response;

  const body = await readJsonBody(request);
  if (!body) return invalidJson();

  const parsed = RestaurantMenuOptionInputSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const option = await createRestaurantMenuOption(
      access.restaurantId,
      route.values.menuId,
      route.values.sectionId,
      route.values.itemId,
      parsed.data,
    );
    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return routeError('POST option', error, 'Unable to create the item option.');
  }
}

export const runtime = 'nodejs';
