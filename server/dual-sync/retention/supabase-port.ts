import type {
  ContentRetentionPort,
  RetentionAction,
  RetentionRun,
  RetentionStoreResult,
} from './engine';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type RpcRow = Database['public']['CompositeTypes']['gbp_content_retention_result_v1'];
type ReadinessRow = Database['public']['CompositeTypes']['gbp_content_retention_readiness_v1'];

export class ContentRetentionRpcError extends Error {
  constructor(
    readonly operation:
      | 'census'
      | 'purge'
      | 'readiness'
      | 'fence_read'
      | 'observation'
      | 'inheritance',
  ) {
    super(`GBP content retention ${operation} RPC failed`);
    this.name = 'ContentRetentionRpcError';
  }
}

function retentionAction(value: string | null): RetentionAction {
  switch (value) {
    case 'delete':
    case 'scrub':
    case 'stop_persisting':
    case 'metadata_only':
    case 'external_gate':
      return value;
    default:
      throw new ContentRetentionRpcError('census');
  }
}

function mapRow(row: RpcRow): RetentionStoreResult {
  return {
    storeKey: row.store_key ?? 'unknown_store',
    action: retentionAction(row.action),
    matchedCount: Number(row.matched_count ?? 0),
    mutatedCount: Number(row.mutated_count ?? 0),
    oldestExpiresAt: row.oldest_expires_at,
    moreLikely: row.more_likely ?? false,
  };
}

async function invoke(client: DbClient, run: RetentionRun, dryRun: boolean) {
  const { data, error } = await client.rpc('run_gbp_content_retention_v1', {
    p_now: run.now,
    p_limit: run.limit,
    p_time_budget_ms: run.timeBudgetMs,
    p_dry_run: dryRun,
    p_restaurant_id: run.scope?.restaurantId ?? null,
    p_external_profile_row_id: run.scope?.externalProfileRowId ?? null,
    p_connection_generation: run.scope?.connectionGeneration ?? null,
    p_consent_epoch: run.scope?.consentEpoch ?? null,
  });
  if (error || !data) throw new ContentRetentionRpcError(dryRun ? 'census' : 'purge');
  return data.map(mapRow);
}

export function createSupabaseContentRetentionPort(client: DbClient): ContentRetentionPort {
  return {
    census: (run) => invoke(client, run, true),
    purge: (run) => invoke(client, run, false),
  };
}

export async function loadContentRetentionReadiness(
  client: DbClient,
  now: Date,
): Promise<ReadinessRow> {
  const { data, error } = await client.rpc('get_gbp_content_retention_readiness_v1', {
    p_now: now.toISOString(),
  });
  if (error || !data) throw new ContentRetentionRpcError('readiness');
  return data;
}

export type FreshContentObservation = DisconnectedProfileFence & {
  readonly storeKey: string;
  readonly sourceRowId: string;
  readonly contentFields: readonly string[];
  readonly valueHashes: readonly string[];
  readonly observedAt: string;
};

export async function recordFreshContentObservation(
  client: DbClient,
  observation: FreshContentObservation,
) {
  const { data, error } = await client.rpc('record_gbp_content_observation_v1', {
    p_restaurant_id: observation.restaurantId,
    p_external_profile_row_id: observation.externalProfileRowId,
    p_external_account_id: observation.externalAccountId,
    p_external_profile_id: observation.externalProfileId,
    p_external_location_id: observation.externalLocationId,
    p_connection_generation: observation.connectionGeneration,
    p_consent_epoch: observation.consentEpoch,
    p_store_key: observation.storeKey,
    p_source_row_id: observation.sourceRowId,
    p_content_fields: [...observation.contentFields],
    p_value_hashes: [...observation.valueHashes],
    p_observed_at: observation.observedAt,
  });
  if (error || !data) throw new ContentRetentionRpcError('observation');
  return data;
}

export type InheritedContentObservation = Pick<
  DisconnectedProfileFence,
  'restaurantId' | 'externalProfileRowId' | 'connectionGeneration' | 'consentEpoch'
> & {
  readonly parentLineageId: string;
  readonly targetStoreKey: string;
  readonly targetSourceRowId: string;
  readonly targetContentField: string;
};

export async function inheritContentObservation(
  client: DbClient,
  observation: InheritedContentObservation,
) {
  const { data, error } = await client.rpc('inherit_gbp_content_lineage_v1', {
    p_restaurant_id: observation.restaurantId,
    p_external_profile_row_id: observation.externalProfileRowId,
    p_connection_generation: observation.connectionGeneration,
    p_consent_epoch: observation.consentEpoch,
    p_parent_lineage_id: observation.parentLineageId,
    p_target_store_key: observation.targetStoreKey,
    p_target_source_row_id: observation.targetSourceRowId,
    p_target_content_field: observation.targetContentField,
  });
  if (error || !data) throw new ContentRetentionRpcError('inheritance');
  return data;
}

export type DisconnectedProfileFence = {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly externalAccountId: string;
  readonly externalProfileId: string;
  readonly externalLocationId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
};

export async function loadCurrentGoogleContentFence(
  client: DbClient,
  restaurantId: string,
): Promise<DisconnectedProfileFence | null> {
  const { data, error } = await client
    .from('restaurant_external_profiles')
    .select(
      'id,restaurant_id,external_account_id,external_profile_id,external_location_id,connection_generation,consent_epoch',
    )
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'google_business_profile')
    .eq('connection_status', 'linked')
    .maybeSingle();
  if (error) throw new ContentRetentionRpcError('fence_read');
  if (!data?.external_account_id || !data.external_profile_id || !data.external_location_id) {
    return null;
  }
  return {
    restaurantId: data.restaurant_id,
    externalProfileRowId: data.id,
    externalAccountId: data.external_account_id,
    externalProfileId: data.external_profile_id,
    externalLocationId: data.external_location_id,
    connectionGeneration: data.connection_generation,
    consentEpoch: data.consent_epoch,
  };
}

export async function purgeDisconnectedProfile(
  client: DbClient,
  fence: DisconnectedProfileFence,
): Promise<number> {
  const { data, error } = await client.rpc('purge_gbp_profile_content_v1', {
    p_restaurant_id: fence.restaurantId,
    p_external_profile_row_id: fence.externalProfileRowId,
    p_external_account_id: fence.externalAccountId,
    p_external_profile_id: fence.externalProfileId,
    p_external_location_id: fence.externalLocationId,
    p_connection_generation: fence.connectionGeneration,
    p_consent_epoch: fence.consentEpoch,
  });
  if (error || data === null) throw new ContentRetentionRpcError('purge');
  return data;
}
