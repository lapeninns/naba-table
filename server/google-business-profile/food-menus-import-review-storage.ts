import { rowToImportReview } from './food-menus-storage-mappers';

import type { GoogleFoodMenusImportReview } from './food-menus';
import type { FoodMenusImportReviewDecisionAction } from './food-menus-import-decision-domain';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface FoodMenusImportReviewRow {
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
  decision_status:
    | 'pending'
    | 'processing'
    | 'approved'
    | 'ignored'
    | 'applied'
    | 'superseded'
    | 'failed';
  decision_action: FoodMenusImportReviewDecisionAction | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
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

type FoodMenusImportReviewDatabase = {
  public: {
    Tables: {
      restaurant_gbp_food_menu_import_reviews: {
        Row: FoodMenusImportReviewRow;
        Insert: Partial<FoodMenusImportReviewRow> &
          Pick<FoodMenusImportReviewRow, 'restaurant_id' | 'match_status' | 'match_confidence'>;
        Update: Partial<FoodMenusImportReviewRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type FoodMenusImportReviewDbClient = SupabaseClient<FoodMenusImportReviewDatabase>;
function getFoodMenusImportReviewDbClient(client: DbClient): FoodMenusImportReviewDbClient {
  return client as unknown as FoodMenusImportReviewDbClient;
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
  void client;
  void restaurantId;
  void googleSnapshotId;
  void projectionSnapshotId;
  void review;
  return [];
}

export async function listPendingFoodMenusImportReviews({
  client,
  restaurantId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
}): Promise<ReadonlyArray<FoodMenusImportReviewRecord>> {
  const db = getFoodMenusImportReviewDbClient(client);
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
  const db = getFoodMenusImportReviewDbClient(client);
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
  const db = getFoodMenusImportReviewDbClient(client);
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
  const db = getFoodMenusImportReviewDbClient(client);
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

export async function markFoodMenusImportReviewDecisionFailed({
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
  const db = getFoodMenusImportReviewDbClient(client);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('restaurant_gbp_food_menu_import_reviews')
    .update({
      decision_status: 'failed',
      decision_action: decisionAction,
      decided_by_user_id: decidedByUserId,
      decided_at: now,
      updated_at: now,
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
    throw new Error(`restaurant_gbp_food_menu_import_reviews failure mark failed for ${reviewId}`);
  }
  return rowToImportReview(data);
}
