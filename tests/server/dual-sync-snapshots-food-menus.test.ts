import { beforeEach, describe, expect, it, vi } from 'vitest';

const readLatestFoodMenusSnapshotMock = vi.hoisted(() => vi.fn());
const listProjectedFoodMenusIdentitiesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/food-menus-storage', () => ({
  readLatestFoodMenusSnapshot: readLatestFoodMenusSnapshotMock,
  listProjectedFoodMenusIdentities: listProjectedFoodMenusIdentitiesMock,
}));

import {
  canonicalFoodMenusToSection,
  readStoredGoogleFoodMenusSection,
  readStoredNabatableFoodMenusSection,
} from '@/server/dual-sync/snapshots/food-menus';

import type { CanonicalGoogleFoodMenusResource } from '@/server/google-business-profile/food-menus';
import type { FoodMenusProjectedIdentityRecord } from '@/server/google-business-profile/food-menus-storage';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeCanonicalFoodMenus(
  overrides: Partial<CanonicalGoogleFoodMenusResource> = {},
): CanonicalGoogleFoodMenusResource {
  return {
    name: 'accounts/123/locations/456/foodMenus',
    menus: [
      {
        labels: [{ displayName: 'Food menu', languageCode: 'en-GB' }],
        sourceUrl: null,
        cuisines: [],
        sections: [
          {
            labels: [{ displayName: 'Starters', languageCode: 'en-GB' }],
            items: [
              {
                labels: [
                  {
                    displayName: 'Chilli Paneer',
                    description: 'Crisp paneer',
                    languageCode: 'en-GB',
                  },
                ],
                attributes: {
                  price: { currencyCode: 'GBP', amount: 8.95 },
                  spiciness: null,
                  allergen: ['DAIRY'],
                  dietaryRestriction: ['VEGETARIAN'],
                  ingredients: [],
                  preparationMethods: [],
                  portionSize: null,
                },
                options: [],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeIdentity(
  overrides: Partial<FoodMenusProjectedIdentityRecord> = {},
): FoodMenusProjectedIdentityRecord {
  return {
    id: 'identity-1',
    restaurantId: RESTAURANT_ID,
    snapshotId: 'projection-snapshot-1',
    localItemId: 'item-1',
    externalItemId: 'starter-paneer',
    stableKey: 'foodMenu.item.starters/default.starter-paneer',
    itemName: 'Local Chilli Paneer',
    sectionKey: 'starters/default',
    sectionLabel: 'Local Starters',
    googlePath: 'menus[0].sections[0].items[0]',
    googleOptionPaths: [],
    createdAt: '2026-05-02T18:00:00.000Z',
    ...overrides,
  };
}

describe('dual-sync FoodMenus snapshot adapter', () => {
  beforeEach(() => {
    readLatestFoodMenusSnapshotMock.mockReset();
    listProjectedFoodMenusIdentitiesMock.mockReset();
  });

  it('projects canonical FoodMenus and identity rows into dual-sync item values', () => {
    const section = canonicalFoodMenusToSection(makeCanonicalFoodMenus(), [makeIdentity()]);

    expect(section.items).toEqual([
      {
        stableKey: 'foodMenu.item.starters/default.starter-paneer',
        itemName: 'Chilli Paneer',
        sectionLabel: 'Starters',
        description: 'Crisp paneer',
        basePrice: 8.95,
        currency: 'GBP',
        dietaryTags: ['VEGETARIAN'],
        allergensContains: ['DAIRY'],
        googlePath: 'menus[0].sections[0].items[0]',
      },
    ]);
  });

  it('skips identities whose Google path is absent from the stored canonical payload', () => {
    const section = canonicalFoodMenusToSection(makeCanonicalFoodMenus(), [
      makeIdentity({ googlePath: 'menus[0].sections[0].items[1]' }),
    ]);

    expect(section.items).toEqual([]);
  });

  it('reads the latest Nabatable projection snapshot and its identity rows', async () => {
    readLatestFoodMenusSnapshotMock.mockImplementation(
      async ({ snapshotKind }: { snapshotKind: string }) => ({
        id: `${snapshotKind}-snapshot-1`,
        canonicalFoodMenus: makeCanonicalFoodMenus(),
      }),
    );
    listProjectedFoodMenusIdentitiesMock.mockResolvedValue([makeIdentity()]);

    const section = await readStoredNabatableFoodMenusSection({
      client,
      restaurantId: RESTAURANT_ID,
    });

    expect(readLatestFoodMenusSnapshotMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      snapshotKind: 'nabatable_projection',
    });
    expect(listProjectedFoodMenusIdentitiesMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      snapshotId: 'nabatable_projection-snapshot-1',
    });
    expect(section.items[0]?.itemName).toBe('Chilli Paneer');
  });

  it('maps the latest Google pull through the latest projected identity map', async () => {
    readLatestFoodMenusSnapshotMock.mockImplementation(
      async ({ snapshotKind }: { snapshotKind: string }) => ({
        id: `${snapshotKind}-snapshot-1`,
        canonicalFoodMenus: makeCanonicalFoodMenus({
          menus: [
            {
              labels: [{ displayName: 'Food menu', languageCode: 'en-GB' }],
              sourceUrl: null,
              cuisines: [],
              sections: [
                {
                  labels: [{ displayName: 'Starters', languageCode: 'en-GB' }],
                  items: [
                    {
                      labels: [
                        {
                          displayName: 'Chilli Paneer',
                          description: 'Changed on Google',
                          languageCode: 'en-GB',
                        },
                      ],
                      attributes: {
                        price: { currencyCode: 'GBP', amount: 9.5 },
                        spiciness: null,
                        allergen: ['DAIRY'],
                        dietaryRestriction: ['VEGETARIAN'],
                        ingredients: [],
                        preparationMethods: [],
                        portionSize: null,
                      },
                      options: [],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    );
    listProjectedFoodMenusIdentitiesMock.mockResolvedValue([makeIdentity()]);

    const section = await readStoredGoogleFoodMenusSection({
      client,
      restaurantId: RESTAURANT_ID,
    });

    expect(readLatestFoodMenusSnapshotMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      snapshotKind: 'google_pull',
    });
    expect(readLatestFoodMenusSnapshotMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      snapshotKind: 'nabatable_projection',
    });
    expect(listProjectedFoodMenusIdentitiesMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      snapshotId: 'nabatable_projection-snapshot-1',
    });
    expect(section.items[0]).toMatchObject({
      stableKey: 'foodMenu.item.starters/default.starter-paneer',
      description: 'Changed on Google',
      basePrice: 9.5,
    });
  });

  it('returns an empty section when FoodMenus storage has not been migrated yet', async () => {
    readLatestFoodMenusSnapshotMock.mockRejectedValue({
      code: 'PGRST205',
      message: "Could not find the table 'restaurant_gbp_food_menu_snapshots'",
    });

    await expect(
      readStoredGoogleFoodMenusSection({ client, restaurantId: RESTAURANT_ID }),
    ).resolves.toEqual({ items: [] });
  });
});
