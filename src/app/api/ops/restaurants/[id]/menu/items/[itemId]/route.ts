import { NextResponse } from 'next/server';

import { getMenuItemDetail, itemExistsForRestaurant, upsertMenuItem } from '@/server/menu/repository';
import { MenuItemUpsertInputSchema } from '@/server/menu/types';

import { ensureRestaurantAdminAccess, resolveRestaurantId } from '../../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; itemId: string | string[] }>;
};

async function resolveItemId(paramsPromise: RouteContext['params']): Promise<string | null> {
  const params = await paramsPromise;
  const value = params.itemId;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  const itemId = await resolveItemId(params);
  if (!restaurantId || !itemId) {
    return NextResponse.json({ error: 'Missing route params' }, { status: 400 });
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'menu');
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const item = await getMenuItemDetail(restaurantId, itemId);
    if (!item) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    console.error('[ops][menu][item][GET] failed', error);
    return NextResponse.json({ error: 'Unable to load menu item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  const itemId = await resolveItemId(params);
  if (!restaurantId || !itemId) {
    return NextResponse.json({ error: 'Missing route params' }, { status: 400 });
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'menu');
  if (auth instanceof NextResponse) {
    return auth;
  }

  let existing = false;
  try {
    existing = await itemExistsForRestaurant(restaurantId, itemId);
  } catch (error) {
    console.error('[ops][menu][item][PUT] failed to check existing item', error);
    return NextResponse.json({ error: 'Unable to verify menu item' }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
  }

  const current = await getMenuItemDetail(restaurantId, itemId).catch((error) => {
    console.error('[ops][menu][item][PUT] failed to load current item', error);
    return null;
  });

  if (!current) {
    return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = MenuItemUpsertInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.externalItemId !== current.externalItemId) {
    return NextResponse.json({ error: 'externalItemId cannot be changed' }, { status: 400 });
  }

  try {
    const item = await upsertMenuItem(restaurantId, parsed.data);
    return NextResponse.json({ item });
  } catch (error) {
    console.error('[ops][menu][item][PUT] failed', error);
    return NextResponse.json({ error: 'Unable to update menu item' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
