import { describe, expect, it, vi } from 'vitest';

import {
  inheritContentObservation,
  purgeDisconnectedProfile,
  recordFreshContentObservation,
} from '@/server/dual-sync/retention/supabase-port';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

function clientWithRpc(result: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn(async () => result),
  } as unknown as SupabaseClient<Database>;
}

const fence = {
  restaurantId: 'restaurant-1',
  externalProfileRowId: 'profile-row-1',
  externalAccountId: 'account-1',
  externalProfileId: 'profile-1',
  externalLocationId: 'location-1',
  connectionGeneration: 4,
  consentEpoch: 7,
};

describe('GBP retention Supabase port', () => {
  it('records fresh observations with the complete current profile fence', async () => {
    const client = clientWithRpc({ data: [{ id: 'lineage-1' }], error: null });
    await recordFreshContentObservation(client, {
      ...fence,
      storeKey: 'dual_sync_snapshot_runs',
      sourceRowId: 'snapshot-1',
      contentFields: ['raw_payload'],
      valueHashes: ['a'.repeat(64)],
      observedAt: '2026-08-09T00:00:00.000Z',
    });
    expect(client.rpc).toHaveBeenCalledWith('record_gbp_content_observation_v1', {
      p_restaurant_id: 'restaurant-1',
      p_external_profile_row_id: 'profile-row-1',
      p_external_account_id: 'account-1',
      p_external_profile_id: 'profile-1',
      p_external_location_id: 'location-1',
      p_connection_generation: 4,
      p_consent_epoch: 7,
      p_store_key: 'dual_sync_snapshot_runs',
      p_source_row_id: 'snapshot-1',
      p_content_fields: ['raw_payload'],
      p_value_hashes: ['a'.repeat(64)],
      p_observed_at: '2026-08-09T00:00:00.000Z',
    });
  });

  it('rejects stale-fence observation and never manufactures an expiry', async () => {
    const client = clientWithRpc({ data: null, error: { code: 'STALE_EPOCH' } });
    await expect(
      inheritContentObservation(client, {
        restaurantId: fence.restaurantId,
        externalProfileRowId: fence.externalProfileRowId,
        connectionGeneration: 3,
        consentEpoch: 6,
        parentLineageId: 'lineage-1',
        targetStoreKey: 'dual_sync_field_states',
        targetSourceRowId: 'state-1',
        targetContentField: 'metadata',
      }),
    ).rejects.toMatchObject({ operation: 'inheritance' });
  });

  it('purges disconnect content with the complete old profile fence', async () => {
    const client = clientWithRpc({ data: 12, error: null });
    await expect(purgeDisconnectedProfile(client, fence)).resolves.toBe(12);
    expect(client.rpc).toHaveBeenCalledWith('purge_gbp_profile_content_v1', {
      p_restaurant_id: 'restaurant-1',
      p_external_profile_row_id: 'profile-row-1',
      p_external_account_id: 'account-1',
      p_external_profile_id: 'profile-1',
      p_external_location_id: 'location-1',
      p_connection_generation: 4,
      p_consent_epoch: 7,
    });
  });
});
