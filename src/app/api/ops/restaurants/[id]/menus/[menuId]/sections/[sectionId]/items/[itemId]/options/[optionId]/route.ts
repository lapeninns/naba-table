import { NextResponse } from 'next/server';

import {
  deleteRestaurantMenuOption,
  updateRestaurantMenuOption,
} from '@/server/menu-hierarchy/repository';
import { RestaurantMenuOptionPatchSchema } from '@/server/menu-hierarchy/types';

import {
  invalidJson,
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveMenuParams,
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

const OPTION_PARAMS = ['menuId', 'sectionId', 'itemId', 'optionId'] as const;

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, OPTION_PARAMS);
  if (route.response) return route.response;

  const body = await readJsonBody(request);
  if (!body) return invalidJson();

  const parsed = RestaurantMenuOptionPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const option = await updateRestaurantMenuOption(
      access.restaurantId,
      route.values.menuId,
      route.values.sectionId,
      route.values.itemId,
      route.values.optionId,
      parsed.data,
    );
    return NextResponse.json({ option });
  } catch (error) {
    return routeError('PATCH option', error, 'Unable to update the item option.');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, OPTION_PARAMS);
  if (route.response) return route.response;

  try {
    await deleteRestaurantMenuOption(
      access.restaurantId,
      route.values.menuId,
      route.values.sectionId,
      route.values.itemId,
      route.values.optionId,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE option', error, 'Unable to delete the item option.');
  }
}

export const runtime = 'nodejs';
