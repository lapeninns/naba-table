import { DUAL_SYNC_PROVIDER } from '@/server/dual-sync/types';

import { rowToPublishAttempt } from './food-menus-storage-mappers';

import type { GoogleFoodMenusResource } from './food-menus';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export type FoodMenusPublishStatus =
  | 'pending'
  | 'preflight_failed'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type FoodMenusPublishMode = 'manual' | 'scheduled' | 'dry_run';

export interface FoodMenusPublishAttemptRow {
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

type FoodMenusPublishAttemptDatabase = {
  public: {
    Tables: {
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

type FoodMenusPublishAttemptDbClient = SupabaseClient<FoodMenusPublishAttemptDatabase>;

function getFoodMenusPublishAttemptDbClient(client: DbClient): FoodMenusPublishAttemptDbClient {
  return client as unknown as FoodMenusPublishAttemptDbClient;
}

export async function openFoodMenusPublishAttempt({
  client,
  restaurantId,
  foodMenusName,
  projectedPayload: _projectedPayload,
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
  const db = getFoodMenusPublishAttemptDbClient(client);
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
      projected_payload: {},
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
  googleResponse: _googleResponse = null,
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
      google_response: null,
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
  const db = getFoodMenusPublishAttemptDbClient(client);
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
