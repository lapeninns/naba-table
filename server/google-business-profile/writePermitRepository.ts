import { GoogleBusinessProfileError } from './errors';

import type { DbClient } from './serviceRepository';
import type { GoogleWritePermitBinding, GoogleWritePermitStore } from './writePermit';
import type { Database } from '@/types/supabase';

type ClaimArgs = Database['public']['Functions']['claim_gbp_write_bundle_v1']['Args'];

async function requireRpcData<T>(result: {
  readonly data: T | null;
  readonly error: { readonly message: string } | null;
}): Promise<T> {
  if (result.error) throw result.error;
  if (result.data === null) {
    throw new GoogleBusinessProfileError('Google provider RPC returned no data.', {
      code: 'GBP_PROVIDER_RPC_EMPTY_RESULT',
      status: 500,
    });
  }
  return result.data;
}

export function createGoogleWritePermitStore(
  client: DbClient,
  claimArgs: ClaimArgs,
): GoogleWritePermitStore {
  return {
    claim: async () => requireRpcData(await client.rpc('claim_gbp_write_bundle_v1', claimArgs)),
    dispatch: async (binding: GoogleWritePermitBinding) =>
      requireRpcData(
        await client.rpc('dispatch_gbp_write_grant_v1', {
          p_restaurant_id: binding.restaurantId,
          p_bundle_id: binding.bundleId,
          p_grant_id: binding.grantId,
          p_execution_id: binding.executionId,
          p_bundle_order: binding.bundleOrder,
        }),
      ),
    finalize: async (binding, status, reasonCode) =>
      requireRpcData(
        await client.rpc('finalize_gbp_write_grant_v1', {
          p_restaurant_id: binding.restaurantId,
          p_bundle_id: binding.bundleId,
          p_grant_id: binding.grantId,
          p_execution_id: binding.executionId,
          p_bundle_order: binding.bundleOrder,
          p_status: status,
          p_reason_code: reasonCode,
        }),
      ),
  };
}
