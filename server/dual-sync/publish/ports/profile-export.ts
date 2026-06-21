/**
 * Phase 3f of the unified dual-sync engine.
 *
 * Concrete `applyExportToGoogle` port for `profile.*` fields.
 *
 * Dispatches per-field:
 *   - `name` / `contactPhone` -> legacy `syncRestaurantProfileWithGoogleBusinessProfile`
 *     forced to `push_to_gbp`.
 *   - `address` -> location patch with `storefrontAddress` mask.
 *   - `businessDescription` -> location patch with `profile` mask.
 *   - `googleMapUrl` / `googleReviewUrl` / `storefrontAddress` -> unsupported
 *     (Google read-only or not modelled on the Core side).
 */

import {
  patchRestaurantGoogleBusinessProfileLocationFields,
  syncRestaurantProfileWithGoogleBusinessProfile,
} from '@/server/google-business-profile/service';

import { buildGoogleStorefrontAddressPatch } from './google-patch-builders';
import {
  applyProfileBatchFailure,
  buildProfileExportPortFailure,
  buildProfileExportSuccess,
  buildProfileExportUnsupportedFailure,
  buildProfileExportUnwiredFailure,
  isProfileSimplePushField,
  parseProfileExportField,
  planProfileExportBatch,
  resolveProfileExportFieldConfig,
} from './profile-export-domain';
import { buildRegistry } from '../../registry';

import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

export async function applyProfileExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, coreSnapshot, gbpSnapshot } = ctx;
  const field = parseProfileExportField(decision.fieldKey);
  if (!field) {
    return buildProfileExportPortFailure(
      `Profile export port does not handle ${decision.fieldKey}.`,
    );
  }

  if (field === 'googleMapUrl' || field === 'googleReviewUrl' || field === 'storefrontAddress') {
    return buildProfileExportUnsupportedFailure(decision.fieldKey);
  }

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });
  const configResult = resolveProfileExportFieldConfig(registry, decision.fieldKey);
  if (configResult.status === 'failed') return configResult.result;

  if (isProfileSimplePushField(field)) {
    await syncRestaurantProfileWithGoogleBusinessProfile({
      restaurantId,
      direction: 'push_to_gbp',
      fields: [field],
      client,
    });
  } else if (field === 'address') {
    await patchRestaurantGoogleBusinessProfileLocationFields({
      restaurantId,
      locationPatch: {
        storefrontAddress: buildGoogleStorefrontAddressPatch({
          nabatableAddress: coreSnapshot.profile.address,
          googleAddress: gbpSnapshot.profile.storefrontAddress,
        }),
      },
      updateMask: ['storefrontAddress'],
      client,
    });
  } else if (field === 'businessDescription') {
    await patchRestaurantGoogleBusinessProfileLocationFields({
      restaurantId,
      locationPatch: {
        profile: { description: coreSnapshot.profile.businessDescription ?? '' },
      },
      updateMask: ['profile'],
      client,
    });
  } else {
    return buildProfileExportUnwiredFailure(decision.fieldKey);
  }

  return buildProfileExportSuccess(configResult.config, coreSnapshot.profile);
}

/**
 * Section-level batch port for `profile.*`.
 *
 * Coalesces:
 *   - `name` and `contactPhone` into one
 *     `syncRestaurantProfileWithGoogleBusinessProfile` call.
 *   - `address` and `businessDescription` into one
 *     `patchRestaurantGoogleBusinessProfileLocationFields` call with a
 *     merged `updateMask`.
 *
 * Fields the per-field port marks `UNSUPPORTED_FIELD` (`googleMapUrl`,
 * `googleReviewUrl`, `storefrontAddress`) are reported with the same
 * code on the batch path so the operator UX stays identical.
 */
export async function applyProfileExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  const { client, restaurantId, decisions, coreSnapshot, gbpSnapshot } = ctx;
  if (decisions.length === 0) return { supported: true, perField: {} };

  const plan = planProfileExportBatch(decisions);
  if (!plan.supported) return { supported: false };

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });

  const locationPatch: Record<string, unknown> = {};
  const updateMask: string[] = [];

  for (const { field } of plan.locationPatch) {
    if (field === 'address') {
      locationPatch.storefrontAddress = buildGoogleStorefrontAddressPatch({
        nabatableAddress: coreSnapshot.profile.address,
        googleAddress: gbpSnapshot.profile.storefrontAddress,
      });
      updateMask.push('storefrontAddress');
      continue;
    }
    if (field === 'businessDescription') {
      locationPatch.profile = {
        description: coreSnapshot.profile.businessDescription ?? '',
      };
      updateMask.push('profile');
      continue;
    }
  }

  const perField: Record<string, DualSyncOperationResult> = {};

  if (plan.simplePush.length > 0) {
    try {
      await syncRestaurantProfileWithGoogleBusinessProfile({
        restaurantId,
        direction: 'push_to_gbp',
        fields: Array.from(new Set(plan.simplePush.map((entry) => entry.field))),
        client,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Object.assign(
        perField,
        applyProfileBatchFailure(
          perField,
          plan.simplePush.map((entry) => entry.fieldKey),
          `Profile batch push failed: ${message}`,
        ),
      );
    }
  }

  if (updateMask.length > 0) {
    try {
      await patchRestaurantGoogleBusinessProfileLocationFields({
        restaurantId,
        locationPatch,
        updateMask,
        client,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Object.assign(
        perField,
        applyProfileBatchFailure(
          perField,
          plan.locationPatch.map((entry) => entry.fieldKey),
          `Profile batch location patch failed: ${message}`,
        ),
      );
    }
  }

  for (const key of plan.unsupportedKeys) {
    perField[key] = buildProfileExportUnsupportedFailure(key);
  }

  for (const key of plan.handledKeys) {
    if (perField[key]) continue;
    const configResult = resolveProfileExportFieldConfig(registry, key);
    if (configResult.status === 'failed') {
      perField[key] = configResult.result;
      continue;
    }
    perField[key] = buildProfileExportSuccess(configResult.config, coreSnapshot.profile);
  }

  return { supported: true, perField };
}
