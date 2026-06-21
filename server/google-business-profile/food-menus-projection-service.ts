import { listRestaurantMenuHierarchy } from '@/server/menu-hierarchy/repository';

import {
  buildCanonicalGoogleFoodMenusProjection,
  hashGoogleFoodMenusResource,
  type GoogleFoodMenuCuisine,
  type GoogleFoodMenusProjection,
} from './food-menus';
import {
  recordFoodMenusProjection,
  type FoodMenusProjectedIdentityRecord,
  type FoodMenusSnapshot,
  type FoodMenusSnapshotSource,
} from './food-menus-storage';
import {
  countCanonicalFoodMenuItems,
  selectCanonicalPublishableFoodMenus,
} from './food-menus-sync-domain';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface PrepareFoodMenusProjectionInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly foodMenusName: string;
  readonly menuLabel?: string | null;
  readonly sourceUrl?: string | null;
  readonly languageCode?: string | null;
  readonly includeUnavailable?: boolean;
  readonly cuisines?: GoogleFoodMenuCuisine[];
  readonly externalProfileId?: string | null;
  readonly source?: Extract<FoodMenusSnapshotSource, 'manual' | 'scheduled' | 'preflight'>;
  readonly createdByUserId?: string | null;
  readonly persist?: boolean;
}

export interface PreparedFoodMenusProjection {
  readonly localItemCount: number;
  readonly projection: GoogleFoodMenusProjection;
  readonly projectionHash: string;
  readonly snapshot: FoodMenusSnapshot | null;
  readonly identities: ReadonlyArray<FoodMenusProjectedIdentityRecord>;
}

export async function prepareFoodMenusProjection({
  client,
  restaurantId,
  foodMenusName,
  includeUnavailable,
  externalProfileId = null,
  source = 'manual',
  createdByUserId = null,
  persist = true,
}: PrepareFoodMenusProjectionInput): Promise<PreparedFoodMenusProjection> {
  const hierarchy = await listRestaurantMenuHierarchy(restaurantId, client);
  const canonicalPublishableMenus = selectCanonicalPublishableFoodMenus(hierarchy.menus);
  const projection = buildCanonicalGoogleFoodMenusProjection({
    foodMenusName,
    menus: hierarchy.menus,
    includeUnavailable,
  });
  const projectionHash = hashGoogleFoodMenusResource(projection.foodMenus);
  const localItemCount = countCanonicalFoodMenuItems(canonicalPublishableMenus);

  if (!persist) {
    return {
      localItemCount,
      projection,
      projectionHash,
      snapshot: null,
      identities: [],
    };
  }

  const recorded = await recordFoodMenusProjection({
    client,
    restaurantId,
    projection,
    snapshotHash: projectionHash,
    externalProfileId,
    source,
    createdByUserId,
  });

  return {
    localItemCount,
    projection,
    projectionHash,
    snapshot: recorded.snapshot,
    identities: recorded.identities,
  };
}
