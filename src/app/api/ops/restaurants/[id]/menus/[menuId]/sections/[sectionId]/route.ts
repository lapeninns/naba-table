import { NextResponse } from 'next/server';

import {
  deleteRestaurantMenuSection,
  updateRestaurantMenuSection,
} from '@/server/menu-hierarchy/repository';
import { RestaurantMenuSectionPatchSchema } from '@/server/menu-hierarchy/types';

import {
  invalidJson,
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveMenuParams,
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
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId', 'sectionId']);
  if (route.response) return route.response;

  const body = await readJsonBody(request);
  if (!body) return invalidJson();

  const parsed = RestaurantMenuSectionPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const section = await updateRestaurantMenuSection(
      access.restaurantId,
      route.values.menuId,
      route.values.sectionId,
      parsed.data,
    );
    return NextResponse.json({ section });
  } catch (error) {
    return routeError('PATCH section', error, 'Unable to update the menu section.');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId', 'sectionId']);
  if (route.response) return route.response;

  try {
    await deleteRestaurantMenuSection(
      access.restaurantId,
      route.values.menuId,
      route.values.sectionId,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE section', error, 'Unable to delete the menu section.');
  }
}

export const runtime = 'nodejs';
