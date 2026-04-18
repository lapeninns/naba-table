import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authGetUserMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const listMenuItemsMock = vi.hoisted(() => vi.fn());
const menuItemExternalIdExistsForRestaurantMock = vi.hoisted(() => vi.fn());
const upsertMenuItemMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/server/menu/repository', () => ({
  listMenuItems: listMenuItemsMock,
  menuItemExternalIdExistsForRestaurant: menuItemExternalIdExistsForRestaurantMock,
  upsertMenuItem: upsertMenuItemMock,
}));

import { GET, POST } from '@/src/app/api/ops/restaurants/[id]/menu/items/route';

describe('ops menu items route', () => {
  beforeEach(() => {
    authGetUserMock.mockReset();
    requireAdminMembershipMock.mockReset();
    listMenuItemsMock.mockReset();
    menuItemExternalIdExistsForRestaurantMock.mockReset();
    upsertMenuItemMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/menu/items'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(401);
  });

  it('returns 403 when membership check fails', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    requireAdminMembershipMock.mockRejectedValue(new Error('forbidden'));

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/menu/items'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
  });

  it('creates a menu item with a valid payload', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    menuItemExternalIdExistsForRestaurantMock.mockResolvedValue(false);
    upsertMenuItemMock.mockResolvedValue({
      id: 'item-1',
      externalItemId: 'starter-burrata',
    });

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/menu/items', {
        method: 'POST',
        body: JSON.stringify({
          externalItemId: 'starter-burrata',
          itemName: 'Burrata',
          category: 'Starters',
          subcategory: null,
          shortDescription: null,
          fullDescription: null,
          basePrice: 9.5,
          currency: 'GBP',
          serviceTime: 'Lunch',
          availabilityStatus: 'available',
          keyIngredients: [],
          mainProteinOrBase: null,
          cookingStyle: null,
          preparationMethod: null,
          flavorProfile: null,
          texture: null,
          spiceLevel: null,
          spiceAdjustable: false,
          portionSize: null,
          shareable: false,
          recommendationTags: [],
          pairings: [],
          signatureScore: null,
          popularityScore: null,
          dietaryTags: [],
          allergensContains: [],
          allergensMayContain: [],
          removableIngredients: [],
          substitutionsAllowed: false,
          canBeMadeVegetarian: false,
          canBeMadeVegan: false,
          canBeMadeGlutenFree: false,
          customizationRules: null,
          servingNotes: null,
          active: true,
          seasonal: false,
          limitedTime: false,
          soldOut: false,
          displayOrder: 10,
          imageUrl: null,
          modifierGroups: [],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(201);
    expect(upsertMenuItemMock).toHaveBeenCalledWith(
      'rest-1',
      expect.objectContaining({
        externalItemId: 'starter-burrata',
        itemName: 'Burrata',
      }),
    );
  });

  it('returns 409 when a create payload reuses an existing external item id', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    menuItemExternalIdExistsForRestaurantMock.mockResolvedValue(true);

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/menu/items', {
        method: 'POST',
        body: JSON.stringify({
          externalItemId: 'starter-burrata',
          itemName: 'Burrata',
          category: 'Starters',
          basePrice: 9.5,
          currency: 'GBP',
          availabilityStatus: 'available',
          keyIngredients: [],
          recommendationTags: [],
          pairings: [],
          dietaryTags: [],
          allergensContains: [],
          allergensMayContain: [],
          removableIngredients: [],
          active: true,
          seasonal: false,
          limitedTime: false,
          soldOut: false,
          displayOrder: 10,
          modifierGroups: [],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    expect(upsertMenuItemMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'MENU_ITEM_EXTERNAL_ID_CONFLICT',
    });
  });
});
