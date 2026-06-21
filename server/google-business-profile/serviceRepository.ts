import { logger } from '@/lib/logger';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DbClient = SupabaseClient<Database>;
export type ExternalProfileRow =
  Database['public']['Tables']['restaurant_external_profiles']['Row'];
export type CredentialRow =
  Database['public']['Tables']['restaurant_external_profile_credentials']['Row'];
export type OAuthStateRow =
  Database['public']['Tables']['restaurant_external_profile_oauth_states']['Row'];
type SyncRunInsert =
  Database['public']['Tables']['restaurant_external_profile_sync_runs']['Insert'];

const GOOGLE_BUSINESS_PROFILE_PROVIDER = 'google_business_profile';
const gbpRepositoryLogger = logger.child({ module: 'gbp' });

export async function findExternalProfile(
  restaurantId: string,
  client: DbClient,
): Promise<ExternalProfileRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profiles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureExternalProfile(
  restaurantId: string,
  client: DbClient,
): Promise<ExternalProfileRow> {
  const existing = await findExternalProfile(restaurantId, client);
  if (existing) {
    return existing;
  }

  const { data, error } = await client
    .from('restaurant_external_profiles')
    .insert({
      restaurant_id: restaurantId,
      provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
      connection_status: 'unlinked',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getCredentialRow(
  externalProfileId: string,
  client: DbClient,
): Promise<CredentialRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_credentials')
    .select('*')
    .eq('external_profile_id', externalProfileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertCredential(
  payload: Database['public']['Tables']['restaurant_external_profile_credentials']['Insert'],
  client: DbClient,
): Promise<void> {
  const { error } = await client.from('restaurant_external_profile_credentials').upsert(payload);

  if (error) {
    throw error;
  }
}

export async function updateCredentialRefresh(
  externalProfileId: string,
  payload: Database['public']['Tables']['restaurant_external_profile_credentials']['Update'],
  client: DbClient,
): Promise<void> {
  const { error } = await client
    .from('restaurant_external_profile_credentials')
    .update(payload)
    .eq('external_profile_id', externalProfileId);

  if (error) {
    throw error;
  }
}

export async function deleteCredentialsForExternalProfile(
  externalProfileId: string,
  client: DbClient,
): Promise<void> {
  const { error } = await client
    .from('restaurant_external_profile_credentials')
    .delete()
    .eq('external_profile_id', externalProfileId);

  if (error) {
    throw error;
  }
}

export async function updateExternalProfile(
  externalProfileId: string,
  payload: Database['public']['Tables']['restaurant_external_profiles']['Update'],
  client: DbClient,
): Promise<void> {
  const { error } = await client
    .from('restaurant_external_profiles')
    .update(payload)
    .eq('id', externalProfileId);

  if (error) {
    throw error;
  }
}

export async function recordSyncRun(
  payload: Omit<SyncRunInsert, 'id' | 'created_at' | 'updated_at'>,
  client: DbClient,
): Promise<void> {
  const { error } = await client.from('restaurant_external_profile_sync_runs').insert(payload);
  if (error) {
    gbpRepositoryLogger.warn('sync run audit insert failed', { error });
  }
}

export async function insertOAuthState(
  payload: Database['public']['Tables']['restaurant_external_profile_oauth_states']['Insert'],
  client: DbClient,
): Promise<void> {
  const { error } = await client.from('restaurant_external_profile_oauth_states').insert(payload);

  if (error) {
    throw error;
  }
}

export async function readOAuthStateByToken(
  stateToken: string,
  client: DbClient,
): Promise<OAuthStateRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_oauth_states')
    .select('*')
    .eq('state_token', stateToken)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function markOAuthStateConsumed(
  params: {
    stateId: string;
    payload: Database['public']['Tables']['restaurant_external_profile_oauth_states']['Update'];
  },
  client: DbClient,
): Promise<boolean> {
  const { data, error } = await client
    .from('restaurant_external_profile_oauth_states')
    .update(params.payload)
    .eq('id', params.stateId)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}
