import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: vi.fn(() => {
    throw new Error('tests pass an explicit client');
  }),
}));

import { MenuHierarchyError } from '@/server/menu-hierarchy/errors';
import {
  createRestaurantMenuItem,
  createRestaurantMenuItemIdempotent,
  createRestaurantMenuOption,
  createRestaurantMenuSection,
  reorderRestaurantMenuChildren,
  updateRestaurantMenuItem,
} from '@/server/menu-hierarchy/repository';
import {
  RestaurantMenuItemInputSchema,
  RestaurantMenuItemPatchSchema,
  RestaurantMenuOptionInputSchema,
  RestaurantMenuSectionInputSchema,
} from '@/server/menu-hierarchy/types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT = '00000000-0000-4000-8000-00000000a001';
const MENU = '00000000-0000-4000-8000-000000000101';
const SECTION = '00000000-0000-4000-8000-000000000201';
const ITEM = '00000000-0000-4000-8000-000000000301';

type RpcResult = { data: unknown; error: unknown };

function fakeClient(result: RpcResult) {
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => result);
  const client = { rpc } as unknown as SupabaseClient<Database>;
  return { client, rpc };
}

const itemRow = {
  id: ITEM,
  restaurant_id: RESTAURANT,
  menu_id: MENU,
  section_id: SECTION,
  item_kind: 'food',
  external_item_id: 'ops:1',
  item_name: 'Paneer',
  category: 'Starters',
  subcategory: null,
  base_price: 9.5,
  currency: 'GBP',
  display_order: 3,
  active: true,
  labels: [{ displayName: 'Paneer', languageCode: 'en-GB' }],
  google_attributes: { price: { amount: 9.5, currencyCode: 'GBP' }, spiciness: 'MILD' },
  google_media_keys: [],
  local_media: {},
  image_url: null,
  legacy_source: {},
  created_at: '2026-09-26T00:00:00Z',
  updated_at: '2026-09-26T00:00:00Z',
};

const snapshot = {
  item: itemRow,
  extension: {
    restaurant_id: RESTAURANT,
    menu_item_id: ITEM,
    drink_profile: {},
    recommendation_metadata: {},
    availability_policy: { soldOut: true, servicePeriods: ['lunch'] },
    customization_controls: {},
    source_metadata: {},
    created_at: '2026-09-26T00:00:00Z',
    updated_at: '2026-09-26T00:00:00Z',
  },
  options: [
    {
      id: 'opt-1',
      restaurant_id: RESTAURANT,
      menu_item_id: ITEM,
      external_option_id: 'large',
      labels: [{ displayName: 'Large', languageCode: 'en-GB' }],
      google_attributes: {},
      google_media_keys: [],
      display_order: 0,
      active: true,
      legacy_source: {},
      created_at: '2026-09-26T00:00:00Z',
      updated_at: '2026-09-26T00:00:00Z',
    },
  ],
};

