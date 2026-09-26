import { NextResponse } from 'next/server';

import { createRestaurantMenuSection } from '@/server/menu-hierarchy/repository';
import { RestaurantMenuSectionInputSchema } from '@/server/menu-hierarchy/types';

import {
  invalidJson,
  invalidPayload,
  readJsonBody,
  requireMenusAdmin,
  resolveMenuParams,
  routeError,
} from '../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; menuId: string | string[] }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const route = await resolveMenuParams(params, ['menuId']);
  if (route.response) return route.response;

  const body = await readJsonBody(request);
  if (!body) return invalidJson();

  const parsed = RestaurantMenuSectionInputSchema.safeParse(body);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const section = await createRestaurantMenuSection(
      access.restaurantId,
      route.values.menuId,
      parsed.data,
    );
    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    return routeError('POST section', error, 'Unable to create the menu section.');
  }
}

export const runtime = 'nodejs';
