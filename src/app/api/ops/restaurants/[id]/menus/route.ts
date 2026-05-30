import { NextResponse } from 'next/server';

import {
  createRestaurantMenu,
  listRestaurantMenuHierarchy,
} from '@/server/menu-hierarchy/repository';
import { RestaurantMenuInputSchema } from '@/server/menu-hierarchy/types';

import { invalidPayload, readJsonBody, requireMenusAdmin, routeError } from './_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params);
  if (access.response) return access.response;

  try {
    const result = await listRestaurantMenuHierarchy(access.restaurantId);
    return NextResponse.json(result);
  } catch (error) {
    return routeError('GET', error, 'Unable to load menus');
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireMenusAdmin(params, request);
  if (access.response) return access.response;

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RestaurantMenuInputSchema.safeParse(body);
  if (!parsed.success) {
    return invalidPayload(parsed.error.flatten());
  }

  try {
    const menu = await createRestaurantMenu(access.restaurantId, parsed.data);
    return NextResponse.json({ menu }, { status: 201 });
  } catch (error) {
    return routeError('POST', error, 'Unable to create menu');
  }
}

export const runtime = 'nodejs';
