import { NextResponse } from 'next/server';

import { prepareMenuImport } from '@/server/menu/import';
import { applyMenuImport } from '@/server/menu/repository';
import { getServiceSupabaseClient } from '@/server/supabase';

import { ensureRestaurantAdminAccess, resolveRestaurantId } from '../../_shared';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const auth = await ensureRestaurantAdminAccess(restaurantId, 'menu');
  if (auth instanceof NextResponse) {
    return auth;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const mode = String(formData.get('mode') ?? 'preview').toLowerCase();
  const itemsFile = formData.get('items');
  const modifierGroupsFile = formData.get('modifierGroups');
  const modifierOptionsFile = formData.get('modifierOptions');

  if (!(itemsFile instanceof File)) {
    return NextResponse.json({ error: 'items CSV is required' }, { status: 400 });
  }

  const [itemsText, modifierGroupsText, modifierOptionsText] = await Promise.all([
    itemsFile.text(),
    modifierGroupsFile instanceof File ? modifierGroupsFile.text() : Promise.resolve(null),
    modifierOptionsFile instanceof File ? modifierOptionsFile.text() : Promise.resolve(null),
  ]);

  try {
    const prepared = await prepareMenuImport(
      restaurantId,
      {
        itemsText,
        modifierGroupsText,
        modifierOptionsText,
      },
      getServiceSupabaseClient(),
    );

    if (mode !== 'apply') {
      return NextResponse.json(prepared.preview);
    }

    if (!prepared.preview.canApply) {
      return NextResponse.json(prepared.preview, { status: 400 });
    }

    await applyMenuImport(restaurantId, {
      items: prepared.items,
      modifierGroups: prepared.modifierGroups,
      modifierOptions: prepared.modifierOptions,
      replaceModifiers: prepared.replaceModifiers,
    });

    return NextResponse.json({
      applied: true,
      canApply: true,
      summary: prepared.preview.summary,
      errors: [],
    });
  } catch (error) {
    console.error('[ops][menu][import][POST] failed', error);
    return NextResponse.json({ error: 'Unable to process menu import' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
