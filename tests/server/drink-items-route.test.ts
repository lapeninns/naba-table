import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authGetUserMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const listDrinkItemsMock = vi.hoisted(() => vi.fn());
const upsertDrinkItemMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/server/drinks-menu/repository', () => ({
  listDrinkItems: listDrinkItemsMock,
  upsertDrinkItem: upsertDrinkItemMock,
}));

import { GET, POST } from '@/src/app/api/ops/restaurants/[id]/drinks/items/route';

describe('ops drink items route', () => {
  beforeEach(() => {
    authGetUserMock.mockReset();
    requireAdminMembershipMock.mockReset();
    listDrinkItemsMock.mockReset();
    upsertDrinkItemMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/drinks/items'),
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
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/drinks/items'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
  });

  it('creates a drink item with a valid payload', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    upsertDrinkItemMock.mockResolvedValue({
      id: 'drink-1',
      externalDrinkId: 'house-negroni',
    });

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/drinks/items', {
        method: 'POST',
        body: JSON.stringify({
          externalDrinkId: 'house-negroni',
          drinkName: 'House Negroni',
          category: 'cocktail',
          subcategory: 'classic',
          shortDescription: null,
          fullDescription: null,
          basePrice: 11.5,
          currency: 'GBP',
          serviceTime: 'Evening',
          availabilityStatus: 'available',
          drinkType: 'cocktail',
          alcoholic: true,
          abv: 24,
          volumeMl: 120,
          servingSize: 'Short serve',
          servedStyle: 'On the rocks',
          temperature: 'Cold',
          baseSpirit: 'Gin',
          beerStyle: null,
          wineType: null,
          grapeVarietal: null,
          region: null,
          country: 'United Kingdom',
          roastLevel: null,
          caffeineLevel: null,
          sweetnessLevel: 'Low',
          bitternessLevel: 'High',
          acidityLevel: 'Low',
          bodyLevel: 'Medium',
          flavorProfile: 'Bitter, herbal, citrus',
          keyIngredients: [],
          garnish: 'Orange peel',
          containsDairy: false,
          containsNuts: false,
          containsGluten: false,
          containsCaffeine: false,
          dietaryTags: [],
          allergensContains: [],
          allergensMayContain: [],
          canBeMadeNonAlcoholic: true,
          canBeMadeDecaf: false,
          customizationRules: null,
          pairings: [],
          signatureScore: 92,
          popularityScore: 88,
          recommendationTags: [],
          seasonal: false,
          limitedTime: false,
          soldOut: false,
          active: true,
          displayOrder: 10,
          imageUrl: null,
          modifierGroups: [],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(201);
    expect(upsertDrinkItemMock).toHaveBeenCalledWith(
      'rest-1',
      expect.objectContaining({
        externalDrinkId: 'house-negroni',
        drinkName: 'House Negroni',
      }),
    );
  });
});
