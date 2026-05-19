import { DUAL_SYNC_PROVIDER } from '@/server/dual-sync/types';

import {
  canonicalizeGoogleFoodMenusResource,
  type CanonicalGoogleFoodMenusResource,
  type GoogleFoodMenusImportReview,
  type GoogleFoodMenusProjection,
  type GoogleFoodMenusProjectedIdentity,
  type GoogleFoodMenusResource,
} from './food-menus';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export type FoodMenusSnapshotKind = 'google_pull' | 'nabatable_projection' | 'preflight';
export type FoodMenusSnapshotSource = 'manual' | 'scheduled' | 'preflight' | 'publish';
export type FoodMenusSnapshotStatus = 'succeeded' | 'failed';
export type FoodMenusPublishStatus =
  | 'pending'
  | 'preflight_failed'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type FoodMenusPublishMode = 'manual' | 'scheduled' | 'dry_run';

interface FoodMenusSnapshotRow {
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
}

interface FoodMenusProjectedIdentityRow {
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
}

interface FoodMenusImportReviewRow {
  id: string;
  restaurant_id: string;
  google_snapshot_id: string | null;
  projection_snapshot_id: string | null;
  menu_item_id: string | null;
  external_item_id: string | null;
  target_kind: 'food' | 'drink';
  google_path: string | null;
  google_section_label: string | null;
  google_item_name: string | null;
  match_status: 'matched' | 'unmatched' | 'missing_from_google' | 'menu_metadata';
  match_confidence: 'previous_identity' | 'section_name_price' | 'section_name' | 'none';
  suggested_patch: Json | null;
  warnings: Json;
  decision_status: 'pending' | 'processing' | 'approved' | 'ignored' | 'applied' | 'superseded';
  decision_action:
    | 'apply_to_nabatable'
    | 'ignore_google_change'
    | 'create_new_item'
    | 'apply_menu_metadata'
    | 'mark_inactive'
    | 'mark_sold_out'
    | 'delete_local'
    | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FoodMenuSettingsRow {
  restaurant_id: string;
  menu_label: string | null;
  source_url: string | null;
  cuisines: string[];
  language_code: string | null;
  updated_at: string;
}

interface FoodMenusPublishAttemptRow {
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
}

type FoodMenusSyncDatabase = {
  public: {
    Tables: {
      restaurant_gbp_food_menu_snapshots: {
        Row: FoodMenusSnapshotRow;
        Insert: Partial<FoodMenusSnapshotRow> &
          Pick<FoodMenusSnapshotRow, 'restaurant_id' | 'snapshot_kind' | 'source'>;
        Update: Partial<FoodMenusSnapshotRow>;
        Relationships: [];
      };
      restaurant_gbp_food_menu_projected_identities: {
        Row: FoodMenusProjectedIdentityRow;
        Insert: Partial<FoodMenusProjectedIdentityRow> &
          Pick<
            FoodMenusProjectedIdentityRow,
            | 'restaurant_id'
            | 'snapshot_id'
            | 'external_item_id'
            | 'stable_key'
            | 'item_name'
            | 'section_key'
            | 'section_label'
            | 'google_path'
          >;
        Update: Partial<FoodMenusProjectedIdentityRow>;
        Relationships: [];
      };
      restaurant_gbp_food_menu_import_reviews: {
        Row: FoodMenusImportReviewRow;
        Insert: Partial<FoodMenusImportReviewRow> &
          Pick<FoodMenusImportReviewRow, 'restaurant_id' | 'match_status' | 'match_confidence'>;
        Update: Partial<FoodMenusImportReviewRow>;
        Relationships: [];
      };
      restaurant_gbp_food_menu_settings: {
        Row: FoodMenuSettingsRow;
        Insert: Partial<FoodMenuSettingsRow> & Pick<FoodMenuSettingsRow, 'restaurant_id'>;
        Update: Partial<FoodMenuSettingsRow>;
        Relationships: [];
      };
      restaurant_gbp_food_menu_publish_attempts: {
        Row: FoodMenusPublishAttemptRow;
        Insert: Partial<FoodMenusPublishAttemptRow> &
          Pick<
            FoodMenusPublishAttemptRow,
            'restaurant_id' | 'food_menus_name' | 'projected_payload'
          >;
        Update: Partial<FoodMenusPublishAttemptRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type FoodMenusSyncDbClient = SupabaseClient<FoodMenusSyncDatabase>;
type ReplaceFoodMenusImportReviewsRpcClient = FoodMenusSyncDbClient & {
  rpc: (
    fn: 'replace_pending_food_menus_import_reviews',
    args: {
      p_google_snapshot_id: string | null;
      p_projection_snapshot_id: string | null;
      p_restaurant_id: string;
      p_reviews: Json;
    },
  ) => Promise<{ data: FoodMenusImportReviewRow[] | null; error: { message: string } | null }>;
};

export interface FoodMenusSnapshot {
  readonly id: string;
  readonly restaurantId: string;
  readonly externalProfileId: string | null;
  readonly provider: typeof DUAL_SYNC_PROVIDER;
  readonly snapshotKind: FoodMenusSnapshotKind;
  readonly source: FoodMenusSnapshotSource;
  readonly status: FoodMenusSnapshotStatus;
  readonly foodMenusName: string | null;
  readonly rawFoodMenus: unknown;
  readonly canonicalFoodMenus: unknown;
  readonly projectionMetadata: Record<string, unknown>;
  readonly snapshotHash: string | null;
  readonly googleEtag: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly pulledAt: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
}

export interface FoodMenusProjectedIdentityRecord {
  readonly id: string;
  readonly restaurantId: string;
  readonly snapshotId: string;
  readonly localItemId: string | null;
  readonly externalItemId: string;
  readonly stableKey: string;
  readonly itemName: string;
  readonly sectionKey: string;
  readonly sectionLabel: string;
  readonly googlePath: string;
  readonly googleOptionPaths: GoogleFoodMenusProjectedIdentity['googleOptionPaths'];
  readonly projectionKind?: GoogleFoodMenusProjectedIdentity['projectionKind'];
  readonly createdAt: string;
}

export interface FoodMenusImportReviewRecord {
  readonly id: string;
  readonly restaurantId: string;
  readonly googleSnapshotId: string | null;
  readonly projectionSnapshotId: string | null;
  readonly localItemId: string | null;
  readonly externalItemId: string | null;
  readonly targetKind: FoodMenusImportReviewRow['target_kind'];
  readonly googlePath: string | null;
  readonly googleSectionLabel: string | null;
  readonly googleItemName: string | null;
  readonly matchStatus: FoodMenusImportReviewRow['match_status'];
  readonly matchConfidence: FoodMenusImportReviewRow['match_confidence'];
  readonly suggestedPatch: unknown;
  readonly warnings: string[];
  readonly decisionStatus: FoodMenusImportReviewRow['decision_status'];
  readonly decisionAction: FoodMenusImportReviewRow['decision_action'];
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FoodMenuSettings {
  readonly restaurantId: string;
  readonly menuLabel: string | null;
  readonly sourceUrl: string | null;
  readonly cuisines: string[];
  readonly languageCode: string | null;
  readonly updatedAt: string;
}

export interface FoodMenusPublishAttempt {
  readonly id: string;
  readonly restaurantId: string;
  readonly projectionSnapshotId: string | null;
  readonly baselineGoogleSnapshotId: string | null;
  readonly provider: typeof DUAL_SYNC_PROVIDER;
  readonly status: FoodMenusPublishStatus;
  readonly publishMode: FoodMenusPublishMode;
  readonly foodMenusName: string;
  readonly updateMask: string[];
  readonly projectedPayload: unknown;
  readonly googleResponse: unknown;
  readonly baselineGoogleHash: string | null;
  readonly projectedPayloadHash: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly requestedByUserId: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function getFoodMenusSyncDbClient(client: DbClient): FoodMenusSyncDbClient {
  return client as unknown as FoodMenusSyncDbClient;
}

function objectOrEmpty(value: Json): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rowToSnapshot(row: FoodMenusSnapshotRow): FoodMenusSnapshot {
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

function rowToIdentity(row: FoodMenusProjectedIdentityRow): FoodMenusProjectedIdentityRecord {
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

function rowToImportReview(row: FoodMenusImportReviewRow): FoodMenusImportReviewRecord {
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

function rowToFoodMenuSettings(row: FoodMenuSettingsRow): FoodMenuSettings {
  return {
    restaurantId: row.restaurant_id,
    menuLabel: row.menu_label,
    sourceUrl: row.source_url,
    cuisines: row.cuisines ?? [],
    languageCode: row.language_code,
    updatedAt: row.updated_at,
  };
}

function rowToPublishAttempt(row: FoodMenusPublishAttemptRow): FoodMenusPublishAttempt {
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

function isFoodMenusSnapshotHashConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = Reflect.get(error, 'code');
  const message = Reflect.get(error, 'message');
  const details = Reflect.get(error, 'details');
  const text = `${typeof message === 'string' ? message : ''} ${
    typeof details === 'string' ? details : ''
  }`;

  return code === '23505' && text.includes('restaurant_gbp_food_menu_snapshots_hash_idx');
}

async function readFoodMenusSnapshotByHash({
  client,
  restaurantId,
  snapshotKind,
  snapshotHash,
  status,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly snapshotKind: FoodMenusSnapshotKind;
  readonly snapshotHash: string;
  readonly status: FoodMenusSnapshotStatus;
}): Promise<FoodMenusSnapshot | null> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_snapshots')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('snapshot_kind', snapshotKind)
    .eq('status', status)
    .eq('snapshot_hash', snapshotHash)
    .maybeSingle<FoodMenusSnapshotRow>();

  if (error) {
    throw error;
  }
  return data ? rowToSnapshot(data) : null;
}

export interface RecordFoodMenusSnapshotInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly snapshotKind: FoodMenusSnapshotKind;
  readonly source: FoodMenusSnapshotSource;
  readonly externalProfileId?: string | null;
  readonly status?: FoodMenusSnapshotStatus;
  readonly foodMenusName?: string | null;
  readonly rawFoodMenus?: GoogleFoodMenusResource | null;
  readonly canonicalFoodMenus?: unknown;
  readonly projectionMetadata?: Record<string, unknown>;
  readonly snapshotHash?: string | null;
  readonly googleEtag?: string | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly pulledAt?: string | null;
  readonly createdByUserId?: string | null;
}

export async function recordFoodMenusSnapshot({
  client,
  restaurantId,
  snapshotKind,
  source,
  externalProfileId = null,
  status = 'succeeded',
  foodMenusName = null,
  rawFoodMenus,
  canonicalFoodMenus,
  projectionMetadata = {},
  snapshotHash = null,
  googleEtag = null,
  errorCode = null,
  errorMessage = null,
  pulledAt = null,
  createdByUserId = null,
}: RecordFoodMenusSnapshotInput): Promise<FoodMenusSnapshot> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_snapshots')
    .insert({
      restaurant_id: restaurantId,
      external_profile_id: externalProfileId,
      provider: DUAL_SYNC_PROVIDER,
      snapshot_kind: snapshotKind,
      source,
      status,
      food_menus_name: foodMenusName,
      raw_food_menus: rawFoodMenus === undefined ? null : (rawFoodMenus as Json),
      canonical_food_menus: canonicalFoodMenus === undefined ? null : (canonicalFoodMenus as Json),
      projection_metadata: projectionMetadata as Json,
      snapshot_hash: snapshotHash,
      google_etag: googleEtag,
      error_code: errorCode,
      error_message: errorMessage,
      pulled_at: pulledAt,
      created_by_user_id: createdByUserId,
    } as never)
    .select('*')
    .single<FoodMenusSnapshotRow>();

  if (error) {
    if (snapshotHash && isFoodMenusSnapshotHashConflict(error)) {
      const existing = await readFoodMenusSnapshotByHash({
        client,
        restaurantId,
        snapshotKind,
        snapshotHash,
        status,
      });
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
  if (!data) {
    throw new Error('restaurant_gbp_food_menu_snapshots insert returned no row');
  }
  return rowToSnapshot(data);
}

export async function readLatestFoodMenusSnapshot({
  client,
  restaurantId,
  snapshotKind,
  status = 'succeeded',
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly snapshotKind: FoodMenusSnapshotKind;
  readonly status?: FoodMenusSnapshotStatus;
}): Promise<FoodMenusSnapshot | null> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_snapshots')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('snapshot_kind', snapshotKind)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }
  const row = data?.[0];
  return row ? rowToSnapshot(row as FoodMenusSnapshotRow) : null;
}

export async function saveProjectedFoodMenusIdentities({
  client,
  restaurantId,
  snapshotId,
  identities,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly snapshotId: string;
  readonly identities: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
}): Promise<ReadonlyArray<FoodMenusProjectedIdentityRecord>> {
  if (identities.length === 0) {
    return [];
  }

  const db = getFoodMenusSyncDbClient(client);
  const payload = identities.map((identity) => ({
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

  const { data, error } = await db
    .from('restaurant_gbp_food_menu_projected_identities')
    .upsert(payload as never, {
      onConflict: 'restaurant_id,snapshot_id,stable_key',
    })
    .select('*');

  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => rowToIdentity(row as FoodMenusProjectedIdentityRow));
}

export async function listProjectedFoodMenusIdentities({
  client,
  restaurantId,
  snapshotId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly snapshotId: string;
}): Promise<ReadonlyArray<FoodMenusProjectedIdentityRecord>> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_projected_identities')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('snapshot_id', snapshotId)
    .order('google_path', { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => rowToIdentity(row as FoodMenusProjectedIdentityRow));
}

export async function recordFoodMenusProjection({
  client,
  restaurantId,
  projection,
  projectionMetadata,
  snapshotHash,
  externalProfileId = null,
  source = 'manual',
  createdByUserId = null,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly projection: GoogleFoodMenusProjection;
  readonly projectionMetadata?: Record<string, unknown>;
  readonly snapshotHash: string;
  readonly externalProfileId?: string | null;
  readonly source?: Extract<FoodMenusSnapshotSource, 'manual' | 'scheduled' | 'preflight'>;
  readonly createdByUserId?: string | null;
}): Promise<{
  readonly snapshot: FoodMenusSnapshot;
  readonly identities: ReadonlyArray<FoodMenusProjectedIdentityRecord>;
}> {
  const snapshot = await recordFoodMenusSnapshot({
    client,
    restaurantId,
    externalProfileId,
    snapshotKind: 'nabatable_projection',
    source,
    foodMenusName: projection.foodMenus.name,
    rawFoodMenus: projection.foodMenus,
    canonicalFoodMenus: canonicalizeGoogleFoodMenusResource(
      projection.foodMenus,
    ) satisfies CanonicalGoogleFoodMenusResource,
    projectionMetadata: {
      skippedItems: projection.skippedItems,
      identityCount: projection.identities.length,
      ...projectionMetadata,
    },
    snapshotHash,
    createdByUserId,
  });
  const identities = await saveProjectedFoodMenusIdentities({
    client,
    restaurantId,
    snapshotId: snapshot.id,
    identities: projection.identities,
  });
  return { snapshot, identities };
}

export async function replacePendingFoodMenusImportReviews({
  client,
  restaurantId,
  googleSnapshotId = null,
  projectionSnapshotId = null,
  review,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly googleSnapshotId?: string | null;
  readonly projectionSnapshotId?: string | null;
  readonly review: GoogleFoodMenusImportReview;
}): Promise<ReadonlyArray<FoodMenusImportReviewRecord>> {
  const db = getFoodMenusSyncDbClient(client);
  const payload = review.items.map((item) => ({
    menu_item_id:
      item.match.status === 'matched' || item.match.status === 'missing_from_google'
        ? item.match.localItemId
        : null,
    external_item_id:
      item.match.status === 'matched' || item.match.status === 'missing_from_google'
        ? item.match.externalItemId
        : null,
    target_kind: item.targetKind,
    google_path: item.googlePath,
    google_section_label: item.googleSectionLabel,
    google_item_name: item.googleItemName,
    match_status: item.match.status,
    match_confidence: item.match.confidence,
    suggested_patch: item.suggestedPatch as Json,
    warnings: item.warnings as Json,
  }));

  const { data, error } = await (db as ReplaceFoodMenusImportReviewsRpcClient).rpc(
    'replace_pending_food_menus_import_reviews',
    {
      p_google_snapshot_id: googleSnapshotId,
      p_projection_snapshot_id: projectionSnapshotId,
      p_restaurant_id: restaurantId,
      p_reviews: payload as Json,
    },
  );

  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => rowToImportReview(row as FoodMenusImportReviewRow));
}

export async function listPendingFoodMenusImportReviews({
  client,
  restaurantId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
}): Promise<ReadonlyArray<FoodMenusImportReviewRecord>> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_import_reviews')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('decision_status', 'pending')
    .order('google_path', { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => rowToImportReview(row as FoodMenusImportReviewRow));
}

export async function readFoodMenusImportReviewForRestaurant({
  client,
  restaurantId,
  reviewId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly reviewId: string;
}): Promise<FoodMenusImportReviewRecord | null> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_import_reviews')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', reviewId)
    .maybeSingle<FoodMenusImportReviewRow>();

  if (error) {
    throw error;
  }
  return data ? rowToImportReview(data) : null;
}

export async function claimFoodMenusImportReviewDecision({
  client,
  restaurantId,
  reviewId,
  decisionAction,
  decidedByUserId = null,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly reviewId: string;
  readonly decisionAction: NonNullable<FoodMenusImportReviewRow['decision_action']>;
  readonly decidedByUserId?: string | null;
}): Promise<FoodMenusImportReviewRecord> {
  const db = getFoodMenusSyncDbClient(client);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_import_reviews')
    .update({
      decision_status: 'processing',
      decision_action: decisionAction,
      decided_by_user_id: decidedByUserId,
      decided_at: now,
      updated_at: now,
    } as never)
    .eq('restaurant_id', restaurantId)
    .eq('id', reviewId)
    .eq('decision_status', 'pending')
    .select('*')
    .maybeSingle<FoodMenusImportReviewRow>();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`restaurant_gbp_food_menu_import_reviews claim failed for ${reviewId}`);
  }
  return rowToImportReview(data);
}

export async function markFoodMenusImportReviewDecision({
  client,
  restaurantId,
  reviewId,
  decisionStatus,
  decisionAction,
  decidedByUserId = null,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly reviewId: string;
  readonly decisionStatus: Extract<
    FoodMenusImportReviewRow['decision_status'],
    'approved' | 'ignored' | 'applied'
  >;
  readonly decisionAction: NonNullable<FoodMenusImportReviewRow['decision_action']>;
  readonly decidedByUserId?: string | null;
}): Promise<FoodMenusImportReviewRecord> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_import_reviews')
    .update({
      decision_status: decisionStatus,
      decision_action: decisionAction,
      decided_by_user_id: decidedByUserId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('restaurant_id', restaurantId)
    .eq('id', reviewId)
    .eq('decision_status', 'processing')
    .select('*')
    .maybeSingle<FoodMenusImportReviewRow>();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`restaurant_gbp_food_menu_import_reviews decision failed for ${reviewId}`);
  }
  return rowToImportReview(data);
}

export async function readFoodMenuSettings({
  client,
  restaurantId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
}): Promise<FoodMenuSettings | null> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_settings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle<FoodMenuSettingsRow>();

  if (error) {
    throw error;
  }
  return data ? rowToFoodMenuSettings(data) : null;
}

export async function upsertFoodMenuSettings({
  client,
  restaurantId,
  menuLabel,
  sourceUrl,
  cuisines,
  languageCode,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly menuLabel?: string | null;
  readonly sourceUrl?: string | null;
  readonly cuisines?: string[] | null;
  readonly languageCode?: string | null;
}): Promise<FoodMenuSettings> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_settings')
    .upsert(
      {
        restaurant_id: restaurantId,
        menu_label: menuLabel ?? null,
        source_url: sourceUrl ?? null,
        cuisines: cuisines ?? [],
        language_code: languageCode ?? null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'restaurant_id' },
    )
    .select('*')
    .single<FoodMenuSettingsRow>();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`restaurant_gbp_food_menu_settings upsert failed for ${restaurantId}`);
  }
  return rowToFoodMenuSettings(data);
}

