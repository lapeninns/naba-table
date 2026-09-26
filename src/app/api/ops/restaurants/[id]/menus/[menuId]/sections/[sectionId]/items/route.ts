import { NextResponse } from 'next/server';

import { createRestaurantMenuItemIdempotent } from '@/server/menu-hierarchy/repository';
import { RestaurantMenuItemInputSchema } from '@/server/menu-hierarchy/types';

import {
  invalidJson,
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveMenuParams,
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

/**
 * Creates the item, its extensions and optional `options[]` in one transaction. With an
 * `idempotencyKey`, a retry returns the item the first request created (200 instead of 201).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId', 'sectionId']);
  if (route.response) return route.response;

  const body = await readJsonBody(request);
  if (!body) return invalidJson();

  const parsed = RestaurantMenuItemInputSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const { item, replayed } = await createRestaurantMenuItemIdempotent(
      access.restaurantId,
      route.values.menuId,
      route.values.sectionId,
      parsed.data,
    );
    return NextResponse.json({ item }, { status: replayed ? 200 : 201 });
  } catch (error) {
    return routeError('POST item', error, 'Unable to create the menu item.');
  }
}

export const runtime = 'nodejs';
