/**
 * Phase 3b of the unified dual-sync engine.
 *
 * Concrete `applyImportToCore` port for the `profile` section. Maps the
 * canonical Google value for one profile field onto the matching slot
 * of `UpdateRestaurantDetailsInput` and calls the legacy section writer
 * directly so the dual-sync `core_writes/details.ts` wrapper does NOT
 * re-queue the same value as an outbound candidate.
 *
 * Non-profile sections fall through to a `failed` result with code
 * `PORT_FAILURE`; Phase 3c will add ports for operating hours, service
 * periods, and business context.
 */

import {
  getRestaurantDetails,
  updateRestaurantDetails,
  type UpdateRestaurantDetailsInput,
} from '@/server/restaurants/details';

import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig, buildRegistry } from '../../registry';

import type { DualSyncOperationContext, DualSyncOperationResult } from '../types';

const PROFILE_TO_DETAILS_FIELD: Record<string, keyof UpdateRestaurantDetailsInput> = {
  'profile.name': 'name',
  'profile.businessDescription': 'businessDescription',
  'profile.contactPhone': 'contactPhone',
  'profile.address': 'address',
  'profile.googleMapUrl': 'googleMapUrl',
  'profile.googleReviewUrl': 'googleReviewUrl',
};

function isProfileFieldKey(fieldKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(PROFILE_TO_DETAILS_FIELD, fieldKey);
}

async function clearNabatableProjectionForImportedProfileField({
  client,
  restaurantId,
  fieldKey,
}: Pick<DualSyncOperationContext, 'client' | 'restaurantId'> & {
  readonly fieldKey: string;
}): Promise<void> {
  if (fieldKey === 'profile.contactPhone') {
    const { error } = await client
      .from('restaurant_phone_numbers')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('source', 'nabatable')
      .eq('managed_by', 'nabatable')
      .eq('phone_kind', 'primary');
    if (error) throw error;
    return;
  }

  if (fieldKey === 'profile.address') {
    const { error } = await client
      .from('restaurant_addresses')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('source', 'nabatable')
      .eq('managed_by', 'nabatable')
      .eq('address_type', 'storefront');
    if (error) throw error;
    return;
  }

  const linkType =
    fieldKey === 'profile.googleMapUrl'
      ? 'google_map'
      : fieldKey === 'profile.googleReviewUrl'
        ? 'google_review'
        : null;
  if (!linkType) return;

  const { error } = await client
    .from('restaurant_links')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('source', 'nabatable')
    .eq('managed_by', 'nabatable')
    .eq('link_type', linkType)
    .eq('link_status', 'current');
  if (error) throw error;
}

/**
 * Concrete `applyImportToCore` for profile fields. Reads the current
 * Core details (so legacy required fields like `timezone` survive the
 * partial update), overlays the imported field with the canonical
 * Google value, and writes back via `updateRestaurantDetails`.
 */
export async function applyProfileImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, gbpSnapshot, coreSnapshot } = ctx;
  if (!isProfileFieldKey(decision.fieldKey)) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Profile import port does not handle field ${decision.fieldKey}.`,
        retryable: false,
      },
    };
  }

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, decision.fieldKey);
  if (!config) {
    return {
      status: 'failed',
      failure: {
        code: 'INVALID_DECISION',
        message: `Field ${decision.fieldKey} is not in the registry.`,
        retryable: false,
      },
    };
  }
  if (!config.importable) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Field ${decision.fieldKey} is not importable.`,
        retryable: false,
      },
    };
  }

  const profileSection = gbpSnapshot.profile;
  if (!profileSection) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: 'Google snapshot is missing profile data.',
        retryable: true,
      },
    };
  }
  const profileKey = decision.fieldKey.split('.')[1] as keyof typeof profileSection;
  const rawGbpValue = profileSection[profileKey] ?? null;
  // Profile fields imported here are scalars (string | null). The
  // structured-address slot is intentionally not handled by this port.
  if (rawGbpValue !== null && typeof rawGbpValue !== 'string') {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Profile import port cannot project non-scalar value for ${decision.fieldKey}.`,
        retryable: false,
      },
    };
  }
  const normalizedGbpValue = config.normalizeCoreValue(rawGbpValue);

  const current = await getRestaurantDetails(restaurantId, client);
  const detailsKey = PROFILE_TO_DETAILS_FIELD[decision.fieldKey];

  const partial: UpdateRestaurantDetailsInput = {
    timezone: current.timezone,
  };
  // We pass through the imported value verbatim; the legacy writer
  // performs its own normalisation, validation, and audit logging.
  (partial as Record<string, unknown>)[detailsKey] = normalizedGbpValue;

  await updateRestaurantDetails(restaurantId, partial, client);
  try {
    await clearNabatableProjectionForImportedProfileField({
      client,
      restaurantId,
      fieldKey: decision.fieldKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Imported ${decision.fieldKey}, but failed to clear the Nabatable projection row: ${message}`,
        retryable: true,
      },
    };
  }

  const afterCoreHash = hashCanonicalJson(config.canonicalizeCoreValue(normalizedGbpValue));
  const afterGbpHash = hashCanonicalJson(config.canonicalizeGbpValue(rawGbpValue));

  return {
    status: 'succeeded',
    afterCoreHash,
    afterGbpHash,
  };
}
