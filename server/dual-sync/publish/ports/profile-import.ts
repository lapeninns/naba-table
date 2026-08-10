/**
 * Phase 3b of the unified dual-sync engine.
 *
 * Concrete `applyImportToCore` port for the `profile` section. Maps the
 * canonical Google value for one profile field and applies it through
 * the exact-fenced provider-import RPC. The RPC owns the Core update and
 * projection cleanup in one transaction.
 *
 * Non-profile sections fall through to a `failed` result with code
 * `PORT_FAILURE`; Phase 3c will add ports for operating hours, service
 * periods, and business context.
 */

import {
  buildProfileImportPortFailure,
  buildProfileImportSuccess,
  isProfileImportFieldKey,
  projectProfileImportValue,
  resolveProfileImportFieldConfig,
} from './profile-import-domain';
import { buildRegistry } from '../../registry';

import type { DualSyncOperationContext, DualSyncOperationResult } from '../types';

const ATOMIC_PROFILE_IMPORT_FIELDS = new Set([
  'profile.name',
  'profile.contactPhone',
  'profile.address',
  'profile.googleMapUrl',
  'profile.googleReviewUrl',
]);
const SAFE_IMPORT_FAILURE_MESSAGE = 'Google profile import could not be applied.';

/**
 * Concrete `applyImportToCore` for the five atomic profile fields.
 * Connection fences come only from the current server-side linked profile.
 */
export async function applyProfileImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, gbpSnapshot, coreSnapshot } = ctx;
  if (!isProfileImportFieldKey(decision.fieldKey)) {
    return buildProfileImportPortFailure(
      `Profile import port does not handle field ${decision.fieldKey}.`,
    );
  }
  if (!ATOMIC_PROFILE_IMPORT_FIELDS.has(decision.fieldKey)) {
    return buildProfileImportPortFailure(
      `Profile import port does not handle field ${decision.fieldKey}.`,
    );
  }

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });
  const configResult = resolveProfileImportFieldConfig(registry, decision.fieldKey);
  if (configResult.status === 'failed') return configResult.result;

  const projection = projectProfileImportValue({
    fieldKey: decision.fieldKey,
    config: configResult.config,
    gbpSnapshot,
  });
  if (projection.status === 'failed') return projection.result;

  const value = projection.normalizedGbpValue;
  if (value !== null && typeof value !== 'string') {
    return buildProfileImportPortFailure(SAFE_IMPORT_FAILURE_MESSAGE);
  }

  try {
    const { data: profile, error: profileError } = await client
      .from('restaurant_external_profiles')
      .select(
        'id, external_account_id, external_profile_id, external_location_id, connection_generation, consent_epoch',
      )
      .eq('restaurant_id', restaurantId)
      .eq('provider', 'google_business_profile')
      .eq('connection_status', 'linked')
      .maybeSingle();
    if (
      profileError ||
      !profile ||
      !profile.external_account_id ||
      !profile.external_profile_id ||
      !profile.external_location_id
    ) {
      return buildProfileImportPortFailure(SAFE_IMPORT_FAILURE_MESSAGE);
    }

    const { data, error } = await client.rpc('apply_gbp_profile_import_to_core_v1', {
      p_restaurant_id: restaurantId,
      p_external_profile_row_id: profile.id,
      p_expected_account_id: profile.external_account_id,
      p_expected_profile_id: profile.external_profile_id,
      p_expected_location_id: profile.external_location_id,
      p_connection_generation: profile.connection_generation,
      p_consent_epoch: profile.consent_epoch,
      p_field_key: decision.fieldKey,
      p_value: value,
    });
    if (error || data === null) {
      return buildProfileImportPortFailure(SAFE_IMPORT_FAILURE_MESSAGE);
    }
  } catch (error) {
    if (error instanceof Error) {
      return buildProfileImportPortFailure(SAFE_IMPORT_FAILURE_MESSAGE);
    }
    throw error;
  }

  return buildProfileImportSuccess({
    config: configResult.config,
    normalizedGbpValue: projection.normalizedGbpValue,
    rawGbpValue: projection.rawGbpValue,
  });
}
