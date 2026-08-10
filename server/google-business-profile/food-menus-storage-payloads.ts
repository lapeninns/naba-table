import { DUAL_SYNC_PROVIDER } from '@/server/dual-sync/types';

import { toJson } from './businessInfoNormalization';

import type {
  GoogleFoodMenusProjection,
  GoogleFoodMenusProjectedIdentity,
  GoogleFoodMenusResource,
} from './food-menus';
import type {
  FoodMenusSnapshotKind,
  FoodMenusSnapshotSource,
  FoodMenusSnapshotStatus,
} from './food-menus-storage';
import type { Json } from '@/types/supabase';

export interface BuildFoodMenusSnapshotInsertPayloadInput {
  readonly restaurantId: string;
  readonly snapshotKind: FoodMenusSnapshotKind;
  readonly source: FoodMenusSnapshotSource;
  readonly externalProfileId: string | null;
  readonly status: FoodMenusSnapshotStatus;
  readonly foodMenusName: string | null;
  readonly rawFoodMenus?: GoogleFoodMenusResource | null;
  readonly canonicalFoodMenus?: unknown;
  readonly projectionMetadata: Record<string, unknown>;
  readonly snapshotHash: string | null;
  readonly googleEtag: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly pulledAt: string | null;
  readonly createdByUserId: string | null;
}

export function buildFoodMenusSnapshotInsertPayload({
  restaurantId,
  snapshotKind,
  source,
  externalProfileId,
  status,
  foodMenusName,
  rawFoodMenus,
  canonicalFoodMenus: _canonicalFoodMenus,
  projectionMetadata: _projectionMetadata,
  snapshotHash,
  googleEtag,
  errorCode,
  errorMessage,
  pulledAt,
  createdByUserId,
}: BuildFoodMenusSnapshotInsertPayloadInput) {
  return {
    restaurant_id: restaurantId,
    external_profile_id: externalProfileId,
    provider: DUAL_SYNC_PROVIDER,
    snapshot_kind: snapshotKind,
    source,
    status,
    food_menus_name: foodMenusName,
    raw_food_menus: rawFoodMenus === undefined ? null : toJson(rawFoodMenus),
    canonical_food_menus: null,
    projection_metadata: {},
    snapshot_hash: snapshotHash,
    google_etag: googleEtag,
    error_code: errorCode,
    error_message: errorMessage,
    pulled_at: pulledAt,
    created_by_user_id: createdByUserId,
  };
}

export function buildProjectedFoodMenusIdentityUpsertPayloads({
  restaurantId,
  snapshotId,
  identities,
}: {
  readonly restaurantId: string;
  readonly snapshotId: string;
  readonly identities: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
}) {
  return identities.map((identity) => ({
    restaurant_id: restaurantId,
    snapshot_id: snapshotId,
    menu_item_id: identity.localItemId,
    external_item_id: identity.externalItemId,
    stable_key: identity.stableKey,
    item_name: identity.itemName,
    section_key: identity.sectionKey,
    section_label: identity.sectionLabel,
    google_path: identity.googlePath,
    google_option_paths: identity.googleOptionPaths as Json,
  }));
}

export function buildFoodMenusProjectionSnapshotMetadata(
  projection: GoogleFoodMenusProjection,
  projectionMetadata?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    skippedItems: projection.skippedItems,
    identityCount: projection.identities.length,
    ...projectionMetadata,
  };
}

export function buildFoodMenuSettingsUpsertPayload({
  restaurantId,
  menuLabel,
  sourceUrl,
  cuisines,
  languageCode,
  updatedAt,
}: {
  readonly restaurantId: string;
  readonly menuLabel?: string | null;
  readonly sourceUrl?: string | null;
  readonly cuisines?: string[] | null;
  readonly languageCode?: string | null;
  readonly updatedAt: string;
}) {
  return {
    restaurant_id: restaurantId,
    menu_label: menuLabel ?? null,
    source_url: sourceUrl ?? null,
    cuisines: cuisines ?? [],
    language_code: languageCode ?? null,
    updated_at: updatedAt,
  };
}
