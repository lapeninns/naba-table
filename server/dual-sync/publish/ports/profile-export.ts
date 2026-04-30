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
import { hashCanonicalJson } from '../../hashing';
import { buildRegistry, findFieldConfig } from '../../registry';


import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

const FIELD_KEY_PREFIX = 'profile.';

type SimplePushField = 'name' | 'contactPhone';

function parseField(fieldKey: string): string | null {
  if (!fieldKey.startsWith(FIELD_KEY_PREFIX)) return null;
  const tail = fieldKey.slice(FIELD_KEY_PREFIX.length);
  return tail.length > 0 ? tail : null;
}

function failedPort(message: string, retryable = false): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: { code: 'PORT_FAILURE', message, retryable },
  };
}

function failedRegistry(fieldKey: string): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'INVALID_DECISION',
      message: `Field ${fieldKey} is not in the registry.`,
      retryable: false,
    },
  };
}

export async function applyProfileExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, coreSnapshot, gbpSnapshot } = ctx;
  const field = parseField(decision.fieldKey);
  if (!field) return failedPort(`Profile export port does not handle ${decision.fieldKey}.`);

  if (
    field === 'googleMapUrl' ||
    field === 'googleReviewUrl' ||
    field === 'storefrontAddress'
  ) {
    return {
      status: 'failed',
      failure: {
        code: 'UNSUPPORTED_FIELD',
        message: `${decision.fieldKey} is not exportable to Google.`,
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
  if (!config) return failedRegistry(decision.fieldKey);

  if (field === 'name' || field === 'contactPhone') {
    await syncRestaurantProfileWithGoogleBusinessProfile({
      restaurantId,
      direction: 'push_to_gbp',
      fields: [field as SimplePushField],
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
    return {
      status: 'failed',
      failure: {
        code: 'UNSUPPORTED_FIELD',
        message: `Profile field ${decision.fieldKey} has no export wiring.`,
        retryable: false,
      },
    };
  }

  const canonical = config.canonicalizeCoreValue(coreSnapshot.profile);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
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

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });

  const fieldByKey = new Map<string, string | null>();
  for (const decision of decisions) {
    const f = parseField(decision.fieldKey);
    if (f === null) return { supported: false };
    fieldByKey.set(decision.fieldKey, f);
  }

  const simplePushFields: SimplePushField[] = [];
  const locationPatch: Record<string, unknown> = {};
  const updateMask: string[] = [];
  const unsupportedKeys = new Set<string>();
  const handledKeys = new Set<string>();

  for (const [fieldKey, field] of fieldByKey.entries()) {
    if (field === null) continue;
    if (
      field === 'googleMapUrl' ||
      field === 'googleReviewUrl' ||
      field === 'storefrontAddress'
    ) {
      unsupportedKeys.add(fieldKey);
      continue;
    }
    if (field === 'name' || field === 'contactPhone') {
      simplePushFields.push(field as SimplePushField);
      handledKeys.add(fieldKey);
      continue;
    }
    if (field === 'address') {
      locationPatch.storefrontAddress = buildGoogleStorefrontAddressPatch({
        nabatableAddress: coreSnapshot.profile.address,
        googleAddress: gbpSnapshot.profile.storefrontAddress,
      });
      updateMask.push('storefrontAddress');
      handledKeys.add(fieldKey);
      continue;
    }
    if (field === 'businessDescription') {
      locationPatch.profile = {
        description: coreSnapshot.profile.businessDescription ?? '',
      };
      updateMask.push('profile');
      handledKeys.add(fieldKey);
      continue;
    }
    // Unknown profile field — let the per-field path emit a precise error.
    return { supported: false };
  }

  const perField: Record<string, DualSyncOperationResult> = {};

  if (simplePushFields.length > 0) {
    try {
      await syncRestaurantProfileWithGoogleBusinessProfile({
        restaurantId,
        direction: 'push_to_gbp',
        fields: Array.from(new Set(simplePushFields)),
        client,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const [key, field] of fieldByKey.entries()) {
        if (field === 'name' || field === 'contactPhone') {
          perField[key] = {
            status: 'failed',
            failure: {
              code: 'PORT_FAILURE',
              message: `Profile batch push failed: ${message}`,
              retryable: true,
            },
          };
          handledKeys.delete(key);
        }
      }
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
      for (const [key, field] of fieldByKey.entries()) {
        if (field === 'address' || field === 'businessDescription') {
          perField[key] = {
            status: 'failed',
            failure: {
              code: 'PORT_FAILURE',
              message: `Profile batch location patch failed: ${message}`,
              retryable: true,
            },
          };
          handledKeys.delete(key);
        }
      }
    }
  }

  for (const key of unsupportedKeys) {
    perField[key] = {
      status: 'failed',
      failure: {
        code: 'UNSUPPORTED_FIELD',
        message: `${key} is not exportable to Google.`,
        retryable: false,
      },
    };
  }

  for (const key of handledKeys) {
    const config = findFieldConfig(registry, key);
    if (!config) {
      perField[key] = {
        status: 'failed',
        failure: {
          code: 'INVALID_DECISION',
          message: `Field ${key} is not in the registry.`,
          retryable: false,
        },
      };
      continue;
    }
    const canonical = config.canonicalizeCoreValue(coreSnapshot.profile);
    const hash = hashCanonicalJson(canonical);
    perField[key] = { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
  }

  return { supported: true, perField };
}
