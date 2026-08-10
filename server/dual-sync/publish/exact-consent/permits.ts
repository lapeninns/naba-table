import {
  claimGoogleWritePermit,
  issueGoogleWritePermitsFromClaimedBundle,
} from '@/server/google-business-profile/writePermit';
import { createGoogleWritePermitStore } from '@/server/google-business-profile/writePermitRepository';

import { createExactConsentGrantRepository } from './repository';

import type { DatabaseGoogleWriteQueueEnvelope } from './queue';
import type { ExactConsentGrantBundle } from './repository';
import type {
  GoogleWritePermit,
  GoogleWritePermitBinding,
  GoogleWritePermitStore,
} from '@/server/google-business-profile/writePermit';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type ClaimArgs = Database['public']['Functions']['claim_gbp_write_bundle_v1']['Args'];

export function createExactConsentPermitStore(
  client: DbClient,
  claimArgs: ClaimArgs,
): GoogleWritePermitStore {
  const providerStore = createGoogleWritePermitStore(client, claimArgs);
  const repository = createExactConsentGrantRepository(client);
  return {
    ...providerStore,
    finalize: (binding, status, reasonCode) =>
      repository.finalize(
        {
          restaurantId: binding.restaurantId,
          bundleId: binding.bundleId,
          grantId: binding.grantId,
          executionId: binding.executionId,
          bundleOrder: binding.bundleOrder,
        },
        status,
        reasonCode,
      ),
  };
}

function googleMethod(value: string): 'PATCH' | 'POST' | 'DELETE' {
  switch (value) {
    case 'PATCH':
    case 'POST':
    case 'DELETE':
      return value;
    default:
      throw new TypeError('Exact-consent grant has an unsupported Google method.');
  }
}

function grantHashes(bundle: ExactConsentGrantBundle) {
  return {
    manifestHashes: bundle.rpcArgs.p_grants.map((grant) => grant.manifest_hash),
    requestHashes: bundle.rpcArgs.p_grants.map((grant) => grant.request_hash),
    decisionHashes: bundle.rpcArgs.p_grants.map((grant) => grant.decision_hash),
    updateMaskHashes: bundle.rpcArgs.p_grants.map((grant) => grant.update_masks_hash),
  };
}

export function buildExactConsentPermitClaim(input: {
  readonly bundle: ExactConsentGrantBundle;
  readonly executionId: string;
}): { readonly args: ClaimArgs; readonly bindings: readonly GoogleWritePermitBinding[] } {
  const { bundle, executionId } = input;
  const hashes = grantHashes(bundle);
  const args: ClaimArgs = {
    p_restaurant_id: bundle.rpcArgs.p_restaurant_id,
    p_external_profile_row_id: bundle.rpcArgs.p_external_profile_row_id,
    p_external_account_id: bundle.rpcArgs.p_external_account_id,
    p_external_profile_id: bundle.rpcArgs.p_external_profile_id,
    p_external_location_id: bundle.rpcArgs.p_external_location_id,
    p_connection_generation: bundle.rpcArgs.p_connection_generation,
    p_consent_epoch: bundle.rpcArgs.p_consent_epoch,
    p_bundle_id: bundle.bundleId,
    p_grant_ids: [...bundle.grantIds],
    p_bundle_hash: bundle.bundleHash,
    p_manifest_hashes: hashes.manifestHashes,
    p_request_hashes: hashes.requestHashes,
    p_decision_hashes: hashes.decisionHashes,
    p_update_masks_hashes: hashes.updateMaskHashes,
    p_policy_version: bundle.rpcArgs.p_policy_version,
    p_renderer_version: bundle.rpcArgs.p_renderer_version,
    p_execution_id: executionId,
  };
  const bundleSize = bundle.rpcArgs.p_grants.length;
  const bindings = bundle.rpcArgs.p_grants.map((grant) => ({
    restaurantId: bundle.rpcArgs.p_restaurant_id,
    externalProfileRowId: bundle.rpcArgs.p_external_profile_row_id,
    accountId: bundle.rpcArgs.p_external_account_id,
    profileId: bundle.rpcArgs.p_external_profile_id,
    locationId: bundle.rpcArgs.p_external_location_id,
    connectionGeneration: bundle.rpcArgs.p_connection_generation,
    consentEpoch: bundle.rpcArgs.p_consent_epoch,
    bundleId: bundle.bundleId,
    executionId,
    grantId: grant.grant_id,
    groupId: grant.group_id,
    bundleOrder: grant.bundle_order,
    bundleSize,
    method: googleMethod(grant.google_method),
    resource: grant.google_resource,
    updateMasks: grant.update_masks,
    requestHash: grant.request_hash,
  }));
  return { args, bindings: Object.freeze(bindings) };
}

export async function issueAndClaimExactConsentPermits(input: {
  readonly client: DbClient;
  readonly bundle: ExactConsentGrantBundle;
  readonly executionId: string;
}): Promise<readonly GoogleWritePermit[]> {
  const claim = buildExactConsentPermitClaim(input);
  const rows = await createExactConsentGrantRepository(input.client).issueAndClaim(
    input.bundle.rpcArgs,
    input.executionId,
  );
  const store = createExactConsentPermitStore(input.client, claim.args);
  return issueGoogleWritePermitsFromClaimedBundle(rows, claim.bindings, store);
}

export async function claimQueuedExactConsentPermits(input: {
  readonly client: DbClient;
  readonly envelope: DatabaseGoogleWriteQueueEnvelope;
  readonly executionId: string;
}): Promise<readonly GoogleWritePermit[]> {
  const { envelope } = input;
  const args: ClaimArgs = {
    p_restaurant_id: envelope.restaurant_id,
    p_external_profile_row_id: envelope.external_profile_row_id,
    p_external_account_id: envelope.external_account_id,
    p_external_profile_id: envelope.external_profile_id,
    p_external_location_id: envelope.external_location_id,
    p_connection_generation: envelope.connection_generation,
    p_consent_epoch: envelope.consent_epoch,
    p_bundle_id: envelope.bundle_id,
    p_grant_ids: envelope.grant_ids,
    p_bundle_hash: envelope.bundle_hash,
    p_manifest_hashes: envelope.manifest_hashes,
    p_request_hashes: envelope.groups.map((group) => group.request_hash),
    p_decision_hashes: envelope.groups.map((group) => group.decision_hash),
    p_update_masks_hashes: envelope.groups.map((group) => group.update_masks_hash),
    p_policy_version: envelope.policy_version,
    p_renderer_version: envelope.renderer_version,
    p_execution_id: input.executionId,
  };
  const bindings = envelope.groups.map((group) => ({
    restaurantId: envelope.restaurant_id,
    externalProfileRowId: envelope.external_profile_row_id,
    accountId: envelope.external_account_id,
    profileId: envelope.external_profile_id,
    locationId: envelope.external_location_id,
    connectionGeneration: envelope.connection_generation,
    consentEpoch: envelope.consent_epoch,
    bundleId: envelope.bundle_id,
    executionId: input.executionId,
    grantId: group.grant_id,
    groupId: group.group_id,
    bundleOrder: group.bundle_order,
    bundleSize: envelope.groups.length,
    method: group.google_method,
    resource: group.google_resource,
    updateMasks: group.update_masks,
    requestHash: group.request_hash,
  }));
  return claimGoogleWritePermit(bindings, createExactConsentPermitStore(input.client, args));
}
