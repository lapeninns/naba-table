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

export async function hasNotificationLink(
  externalProfileId: string,
  client: DbClient,
): Promise<boolean> {
  const { data, error } = await client
    .from('gbp_notification_restaurant_links_v1')
    .select('external_profile_row_id')
    .eq('external_profile_row_id', externalProfileId)
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.length ?? 0) > 0;
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

export async function createOAuthAttempt(
  args: Database['public']['Functions']['create_gbp_oauth_attempt_v1']['Args'],
  client: DbClient,
): Promise<OAuthStateRow> {
  const { data, error } = await client.rpc('create_gbp_oauth_attempt_v1', args);
  if (error) throw error;
  return data;
}

export async function consumeOAuthAttempt(
  args: Database['public']['Functions']['consume_gbp_oauth_attempt_v1']['Args'],
  client: DbClient,
): Promise<OAuthStateRow> {
  const { data, error } = await client.rpc('consume_gbp_oauth_attempt_v1', args);
  if (error) throw error;
  return data;
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

export async function readOAuthAttemptByHash(
  stateHash: string,
  client: DbClient,
): Promise<OAuthStateRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_oauth_states')
    .select('*')
    .eq('state_hash', stateHash)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function completeOAuthIdentity(
  args: Database['public']['Functions']['complete_gbp_oauth_identity_v1']['Args'],
  client: DbClient,
): Promise<ExternalProfileRow> {
  const { data, error } = await client.rpc('complete_gbp_oauth_identity_v1', args);
  if (error) throw error;
  return data;
}

export async function refreshCredentialFenced(
  args: Database['public']['Functions']['refresh_gbp_credential_v1']['Args'],
  client: DbClient,
): Promise<CredentialRow> {
  const { data, error } = await client.rpc('refresh_gbp_credential_v1', args);
  if (error) throw error;
  return data;
}

export async function transitionConnectionFenced(
  args: Database['public']['Functions']['transition_gbp_connection_v1']['Args'],
  client: DbClient,
): Promise<ExternalProfileRow> {
  const { data, error } = await client.rpc('transition_gbp_connection_v1', args);
  if (error) throw error;
  return data;
}

export async function transitionConnectionProviderFailureFenced(
  args: Database['public']['Functions']['transition_gbp_connection_provider_failure_v1']['Args'],
  client: DbClient,
): Promise<ExternalProfileRow> {
  const { data, error } = await client.rpc('transition_gbp_connection_provider_failure_v1', args);
  if (error) throw error;
  return data;
}

export async function disconnectConnectionFenced(
  args: Database['public']['Functions']['disconnect_gbp_connection_v1']['Args'],
  client: DbClient,
): Promise<ExternalProfileRow> {
  const { data, error } = await client.rpc('disconnect_gbp_connection_v1', args);
  if (error) throw error;
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
