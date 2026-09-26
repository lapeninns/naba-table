import { NextResponse } from 'next/server';

import { reorderRestaurantMenuChildren } from '@/server/menu-hierarchy/repository';
import { MenuReorderSchema } from '@/server/menu-hierarchy/types';

import {
  invalidJson,
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveMenuParams,
  routeError,
} from './_shared';

import type { MenuReorderTarget } from '@/server/menu-hierarchy/repository';
import type { NextRequest } from 'next/server';

type RouteParams = Promise<Record<string, string | string[]>>;

/**
 * Shared handler for `PATCH …/order` at every level. One command renumbers the parent's
 * children 0..n-1 in one transaction and returns `{ data: { order } }`.
 */
export async function reorderMenuChildrenRoute(
  request: NextRequest,
  params: RouteParams,
  level: MenuReorderTarget['level'],
) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  let target: MenuReorderTarget;
  if (level === 'sections') {
    const route = await resolveMenuParams(params, ['menuId']);
    if (route.response) return route.response;
    target = { level, menuId: route.values.menuId };
  } else if (level === 'items') {
    const route = await resolveMenuParams(params, ['menuId', 'sectionId']);
    if (route.response) return route.response;
    target = { level, menuId: route.values.menuId, sectionId: route.values.sectionId };
  } else {
    const route = await resolveMenuParams(params, ['menuId', 'sectionId', 'itemId']);
    if (route.response) return route.response;
    target = {
      level,
      menuId: route.values.menuId,
      sectionId: route.values.sectionId,
      itemId: route.values.itemId,
    };
  }

  const body = await readJsonBody(request);
  if (!body) return invalidJson();

  const parsed = MenuReorderSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const order = await reorderRestaurantMenuChildren(
      access.restaurantId,
      target,
      parsed.data.orderedIds,
    );
    return NextResponse.json({ data: { order } });
  } catch (error) {
    return routeError(`PATCH ${level} order`, error, 'Unable to save the new order.');
  }
}
