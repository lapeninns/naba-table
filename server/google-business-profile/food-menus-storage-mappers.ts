import type { GoogleFoodMenusProjectedIdentity } from './food-menus';
import type {
  FoodMenuSettings,
  FoodMenusImportReviewRecord,
  FoodMenusProjectedIdentityRecord,
  FoodMenusPublishAttempt,
  FoodMenusPublishMode,
  FoodMenusPublishStatus,
  FoodMenusSnapshot,
  FoodMenusSnapshotKind,
  FoodMenusSnapshotSource,
  FoodMenusSnapshotStatus,
} from './food-menus-storage';
import type { DUAL_SYNC_PROVIDER } from '@/server/dual-sync/types';
import type { Json } from '@/types/supabase';

type FoodMenusSnapshotRow = {
  id: string;
  restaurant_id: string;
  external_profile_id: string | null;
  provider: typeof DUAL_SYNC_PROVIDER;
  snapshot_kind: FoodMenusSnapshotKind;
  source: FoodMenusSnapshotSource;
  status: FoodMenusSnapshotStatus;
  food_menus_name: string | null;
  raw_food_menus: Json | null;
  canonical_food_menus: Json | null;
  projection_metadata: Json;
  snapshot_hash: string | null;
  google_etag: string | null;
  error_code: string | null;
  error_message: string | null;
  pulled_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

type FoodMenusProjectedIdentityRow = {
  id: string;
  restaurant_id: string;
  snapshot_id: string;
  menu_item_id: string | null;
  external_item_id: string;
  stable_key: string;
  item_name: string;
  section_key: string;
  section_label: string;
  google_path: string;
  google_option_paths: Json;
  created_at: string;
};

type FoodMenusImportReviewRow = {
  id: string;
  restaurant_id: string;
  google_snapshot_id: string | null;
  projection_snapshot_id: string | null;
  menu_item_id: string | null;
  external_item_id: string | null;
  target_kind: FoodMenusImportReviewRecord['targetKind'];
  google_path: string | null;
  google_section_label: string | null;
  google_item_name: string | null;
  match_status: FoodMenusImportReviewRecord['matchStatus'];
  match_confidence: FoodMenusImportReviewRecord['matchConfidence'];
  suggested_patch: Json | null;
  warnings: Json;
  decision_status: FoodMenusImportReviewRecord['decisionStatus'];
  decision_action: FoodMenusImportReviewRecord['decisionAction'];
  decided_by_user_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

type FoodMenuSettingsRow = {
  restaurant_id: string;
  menu_label: string | null;
  source_url: string | null;
  cuisines: string[] | null;
  language_code: string | null;
  updated_at: string;
};

type FoodMenusPublishAttemptRow = {
  id: string;
  restaurant_id: string;
  projection_snapshot_id: string | null;
  baseline_google_snapshot_id: string | null;
  provider: typeof DUAL_SYNC_PROVIDER;
  status: FoodMenusPublishStatus;
  publish_mode: FoodMenusPublishMode;
  food_menus_name: string;
  update_mask: string[];
  projected_payload: Json;
  google_response: Json | null;
  baseline_google_hash: string | null;
  projected_payload_hash: string | null;
  error_code: string | null;
  error_message: string | null;
  requested_by_user_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

function objectOrEmpty(value: Json): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function rowToSnapshot(row: FoodMenusSnapshotRow): FoodMenusSnapshot {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    externalProfileId: row.external_profile_id,
    provider: row.provider,
    snapshotKind: row.snapshot_kind,
    source: row.source,
    status: row.status,
    foodMenusName: row.food_menus_name,
    rawFoodMenus: row.raw_food_menus,
    canonicalFoodMenus: row.canonical_food_menus,
    projectionMetadata: objectOrEmpty(row.projection_metadata),
    snapshotHash: row.snapshot_hash,
    googleEtag: row.google_etag,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    pulledAt: row.pulled_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

export function rowToIdentity(
  row: FoodMenusProjectedIdentityRow,
): FoodMenusProjectedIdentityRecord {
  const projectionKind = row.stable_key.includes('.optionItem.')
    ? ({ projectionKind: 'option_item' } as const)
    : {};
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    snapshotId: row.snapshot_id,
    localItemId: row.menu_item_id,
    externalItemId: row.external_item_id,
    stableKey: row.stable_key,
    itemName: row.item_name,
    sectionKey: row.section_key,
    sectionLabel: row.section_label,
    googlePath: row.google_path,
    googleOptionPaths: Array.isArray(row.google_option_paths)
      ? (row.google_option_paths as GoogleFoodMenusProjectedIdentity['googleOptionPaths'])
      : [],
    createdAt: row.created_at,
    ...projectionKind,
  };
}

export function rowToImportReview(row: FoodMenusImportReviewRow): FoodMenusImportReviewRecord {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    googleSnapshotId: row.google_snapshot_id,
    projectionSnapshotId: row.projection_snapshot_id,
    localItemId: row.menu_item_id,
    externalItemId: row.external_item_id,
    targetKind: row.target_kind,
    googlePath: row.google_path,
    googleSectionLabel: row.google_section_label,
    googleItemName: row.google_item_name,
    matchStatus: row.match_status,
    matchConfidence: row.match_confidence,
    suggestedPatch: row.suggested_patch,
    warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
    decisionStatus: row.decision_status,
    decisionAction: row.decision_action,
    decidedByUserId: row.decided_by_user_id,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToFoodMenuSettings(row: FoodMenuSettingsRow): FoodMenuSettings {
  return {
    restaurantId: row.restaurant_id,
    menuLabel: row.menu_label,
    sourceUrl: row.source_url,
    cuisines: row.cuisines ?? [],
    languageCode: row.language_code,
    updatedAt: row.updated_at,
  };
}

export function rowToPublishAttempt(row: FoodMenusPublishAttemptRow): FoodMenusPublishAttempt {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    projectionSnapshotId: row.projection_snapshot_id,
    baselineGoogleSnapshotId: row.baseline_google_snapshot_id,
    provider: row.provider,
    status: row.status,
    publishMode: row.publish_mode,
    foodMenusName: row.food_menus_name,
    updateMask: row.update_mask,
    projectedPayload: row.projected_payload,
    googleResponse: row.google_response,
    baselineGoogleHash: row.baseline_google_hash,
    projectedPayloadHash: row.projected_payload_hash,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    requestedByUserId: row.requested_by_user_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
