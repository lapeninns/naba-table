import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import { DUAL_SYNC_PROVIDER } from '@/server/dual-sync/types';

import { toJson } from './businessInfoNormalization';
import {
  persistGoogleBusinessProfileFoodMenusSnapshot,
  readCurrentGoogleBusinessProfileFoodMenusSnapshots,
  resolveGoogleBusinessProfileContentFence,
} from './contentSnapshotPersistence';
import {
  canonicalizeGoogleFoodMenusResource,
  type CanonicalGoogleFoodMenusResource,
  type GoogleFoodMenusProjection,
  type GoogleFoodMenusProjectedIdentity,
  type GoogleFoodMenusResource,
} from './food-menus';
import { rowToFoodMenuSettings, rowToIdentity, rowToSnapshot } from './food-menus-storage-mappers';
import {
  buildFoodMenuSettingsUpsertPayload,
  buildFoodMenusProjectionSnapshotMetadata,
  buildFoodMenusSnapshotInsertPayload,
  buildProjectedFoodMenusIdentityUpsertPayloads,
} from './food-menus-storage-payloads';

import type { FoodMenusPublishAttemptRow } from './food-menus-publish-attempt-storage';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export type FoodMenusSnapshotKind = 'google_pull' | 'nabatable_projection' | 'preflight';
export type FoodMenusSnapshotSource = 'manual' | 'scheduled' | 'preflight' | 'publish';
export type FoodMenusSnapshotStatus = 'succeeded' | 'failed';
export {
  claimFoodMenusImportReviewDecision,
  listPendingFoodMenusImportReviews,
  markFoodMenusImportReviewDecision,
  markFoodMenusImportReviewDecisionFailed,
  readFoodMenusImportReviewForRestaurant,
  replacePendingFoodMenusImportReviews,
} from './food-menus-import-review-storage';
export type {
  FoodMenusImportReviewRecord,
  FoodMenusImportReviewRow,
} from './food-menus-import-review-storage';
export {
  finishFoodMenusPublishAttempt,
  markFoodMenusPublishAttemptRunning,
  openFoodMenusPublishAttempt,
} from './food-menus-publish-attempt-storage';
export type {
  FoodMenusPublishAttempt,
  FoodMenusPublishAttemptRow,
  FoodMenusPublishMode,
  FoodMenusPublishStatus,
} from './food-menus-publish-attempt-storage';

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

interface FoodMenuSettingsRow {
  restaurant_id: string;
  menu_label: string | null;
  source_url: string | null;
  cuisines: string[];
  language_code: string | null;
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

export interface FoodMenuSettings {
  readonly restaurantId: string;
  readonly menuLabel: string | null;
  readonly sourceUrl: string | null;
  readonly cuisines: string[];
  readonly languageCode: string | null;
  readonly updatedAt: string;
}

function getFoodMenusSyncDbClient(client: DbClient): FoodMenusSyncDbClient {
  return client as unknown as FoodMenusSyncDbClient;
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

type PersistedFoodMenusSnapshotRow = Awaited<
  ReturnType<typeof persistGoogleBusinessProfileFoodMenusSnapshot>
>;

function snapshotKind(value: string): FoodMenusSnapshotKind {
  if (value === 'google_pull' || value === 'nabatable_projection' || value === 'preflight') {
    return value;
  }
  throw new Error('GBP FoodMenus snapshot kind is invalid');
}

function snapshotSource(value: string): FoodMenusSnapshotSource {
  if (value === 'manual' || value === 'scheduled' || value === 'preflight' || value === 'publish') {
    return value;
  }
  throw new Error('GBP FoodMenus snapshot source is invalid');
}

function snapshotStatus(value: string): FoodMenusSnapshotStatus {
  if (value === 'succeeded' || value === 'failed') return value;
  throw new Error('GBP FoodMenus snapshot status is invalid');
}

function normalizePersistedFoodMenusSnapshotRow(
  row: PersistedFoodMenusSnapshotRow,
): FoodMenusSnapshotRow {
  if (row.provider !== DUAL_SYNC_PROVIDER) {
    throw new Error('GBP FoodMenus snapshot row is invalid');
  }
  return {
    ...row,
    provider: DUAL_SYNC_PROVIDER,
    snapshot_kind: snapshotKind(row.snapshot_kind),
    source: snapshotSource(row.source),
    status: snapshotStatus(row.status),
  };
}

export function buildFoodMenusProjectionSnapshotHash({
  projection,
  foodMenusHash,
}: {
  readonly projection: GoogleFoodMenusProjection;
  readonly foodMenusHash: string;
}): string {
  return hashCanonicalJson({
    kind: 'foodMenusProjectionSnapshot',
    foodMenusHash,
    identities: projection.identities.map((identity) => ({
      stableKey: identity.stableKey,
      localItemId: identity.localItemId,
      externalItemId: identity.externalItemId,
      googlePath: identity.googlePath,
      googleOptionPaths: identity.googleOptionPaths,
      projectionKind: identity.projectionKind ?? null,
    })),
  })!;
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
  if (snapshotKind !== 'nabatable_projection' && rawFoodMenus) {
    const fence = await resolveGoogleBusinessProfileContentFence({
      client,
      restaurantId,
      externalProfileRowId: externalProfileId,
    });
    const row = await persistGoogleBusinessProfileFoodMenusSnapshot({
      client,
      fence,
      source,
      foodMenusName,
      rawFoodMenus: toJson(rawFoodMenus),
      googleEtag,
      observedAt: pulledAt ?? new Date().toISOString(),
    });
    return rowToSnapshot(normalizePersistedFoodMenusSnapshotRow(row));
  }
  const db = getFoodMenusSyncDbClient(client);
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_snapshots')
    .insert(
      buildFoodMenusSnapshotInsertPayload({
        restaurantId,
        externalProfileId,
        snapshotKind,
        source,
        status,
        foodMenusName,
        rawFoodMenus,
        canonicalFoodMenus,
        projectionMetadata,
        snapshotHash,
        googleEtag,
        errorCode,
        errorMessage,
        pulledAt,
        createdByUserId,
      }) as never,
    )
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
  if (snapshotKind !== 'nabatable_projection') {
    const fence = await resolveGoogleBusinessProfileContentFence({ client, restaurantId });
    const rows = await readCurrentGoogleBusinessProfileFoodMenusSnapshots({ client, fence });
    const matching = rows.find(
      (row) => snapshotKind === 'google_pull' || row.source === 'preflight',
    );
    return matching ? rowToSnapshot(normalizePersistedFoodMenusSnapshotRow(matching)) : null;
  }
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
  const payload = buildProjectedFoodMenusIdentityUpsertPayloads({
    restaurantId,
    snapshotId,
    identities,
  });

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
  const projectionSnapshotHash = buildFoodMenusProjectionSnapshotHash({
    projection,
    foodMenusHash: snapshotHash,
  });
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
    projectionMetadata: buildFoodMenusProjectionSnapshotMetadata(projection, projectionMetadata),
    snapshotHash: projectionSnapshotHash,
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
      buildFoodMenuSettingsUpsertPayload({
        restaurantId,
        menuLabel,
        sourceUrl,
        cuisines,
        languageCode,
        updatedAt: new Date().toISOString(),
      }) as never,
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
