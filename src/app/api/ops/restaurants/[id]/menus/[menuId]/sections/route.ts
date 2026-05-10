import { NextResponse } from 'next/server';

import { createRestaurantMenuSection } from '@/server/menu-hierarchy/repository';
import { RestaurantMenuSectionInputSchema } from '@/server/menu-hierarchy/types';

import {
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveRouteParam,
  routeError,
} from '../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; menuId: string | string[] }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  const menuId = await resolveRouteParam(params, 'menuId');
  if (!menuId) return NextResponse.json({ error: 'Missing menu id' }, { status: 400 });

  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const parsed = RestaurantMenuSectionInputSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error.flatten());

  try {
    const section = await createRestaurantMenuSection(access.restaurantId, menuId, parsed.data);
    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    return routeError('POST section', error, 'Unable to create menu section');
  }
}

export const runtime = 'nodejs';
