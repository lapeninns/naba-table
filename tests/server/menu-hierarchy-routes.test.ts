import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authGetUserMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const listRestaurantMenuHierarchyMock = vi.hoisted(() => vi.fn());
const createRestaurantMenuMock = vi.hoisted(() => vi.fn());
const createRestaurantMenuItemMock = vi.hoisted(() => vi.fn());
const updateRestaurantMenuOptionMock = vi.hoisted(() => vi.fn());
const deleteRestaurantMenuOptionMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: authGetUserMock,
    },
  })),
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/server/menu-hierarchy/repository', () => ({
  createRestaurantMenu: createRestaurantMenuMock,
  createRestaurantMenuItem: createRestaurantMenuItemMock,
  deleteRestaurantMenuOption: deleteRestaurantMenuOptionMock,
  listRestaurantMenuHierarchy: listRestaurantMenuHierarchyMock,
  updateRestaurantMenuOption: updateRestaurantMenuOptionMock,
}));

import {
  DELETE as deleteOption,
  PATCH as patchOption,
} from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/[itemId]/options/[optionId]/route';
import { POST as postMenuItem } from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/route';
import { GET as getMenus, POST as postMenu } from '@/src/app/api/ops/restaurants/[id]/menus/route';

describe('ops hierarchy menus routes', () => {
  beforeEach(() => {
    authGetUserMock.mockReset();
    requireAdminMembershipMock.mockReset();
    listRestaurantMenuHierarchyMock.mockReset();
    createRestaurantMenuMock.mockReset();
    createRestaurantMenuItemMock.mockReset();
    updateRestaurantMenuOptionMock.mockReset();
    deleteRestaurantMenuOptionMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await getMenus(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/menus'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(401);
    expect(listRestaurantMenuHierarchyMock).not.toHaveBeenCalled();
  });

  it('lists canonical hierarchy menus for an authorized operator', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    listRestaurantMenuHierarchyMock.mockResolvedValue({
      menus: [{ id: 'menu-1', restaurantId: 'rest-1', sections: [] }],
    });

    const response = await getMenus(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/menus'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(listRestaurantMenuHierarchyMock).toHaveBeenCalledWith('rest-1');
    await expect(response.json()).resolves.toMatchObject({
      menus: [{ id: 'menu-1' }],
    });
  });

  it('creates a canonical menu with Google labels and Nabatable menu kind', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    createRestaurantMenuMock.mockResolvedValue({
      id: 'menu-1',
      restaurantId: 'rest-1',
      menuKind: 'mixed',
    });

    const response = await postMenu(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/menus', {
        method: 'POST',
        body: JSON.stringify({
          labels: [{ displayName: 'All day', languageCode: 'en-GB' }],
          menuKind: 'mixed',
          sourceUrl: 'https://example.com/menu',
          cuisines: ['INDIAN'],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(201);
    expect(createRestaurantMenuMock).toHaveBeenCalledWith(
      'rest-1',
      expect.objectContaining({
        menuKind: 'mixed',
        labels: [expect.objectContaining({ displayName: 'All day', languageCode: 'en-GB' })],
      }),
    );
  });

  it('rejects local image URLs in Google media keys for canonical items', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);

    const response = await postMenuItem(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items',
        {
          method: 'POST',
          body: JSON.stringify({
            itemKind: 'food',
            externalItemId: 'starter-paneer',
            labels: [{ displayName: 'Chilli Paneer', languageCode: 'en-GB' }],
            media: {
              googleMediaKeys: ['https://cdn.example.com/chilli-paneer.jpg'],
            },
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: 'rest-1',
          menuId: 'menu-1',
          sectionId: 'section-1',
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(createRestaurantMenuItemMock).not.toHaveBeenCalled();
  });

  it('updates and deletes options inside the authorized restaurant scope', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    updateRestaurantMenuOptionMock.mockResolvedValue({ id: 'option-1', active: false });
    deleteRestaurantMenuOptionMock.mockResolvedValue(undefined);

    const params = Promise.resolve({
      id: 'rest-1',
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
      optionId: 'option-1',
    });
    const patchResponse = await patchOption(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1/options/option-1',
        { method: 'PATCH', body: JSON.stringify({ active: false }) },
      ),
      { params },
    );

    expect(patchResponse.status).toBe(200);
    expect(updateRestaurantMenuOptionMock).toHaveBeenCalledWith(
      'rest-1',
      'menu-1',
      'section-1',
      'item-1',
      'option-1',
      expect.objectContaining({ active: false }),
    );

    const deleteResponse = await deleteOption(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1/options/option-1',
        { method: 'DELETE' },
      ),
      {
        params: Promise.resolve({
          id: 'rest-1',
          menuId: 'menu-1',
          sectionId: 'section-1',
          itemId: 'item-1',
          optionId: 'option-1',
        }),
      },
    );

    expect(deleteResponse.status).toBe(200);
    expect(deleteRestaurantMenuOptionMock).toHaveBeenCalledWith(
      'rest-1',
      'menu-1',
      'section-1',
      'item-1',
      'option-1',
    );
  });
});
