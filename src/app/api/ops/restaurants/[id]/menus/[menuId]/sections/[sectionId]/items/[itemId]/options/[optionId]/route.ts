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
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  const optionId = await resolveRouteParam(params, 'optionId');
  if (!optionId) return NextResponse.json({ error: 'Missing option id' }, { status: 400 });

  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const parsed = RestaurantMenuOptionPatchSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error.flatten());

  try {
    const option = await updateRestaurantMenuOption(access.restaurantId, optionId, parsed.data);
    return NextResponse.json({ option });
  } catch (error) {
    return routeError('PATCH option', error, 'Unable to update menu item option');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  const optionId = await resolveRouteParam(params, 'optionId');
  if (!optionId) return NextResponse.json({ error: 'Missing option id' }, { status: 400 });

  try {
    await deleteRestaurantMenuOption(access.restaurantId, optionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError('DELETE option', error, 'Unable to delete menu item option');
  }
}

export const runtime = 'nodejs';
