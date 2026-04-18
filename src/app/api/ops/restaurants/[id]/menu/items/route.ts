import { NextResponse } from 'next/server';

import { listMenuItems, upsertMenuItem } from '@/server/menu/repository';
import { MenuItemUpsertInputSchema, MenuListFiltersSchema } from '@/server/menu/types';

import { ensureRestaurantAdminAccess, resolveRestaurantId } from '../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'menu');
  if (auth instanceof NextResponse) {
    return auth;
  }

  const searchParams = request.nextUrl.searchParams;
  const parsedFilters = MenuListFiltersSchema.safeParse({
    search: searchParams.get('search'),
    category: searchParams.get('category'),
    subcategory: searchParams.get('subcategory'),
    status: searchParams.get('status') ?? 'all',
  });

  if (!parsedFilters.success) {
    return NextResponse.json({ error: 'Invalid filters', details: parsedFilters.error.flatten() }, { status: 400 });
  }

  try {
    const result = await listMenuItems(restaurantId, parsedFilters.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops][menu][items][GET] failed', error);
    return NextResponse.json({ error: 'Unable to load menu items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'menu');
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = MenuItemUpsertInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await upsertMenuItem(restaurantId, parsed.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('[ops][menu][items][POST] failed', error);
    return NextResponse.json({ error: 'Unable to save menu item' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
