import { getGoogleBusinessProfileFoodMenus } from './client';
import {
  buildGoogleFoodMenusImportReview,
  canonicalizeGoogleFoodMenusResource,
  hashGoogleFoodMenusResource,
  type GoogleFoodMenusImportReview,
  type GoogleFoodMenusProjectedIdentity,
  type GoogleFoodMenusResource,
} from './food-menus';
import { listCanonicalFoodMenusImportItems } from './food-menus-canonical-adapter';
import {
  readFoodMenuSettings,
  recordFoodMenusSnapshot,
  replacePendingFoodMenusImportReviews,
  type FoodMenusImportReviewRecord,
  type FoodMenusSnapshot,
  type FoodMenusSnapshotSource,
} from './food-menus-storage';
import { buildFoodMenusImportReviewSettings } from './food-menus-sync-domain';
import { resolvePreviousFoodMenusIdentities } from './food-menus-sync-identities';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface PrepareFoodMenusImportReviewInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly googleFoodMenus: GoogleFoodMenusResource;
  readonly externalProfileId?: string | null;
  readonly source?: Extract<FoodMenusSnapshotSource, 'manual' | 'scheduled' | 'preflight'>;
  readonly googleSnapshotId?: string | null;
  readonly projectionSnapshotId?: string | null;
  readonly previousIdentities?: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
  readonly createdByUserId?: string | null;
  readonly persist?: boolean;
}

export interface PreparedFoodMenusImportReview {
  readonly localItemCount: number;
  readonly review: GoogleFoodMenusImportReview;
  readonly googleSnapshot: FoodMenusSnapshot | null;
  readonly projectionSnapshotId: string | null;
  readonly previousIdentityCount: number;
  readonly rows: ReadonlyArray<FoodMenusImportReviewRecord>;
}

export interface RefreshFoodMenusImportReviewFromGoogleInput extends Omit<
  PrepareFoodMenusImportReviewInput,
  'googleFoodMenus' | 'googleSnapshotId'
> {
  readonly accessToken: string;
  readonly foodMenusName: string;
}

export interface RefreshedFoodMenusImportReviewFromGoogle {
  readonly googleFoodMenus: GoogleFoodMenusResource;
  readonly googleFoodMenusHash: string;
  readonly importReview: PreparedFoodMenusImportReview;
}

export async function prepareFoodMenusImportReview({
  client,
  restaurantId,
  googleFoodMenus,
  externalProfileId = null,
  source = 'manual',
  googleSnapshotId = null,
  projectionSnapshotId,
  previousIdentities,
  createdByUserId = null,
  persist = true,
}: PrepareFoodMenusImportReviewInput): Promise<PreparedFoodMenusImportReview> {
  const [items, settings, resolvedPrevious] = await Promise.all([
    listCanonicalFoodMenusImportItems(restaurantId, client),
    readFoodMenuSettings({ client, restaurantId }),
    resolvePreviousFoodMenusIdentities({
      client,
      restaurantId,
      projectionSnapshotId,
      previousIdentities,
    }),
  ]);
  const review = buildGoogleFoodMenusImportReview({
    googleFoodMenus,
    localItems: items,
    previousIdentities: resolvedPrevious.identities,
    settings: buildFoodMenusImportReviewSettings(settings),
  });

  if (!persist) {
    return {
      localItemCount: items.length,
      review,
      googleSnapshot: null,
      projectionSnapshotId: resolvedPrevious.projectionSnapshotId,
      previousIdentityCount: resolvedPrevious.identities.length,
      rows: [],
    };
  }

  const googleSnapshot =
    googleSnapshotId === null
      ? await recordFoodMenusSnapshot({
          client,
          restaurantId,
          externalProfileId,
          snapshotKind: 'google_pull',
          source,
          foodMenusName: googleFoodMenus.name,
          rawFoodMenus: googleFoodMenus,
          canonicalFoodMenus: canonicalizeGoogleFoodMenusResource(googleFoodMenus),
          snapshotHash: hashGoogleFoodMenusResource(googleFoodMenus),
          pulledAt: new Date().toISOString(),
          createdByUserId,
        })
      : null;
  const rows = await replacePendingFoodMenusImportReviews({
    client,
    restaurantId,
    googleSnapshotId: googleSnapshot?.id ?? googleSnapshotId,
    projectionSnapshotId: resolvedPrevious.projectionSnapshotId,
    review,
  });

  return {
    localItemCount: items.length,
    review,
    googleSnapshot,
    projectionSnapshotId: resolvedPrevious.projectionSnapshotId,
    previousIdentityCount: resolvedPrevious.identities.length,
    rows,
  };
}

export async function refreshFoodMenusImportReviewFromGoogle({
  client,
  restaurantId,
  accessToken,
  foodMenusName,
  externalProfileId = null,
  source = 'manual',
  projectionSnapshotId,
  previousIdentities,
  createdByUserId = null,
  persist = true,
}: RefreshFoodMenusImportReviewFromGoogleInput): Promise<RefreshedFoodMenusImportReviewFromGoogle> {
  const googleFoodMenus = await getGoogleBusinessProfileFoodMenus(accessToken, foodMenusName, {
    readMask: ['name', 'menus'],
  });
  const importReview = await prepareFoodMenusImportReview({
    client,
    restaurantId,
    googleFoodMenus,
    externalProfileId,
    source,
    projectionSnapshotId,
    previousIdentities,
    createdByUserId,
    persist,
  });

  return {
    googleFoodMenus,
    googleFoodMenusHash: hashGoogleFoodMenusResource(googleFoodMenus),
    importReview,
  };
}