export async function openFoodMenusPublishAttempt({
  client,
  restaurantId,
  foodMenusName,
  projectedPayload,
  projectedPayloadHash,
  baselineGoogleHash = null,
  projectionSnapshotId = null,
  baselineGoogleSnapshotId = null,
  publishMode = 'manual',
  updateMask = ['menus'],
  requestedByUserId = null,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly foodMenusName: string;
  readonly projectedPayload: GoogleFoodMenusResource;
  readonly projectedPayloadHash: string;
  readonly baselineGoogleHash?: string | null;
  readonly projectionSnapshotId?: string | null;
  readonly baselineGoogleSnapshotId?: string | null;
  readonly publishMode?: FoodMenusPublishMode;
  readonly updateMask?: string[];
  readonly requestedByUserId?: string | null;
}): Promise<FoodMenusPublishAttempt> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_publish_attempts')
    .insert({
      restaurant_id: restaurantId,
      projection_snapshot_id: projectionSnapshotId,
      baseline_google_snapshot_id: baselineGoogleSnapshotId,
      provider: DUAL_SYNC_PROVIDER,
      status: 'pending',
      publish_mode: publishMode,
      food_menus_name: foodMenusName,
      update_mask: updateMask,
      projected_payload: projectedPayload as Json,
      baseline_google_hash: baselineGoogleHash,
      projected_payload_hash: projectedPayloadHash,
      requested_by_user_id: requestedByUserId,
    } as never)
    .select('*')
    .single<FoodMenusPublishAttemptRow>();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('restaurant_gbp_food_menu_publish_attempts insert returned no row');
  }
  return rowToPublishAttempt(data);
}

