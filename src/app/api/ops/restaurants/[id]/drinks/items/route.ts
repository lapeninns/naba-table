import { NextResponse } from 'next/server';

import { listDrinkItems, upsertDrinkItem } from '@/server/drinks-menu/repository';
import { DrinkItemUpsertInputSchema, DrinkListFiltersSchema } from '@/server/drinks-menu/types';

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

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'drinks');
  if (auth instanceof NextResponse) {
    return auth;
  }

  const searchParams = request.nextUrl.searchParams;
  const parsedFilters = DrinkListFiltersSchema.safeParse({
    search: searchParams.get('search'),
    category: searchParams.get('category'),
    subcategory: searchParams.get('subcategory'),
    status: searchParams.get('status') ?? 'all',
  });

  if (!parsedFilters.success) {
    return NextResponse.json({ error: 'Invalid filters', details: parsedFilters.error.flatten() }, { status: 400 });
  }

  try {
    const result = await listDrinkItems(restaurantId, parsedFilters.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops][drinks][items][GET] failed', error);
    return NextResponse.json({ error: 'Unable to load drink items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'drinks');
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = DrinkItemUpsertInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await upsertDrinkItem(restaurantId, parsed.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('[ops][drinks][items][POST] failed', error);
    return NextResponse.json({ error: 'Unable to save drink item' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
