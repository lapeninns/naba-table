import {
  listProjectedFoodMenusIdentities,
  readLatestFoodMenusSnapshot,
} from '@/server/google-business-profile/food-menus-storage';

import type { DualSyncFoodMenuItemValue, DualSyncFoodMenusSectionValue } from './types';
import type {
  CanonicalGoogleFoodMenusResource,
  GoogleMenuLabel,
} from '@/server/google-business-profile/food-menus';
import type { FoodMenusProjectedIdentityRecord } from '@/server/google-business-profile/food-menus-storage';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const EMPTY_FOOD_MENUS: DualSyncFoodMenusSectionValue = { items: [] };

interface ReadStoredFoodMenusSectionInput {
  readonly client: DbClient;
  readonly restaurantId: string;
}

interface FoodMenuPathParts {
  readonly menuIndex: number;
  readonly sectionIndex: number;
  readonly itemIndex: number;
}

export async function readStoredNabatableFoodMenusSection({
  client,
  restaurantId,
}: ReadStoredFoodMenusSectionInput): Promise<DualSyncFoodMenusSectionValue> {
  return readStoredFoodMenusSection({
    client,
    restaurantId,
    snapshotKind: 'nabatable_projection',
    identitySnapshotKind: 'nabatable_projection',
  });
}

export async function readStoredGoogleFoodMenusSection({
  client,
  restaurantId,
}: ReadStoredFoodMenusSectionInput): Promise<DualSyncFoodMenusSectionValue> {
  return readStoredFoodMenusSection({
    client,
    restaurantId,
    snapshotKind: 'google_pull',
    identitySnapshotKind: 'nabatable_projection',
  });
}

async function readStoredFoodMenusSection({
  client,
  restaurantId,
  snapshotKind,
  identitySnapshotKind,
}: ReadStoredFoodMenusSectionInput & {
  readonly snapshotKind: 'google_pull' | 'nabatable_projection';
  readonly identitySnapshotKind: 'nabatable_projection';
}): Promise<DualSyncFoodMenusSectionValue> {
  try {
    const [snapshot, identitySnapshot] = await Promise.all([
      readLatestFoodMenusSnapshot({
        client,
        restaurantId,
        snapshotKind,
      }),
      readLatestFoodMenusSnapshot({
        client,
        restaurantId,
        snapshotKind: identitySnapshotKind,
      }),
    ]);

    if (!snapshot || !identitySnapshot) {
      return EMPTY_FOOD_MENUS;
    }

    const identities = await listProjectedFoodMenusIdentities({
      client,
      restaurantId,
      snapshotId: identitySnapshot.id,
    });

    return canonicalFoodMenusToSection(snapshot.canonicalFoodMenus, identities);
  } catch (error) {
    if (isMissingFoodMenusStorageError(error)) {
      return EMPTY_FOOD_MENUS;
    }
    throw error;
  }
}

export function canonicalFoodMenusToSection(
  canonicalFoodMenus: unknown,
  identities: ReadonlyArray<FoodMenusProjectedIdentityRecord>,
): DualSyncFoodMenusSectionValue {
  const foodMenus = asCanonicalFoodMenus(canonicalFoodMenus);
  if (!foodMenus || identities.length === 0) {
    return EMPTY_FOOD_MENUS;
  }

  const items: DualSyncFoodMenuItemValue[] = [];
  for (const identity of identities) {
    const path = parseFoodMenuItemPath(identity.googlePath);
    if (!path) {
      continue;
    }
    const section = foodMenus.menus[path.menuIndex]?.sections[path.sectionIndex];
    const item = section?.items[path.itemIndex];
    if (!section || !item) {
      continue;
    }
    const itemLabel = primaryLabel(item.labels);
    const sectionLabel = primaryLabel(section.labels);
    items.push({
      stableKey: identity.stableKey,
      itemName: itemLabel?.displayName ?? identity.itemName,
      sectionLabel: sectionLabel?.displayName ?? identity.sectionLabel,
      description: itemLabel?.description ?? null,
      basePrice: item.attributes.price.amount,
      currency: item.attributes.price.currencyCode,
      dietaryTags: item.attributes.dietaryRestriction,
      allergensContains: item.attributes.allergen,
      googlePath: identity.googlePath,
    });
  }

  return { items };
}

function asCanonicalFoodMenus(value: unknown): CanonicalGoogleFoodMenusResource | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const menus = (value as { menus?: unknown }).menus;
  return Array.isArray(menus) ? (value as CanonicalGoogleFoodMenusResource) : null;
}

function parseFoodMenuItemPath(path: string): FoodMenuPathParts | null {
  const match = /^menus\[(\d+)]\.sections\[(\d+)]\.items\[(\d+)]$/.exec(path);
  if (!match) {
    return null;
  }
  return {
    menuIndex: Number(match[1]),
    sectionIndex: Number(match[2]),
    itemIndex: Number(match[3]),
  };
}

function primaryLabel(labels: ReadonlyArray<GoogleMenuLabel> | undefined): GoogleMenuLabel | null {
  return labels?.[0] ?? null;
}

function isMissingFoodMenusStorageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message : '';
  return code === 'PGRST205' || code === '42P01' || /restaurant_gbp_food_menu_/.test(message);
}
