import { randomUUID } from 'node:crypto';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type ExternalProfileRow = Database['public']['Tables']['restaurant_external_profiles']['Row'];
type ExternalSnapshotRow =
  Database['public']['Tables']['restaurant_external_profile_snapshots']['Row'];

export class GoogleBusinessProfileContentFenceError extends Error {
  readonly code = 'GBP_CONTENT_FENCE_REQUIRED';

  constructor() {
    super('Current Google Business Profile connection context is required.');
    this.name = 'GoogleBusinessProfileContentFenceError';
  }
}

export interface GoogleBusinessProfileContentFence {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly externalAccountId: string;
  readonly externalProfileId: string;
  readonly externalLocationId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
}

export function requireGoogleBusinessProfileContentFence(
  restaurantId: string,
  profile: ExternalProfileRow,
): GoogleBusinessProfileContentFence {
  if (
    profile.restaurant_id !== restaurantId ||
    profile.provider !== 'google_business_profile' ||
    !profile.external_account_id ||
    !profile.external_profile_id ||
    !profile.external_location_id
  ) {
    throw new GoogleBusinessProfileContentFenceError();
  }
  return {
    restaurantId,
    externalProfileRowId: profile.id,
    externalAccountId: profile.external_account_id,
    externalProfileId: profile.external_profile_id,
    externalLocationId: profile.external_location_id,
    connectionGeneration: profile.connection_generation,
    consentEpoch: profile.consent_epoch,
  };
}

export async function resolveGoogleBusinessProfileContentFence(params: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly externalProfileRowId?: string | null;
}): Promise<GoogleBusinessProfileContentFence> {
  let query = params.client
    .from('restaurant_external_profiles')
    .select('*')
    .eq('restaurant_id', params.restaurantId)
    .eq('provider', 'google_business_profile');
  if (params.externalProfileRowId) query = query.eq('id', params.externalProfileRowId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new GoogleBusinessProfileContentFenceError();
  return requireGoogleBusinessProfileContentFence(params.restaurantId, data);
}

function fenceArgs(fence: GoogleBusinessProfileContentFence) {
  return {
    p_restaurant_id: fence.restaurantId,
    p_external_profile_row_id: fence.externalProfileRowId,
    p_external_account_id: fence.externalAccountId,
    p_external_profile_id: fence.externalProfileId,
    p_external_location_id: fence.externalLocationId,
    p_connection_generation: fence.connectionGeneration,
    p_consent_epoch: fence.consentEpoch,
  };
}

export async function persistGoogleBusinessProfileRawSnapshot(params: {
  readonly client: DbClient;
  readonly fence: GoogleBusinessProfileContentFence;
  readonly snapshotType: 'location' | 'attributes';
  readonly payload: Json;
  readonly sourceRevision: string | null;
  readonly observedAt: string;
  readonly snapshotId?: string;
}): Promise<ExternalSnapshotRow> {
  const { data, error } = await params.client.rpc('persist_gbp_external_profile_snapshot_v1', {
    ...fenceArgs(params.fence),
    p_snapshot_id: params.snapshotId ?? randomUUID(),
    p_snapshot_type: params.snapshotType,
    p_payload: params.payload,
    p_source_revision: params.sourceRevision,
    p_observed_at: params.observedAt,
  });
  if (error) throw error;
  if (!data) throw new Error('GBP snapshot persistence returned no row');
  return data;
}

export async function readCurrentGoogleBusinessProfileRawSnapshots(params: {
  readonly client: DbClient;
  readonly fence: GoogleBusinessProfileContentFence;
  readonly snapshotType?: 'location' | 'attributes' | null;
  readonly now?: string;
}): Promise<ReadonlyArray<ExternalSnapshotRow>> {
  const { data, error } = await params.client.rpc('get_current_gbp_external_profile_snapshots_v1', {
    ...fenceArgs(params.fence),
    p_snapshot_type: params.snapshotType ?? null,
    ...(params.now ? { p_now: params.now } : {}),
  });
  if (error) throw error;
  return data ?? [];
}

export async function persistGoogleBusinessProfileFoodMenusSnapshot(params: {
  readonly client: DbClient;
  readonly fence: GoogleBusinessProfileContentFence;
  readonly source: string;
  readonly foodMenusName: string | null;
  readonly rawFoodMenus: Json;
  readonly googleEtag: string | null;
  readonly observedAt: string;
  readonly snapshotId?: string;
}) {
  const { data, error } = await params.client.rpc('persist_gbp_food_menu_snapshot_v1', {
    ...fenceArgs(params.fence),
    p_snapshot_id: params.snapshotId ?? randomUUID(),
    p_source: params.source,
    p_food_menus_name: params.foodMenusName,
    p_raw_food_menus: params.rawFoodMenus,
    p_google_etag: params.googleEtag,
    p_observed_at: params.observedAt,
  });
  if (error) throw error;
  if (!data) throw new Error('GBP FoodMenus snapshot persistence returned no row');
  return data;
}

export async function readCurrentGoogleBusinessProfileFoodMenusSnapshots(params: {
  readonly client: DbClient;
  readonly fence: GoogleBusinessProfileContentFence;
  readonly now?: string;
}) {
  const { data, error } = await params.client.rpc('get_current_gbp_food_menu_snapshots_v1', {
    ...fenceArgs(params.fence),
    ...(params.now ? { p_now: params.now } : {}),
  });
  if (error) throw error;
  return data ?? [];
}
