import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_PROFILES_PER_RUN = 50;
const MAX_GRANTS_PER_PROFILE = 100;
const MAX_GRANTS_PER_RUN = 500;
const STALE_DISPATCH_MS = 5 * 60 * 1_000;

export type GbpGrantRecoveryFence = {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly externalAccountId: string;
  readonly externalProfileId: string;
  readonly externalLocationId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
};

type RecoverFenceInput = {
  readonly fence: GbpGrantRecoveryFence;
  readonly cutoff: string;
  readonly now: string;
  readonly limit: number;
};

export interface GbpDispatchedGrantRecoveryPort {
  listCurrentFences(input: {
    readonly cutoff: string;
    readonly limit: number;
  }): Promise<readonly GbpGrantRecoveryFence[]>;
  recoverFence(
    input: RecoverFenceInput,
  ): Promise<{ readonly kind: 'recovered'; readonly count: number } | { readonly kind: 'failed' }>;
}

export type GbpDispatchedGrantRecoverySummary = {
  readonly mode: 'mutated';
  readonly cutoff: string;
  readonly profilesConsidered: number;
  readonly profilesProcessed: number;
  readonly recovered: number;
  readonly capped: boolean;
  readonly errors: readonly {
    readonly restaurantId: string;
    readonly externalProfileRowId: string;
    readonly code: 'grant_recovery_failed';
  }[];
};

export function createSupabaseGbpDispatchedGrantRecoveryPort(
  client: SupabaseClient<Database>,
): GbpDispatchedGrantRecoveryPort {
  return {
    async listCurrentFences(input) {
      const candidates = await client
        .from('gbp_write_grants_v1')
        .select('external_profile_row_id')
        .eq('status', 'dispatched')
        .lte('dispatched_at', input.cutoff)
        .order('dispatched_at', { ascending: true })
        .limit(MAX_GRANTS_PER_RUN);
      if (candidates.error) throw candidates.error;
      const profileRowIds = [
        ...new Set((candidates.data ?? []).map((row) => row.external_profile_row_id)),
      ];
      if (profileRowIds.length === 0) return [];

      const result = await client
        .from('restaurant_external_profiles')
        .select(
          'id,restaurant_id,external_account_id,external_profile_id,external_location_id,connection_generation,consent_epoch',
        )
        .eq('provider', 'google_business_profile')
        .in('id', profileRowIds)
        .not('external_account_id', 'is', null)
        .not('external_profile_id', 'is', null)
        .not('external_location_id', 'is', null)
        .order('id', { ascending: true })
        .limit(input.limit);
      if (result.error) throw result.error;
      return (result.data ?? []).flatMap((row) => {
        if (!row.external_account_id || !row.external_profile_id || !row.external_location_id) {
          return [];
        }
        return [
          {
            restaurantId: row.restaurant_id,
            externalProfileRowId: row.id,
            externalAccountId: row.external_account_id,
            externalProfileId: row.external_profile_id,
            externalLocationId: row.external_location_id,
            connectionGeneration: row.connection_generation,
            consentEpoch: row.consent_epoch,
          },
        ];
      });
    },
    async recoverFence(input) {
      const result = await client.rpc('recover_stale_gbp_dispatched_grants_v1', {
        p_restaurant_id: input.fence.restaurantId,
        p_external_profile_row_id: input.fence.externalProfileRowId,
        p_external_account_id: input.fence.externalAccountId,
        p_external_profile_id: input.fence.externalProfileId,
        p_external_location_id: input.fence.externalLocationId,
        p_connection_generation: input.fence.connectionGeneration,
        p_consent_epoch: input.fence.consentEpoch,
        p_cutoff: input.cutoff,
        p_limit: input.limit,
        p_now: input.now,
      });
      if (result.error) return { kind: 'failed' };
      return { kind: 'recovered', count: result.data.length };
    },
  };
}

export async function recoverStaleGbpDispatchedGrants(input: {
  readonly port: GbpDispatchedGrantRecoveryPort;
  readonly now: Date;
}): Promise<GbpDispatchedGrantRecoverySummary> {
  const now = input.now.toISOString();
  const cutoff = new Date(input.now.getTime() - STALE_DISPATCH_MS).toISOString();
  const fences = await input.port.listCurrentFences({
    cutoff,
    limit: MAX_PROFILES_PER_RUN,
  });
  const errors: Array<GbpDispatchedGrantRecoverySummary['errors'][number]> = [];
  let recovered = 0;
  let profilesProcessed = 0;

  for (const fence of fences) {
    const remaining = MAX_GRANTS_PER_RUN - recovered;
    if (remaining <= 0) break;
    profilesProcessed += 1;
    const result = await input.port.recoverFence({
      fence,
      cutoff,
      now,
      limit: Math.min(MAX_GRANTS_PER_PROFILE, remaining),
    });
    switch (result.kind) {
      case 'recovered':
        recovered += Math.min(Math.max(result.count, 0), remaining);
        break;
      case 'failed':
        errors.push({
          restaurantId: fence.restaurantId,
          externalProfileRowId: fence.externalProfileRowId,
          code: 'grant_recovery_failed',
        });
        break;
    }
  }

  return {
    mode: 'mutated',
    cutoff,
    profilesConsidered: fences.length,
    profilesProcessed,
    recovered,
    capped: recovered >= MAX_GRANTS_PER_RUN,
    errors,
  };
}
