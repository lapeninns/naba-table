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

import { getRestaurantDetails, updateRestaurantDetails } from '@/server/restaurants/details';

import {
  buildProfileImportDetailsPartial,
  buildProfileImportPortFailure,
  buildProfileImportSuccess,
  isProfileImportFieldKey,
  projectProfileImportValue,
  resolveProfileImportFieldConfig,
} from './profile-import-domain';
import { buildRegistry } from '../../registry';

import type { DualSyncOperationContext, DualSyncOperationResult } from '../types';

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
  if (!isProfileImportFieldKey(decision.fieldKey)) {
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

  const current = await getRestaurantDetails(restaurantId, client);
  const partial = buildProfileImportDetailsPartial({
    timezone: current.timezone,
    detailsKey: projection.detailsKey,
    normalizedGbpValue: projection.normalizedGbpValue,
  });

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

  return buildProfileImportSuccess({
    config: configResult.config,
    normalizedGbpValue: projection.normalizedGbpValue,
    rawGbpValue: projection.rawGbpValue,
  });
}