export async function markFoodMenusPublishAttemptRunning({
  client,
  attemptId,
}: {
  readonly client: DbClient;
  readonly attemptId: string;
}): Promise<FoodMenusPublishAttempt> {
  return updateFoodMenusPublishAttempt({
    client,
    attemptId,
    values: {
      status: 'running',
      started_at: new Date().toISOString(),
    },
  });
}

export async function finishFoodMenusPublishAttempt({
  client,
  attemptId,
  status,
  googleResponse = null,
  errorCode = null,
  errorMessage = null,
}: {
  readonly client: DbClient;
  readonly attemptId: string;
  readonly status: Extract<
    FoodMenusPublishStatus,
    'succeeded' | 'failed' | 'preflight_failed' | 'cancelled'
  >;
  readonly googleResponse?: unknown;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
}): Promise<FoodMenusPublishAttempt> {
  return updateFoodMenusPublishAttempt({
    client,
    attemptId,
    values: {
      status,
      google_response: googleResponse as Json,
      error_code: errorCode,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    },
  });
}

async function updateFoodMenusPublishAttempt({
  client,
  attemptId,
  values,
}: {
  readonly client: DbClient;
  readonly attemptId: string;
  readonly values: Partial<FoodMenusPublishAttemptRow>;
}): Promise<FoodMenusPublishAttempt> {
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_publish_attempts')
    .update(values as never)
    .eq('id', attemptId)
    .select('*')
    .single<FoodMenusPublishAttemptRow>();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`restaurant_gbp_food_menu_publish_attempts update failed for ${attemptId}`);
  }
  return rowToPublishAttempt(data);
}