describe('createRestaurantMenuItem', () => {
  it('creates the item, extensions and options in one RPC with the idempotency key', async () => {
    const { client, rpc } = fakeClient({ data: { ...snapshot, replayed: false }, error: null });
    const input = RestaurantMenuItemInputSchema.parse({
      itemKind: 'food',
      externalItemId: 'ops:1',
      labels: [{ displayName: 'Paneer' }],
      attributes: { price: { amount: 9.5, currencyCode: 'GBP' } },
      extensions: { availabilityPolicy: { soldOut: true } },
      options: [{ externalOptionId: 'large', labels: [{ displayName: 'Large' }] }],
      idempotencyKey: 'c0ffee00-0000-4000-8000-000000000001',
    });

    const result = await createRestaurantMenuItemIdempotent(
      RESTAURANT,
      MENU,
      SECTION,
      input,
      client,
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe('create_restaurant_menu_item_v1');
    expect(args).toMatchObject({
      p_restaurant_id: RESTAURANT,
      p_menu_id: MENU,
      p_section_id: SECTION,
      p_idempotency_key: 'c0ffee00-0000-4000-8000-000000000001',
    });
    const item = args.p_item as Record<string, unknown>;
    expect(item).toMatchObject({
      item_kind: 'food',
      external_item_id: 'ops:1',
      item_name: 'Paneer',
    });
    // No displayOrder from the client: the server appends.
    expect(item).not.toHaveProperty('display_order');
    // DB label check rejects a non-string description: nulls are dropped before the write.
    expect(item.labels).toEqual([{ displayName: 'Paneer', languageCode: 'en-GB' }]);
    expect(args.p_extensions).toMatchObject({ availability_policy: { soldOut: true } });
    expect(args.p_options).toEqual([
      expect.objectContaining({
        external_option_id: 'large',
        labels: [{ displayName: 'Large', languageCode: 'en-GB' }],
      }),
    ]);

    expect(result.replayed).toBe(false);
    expect(result.item).toMatchObject({
      id: ITEM,
      displayOrder: 3,
      extensions: { availabilityPolicy: { soldOut: true, servicePeriods: ['lunch'] } },
      options: [expect.objectContaining({ id: 'opt-1', externalOptionId: 'large' })],
    });
  });

  it('reports a replayed create and keeps the plain export returning the item', async () => {
    const { client } = fakeClient({ data: { ...snapshot, replayed: true }, error: null });
    const input = RestaurantMenuItemInputSchema.parse({
      itemKind: 'food',
      externalItemId: 'ops:1',
    });

    await expect(
      createRestaurantMenuItemIdempotent(RESTAURANT, MENU, SECTION, input, client),
    ).resolves.toMatchObject({ replayed: true });
    await expect(
      createRestaurantMenuItem(RESTAURANT, MENU, SECTION, input, client),
    ).resolves.toMatchObject({ id: ITEM });
  });

  it.each([
    [{ code: 'P0002', message: 'menu_section_not_found' }, 'not_found'],
    [{ code: 'P0001', message: 'menu_idempotency_key_reused' }, 'idempotency_key_reused'],
    [{ code: '23505', message: 'duplicate key value violates unique constraint' }, 'duplicate'],
    [{ code: '23514', message: 'violates check constraint' }, 'invalid_argument'],
  ])('maps database error %o to a %s domain error', async (dbError, kind) => {
    const { client } = fakeClient({ data: null, error: dbError });
    const input = RestaurantMenuItemInputSchema.parse({
      itemKind: 'food',
      externalItemId: 'ops:1',
    });

    const error = await createRestaurantMenuItem(RESTAURANT, MENU, SECTION, input, client).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(MenuHierarchyError);
    expect((error as MenuHierarchyError).kind).toBe(kind);
  });

  it('passes unknown database errors through untouched', async () => {
    const dbError = { code: '57014', message: 'canceling statement due to statement timeout' };
    const { client } = fakeClient({ data: null, error: dbError });
    const input = RestaurantMenuItemInputSchema.parse({
      itemKind: 'food',
      externalItemId: 'ops:1',
    });

    await expect(createRestaurantMenuItem(RESTAURANT, MENU, SECTION, input, client)).rejects.toBe(
      dbError,
    );
  });
});

describe('updateRestaurantMenuItem', () => {
  it('sends merge patches separately from replacement values and returns the full item', async () => {
    const { client, rpc } = fakeClient({ data: snapshot, error: null });
    const patch = RestaurantMenuItemPatchSchema.parse({
      active: false,
      attributesMerge: { price: { amount: 9.5, currencyCode: 'GBP' } },
      extensionsMerge: { availabilityPolicy: { soldOut: true } },
    });

    const item = await updateRestaurantMenuItem(RESTAURANT, MENU, SECTION, ITEM, patch, client);

    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe('update_restaurant_menu_item_v1');
    expect(args).toEqual({
      p_restaurant_id: RESTAURANT,
      p_menu_id: MENU,
      p_section_id: SECTION,
      p_item_id: ITEM,
      p_set: { active: false },
      p_attributes_merge: { price: { amount: 9.5, currencyCode: 'GBP' } },
      p_extensions: null,
      p_extensions_merge: { availability_policy: { soldOut: true } },
    });
    // The canonical response carries options and extensions (the old update returned neither).
    expect(item.options).toHaveLength(1);
    expect(item.extensions.availabilityPolicy).toEqual({
      soldOut: true,
      servicePeriods: ['lunch'],
    });
  });

  it('keeps full replacement semantics for attributes and extensions', async () => {
    const { client, rpc } = fakeClient({ data: snapshot, error: null });
    const patch = RestaurantMenuItemPatchSchema.parse({
      labels: [{ displayName: 'Paneer tikka' }],
      attributes: { price: { amount: 10, currencyCode: 'GBP' } },
      extensions: {},
      media: { googleMediaKeys: [], localImageUrl: null },
    });

    await updateRestaurantMenuItem(RESTAURANT, MENU, SECTION, ITEM, patch, client);

    const args = rpc.mock.calls[0]![1];
    expect(args.p_set).toMatchObject({
      labels: [{ displayName: 'Paneer tikka', languageCode: 'en-GB' }],
      item_name: 'Paneer tikka',
      short_description: null,
      google_attributes: expect.objectContaining({ price: { amount: 10, currencyCode: 'GBP' } }),
      google_media_keys: [],
      local_media: {},
      image_url: null,
    });
    expect(args.p_attributes_merge).toBeNull();
    expect(args.p_extensions).toEqual({
      drink_profile: {},
      recommendation_metadata: {},
      availability_policy: {},
      customization_controls: {},
      source_metadata: {},
    });
  });

  it('maps a missing item to a not_found domain error', async () => {
    const { client } = fakeClient({
      data: null,
      error: { code: 'P0002', message: 'menu_item_not_found' },
    });

    await expect(
      updateRestaurantMenuItem(RESTAURANT, MENU, SECTION, ITEM, { active: true }, client),
    ).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('section and option creates', () => {
  it('lets the server assign the section display order', async () => {
    const { client, rpc } = fakeClient({
      data: {
        id: SECTION,
        restaurant_id: RESTAURANT,
        menu_id: MENU,
        labels: [{ displayName: 'Mains', languageCode: 'en-GB' }],
        display_order: 4,
        active: true,
        legacy_category: 'Mains',
        legacy_subcategory: null,
        legacy_source: {},
        created_at: '',
        updated_at: '',
      },
      error: null,
    });

    const section = await createRestaurantMenuSection(
      RESTAURANT,
      MENU,
      RestaurantMenuSectionInputSchema.parse({ labels: [{ displayName: 'Mains' }] }),
      client,
    );

    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe('create_restaurant_menu_section_v1');
    expect(args.p_section).not.toHaveProperty('display_order');
    expect(section.displayOrder).toBe(4);
  });

  it('keeps an explicit option display order and lets the server append otherwise', async () => {
    const { client, rpc } = fakeClient({ data: snapshot.options[0], error: null });

    await createRestaurantMenuOption(
      RESTAURANT,
      MENU,
      SECTION,
      ITEM,
      RestaurantMenuOptionInputSchema.parse({ displayOrder: 7 }),
      client,
    );
    await createRestaurantMenuOption(
      RESTAURANT,
      MENU,
      SECTION,
      ITEM,
      RestaurantMenuOptionInputSchema.parse({}),
      client,
    );

    expect(rpc.mock.calls[0]![0]).toBe('create_restaurant_menu_item_option_v1');
    expect(rpc.mock.calls[0]![1].p_option).toMatchObject({ display_order: 7 });
    expect(rpc.mock.calls[1]![1].p_option).not.toHaveProperty('display_order');
  });
});

describe('reorderRestaurantMenuChildren', () => {
  const ids = ['00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b'];
  const order = [
    { id: ids[0], displayOrder: 0 },
    { id: ids[1], displayOrder: 1 },
  ];

  it.each([
    [
      { level: 'sections', menuId: MENU } as const,
      'reorder_restaurant_menu_sections_v1',
      { p_restaurant_id: RESTAURANT, p_menu_id: MENU, p_ordered_ids: ids },
    ],
    [
      { level: 'items', menuId: MENU, sectionId: SECTION } as const,
      'reorder_restaurant_menu_items_v1',
      { p_restaurant_id: RESTAURANT, p_menu_id: MENU, p_section_id: SECTION, p_ordered_ids: ids },
    ],
    [
      { level: 'options', menuId: MENU, sectionId: SECTION, itemId: ITEM } as const,
      'reorder_restaurant_menu_item_options_v1',
      {
        p_restaurant_id: RESTAURANT,
        p_menu_id: MENU,
        p_section_id: SECTION,
        p_item_id: ITEM,
        p_ordered_ids: ids,
      },
    ],
  ])('calls one RPC per level (%o)', async (target, fn, args) => {
    const { client, rpc } = fakeClient({ data: order, error: null });

    await expect(reorderRestaurantMenuChildren(RESTAURANT, target, ids, client)).resolves.toEqual(
      order,
    );
    expect(rpc).toHaveBeenCalledWith(fn, args);
  });

  it('maps a stale order to an order_stale domain error', async () => {
    const { client } = fakeClient({
      data: null,
      error: { code: 'P0001', message: 'menu_order_stale' },
    });

    await expect(
      reorderRestaurantMenuChildren(RESTAURANT, { level: 'sections', menuId: MENU }, ids, client),
    ).rejects.toMatchObject({ kind: 'order_stale' });
  });
});
