import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig } from '../../registry';

import type { DualSyncFieldConfig } from '../../registry';
import type { DualSyncCanonicalSnapshot } from '../../snapshots/types';
import type { DualSyncOperationResult } from '../types';
import type { UpdateRestaurantDetailsInput } from '@/server/restaurants/details';

export const PROFILE_IMPORT_TO_DETAILS_FIELD = {
  'profile.name': 'name',
  'profile.businessDescription': 'businessDescription',
  'profile.contactPhone': 'contactPhone',
  'profile.address': 'address',
  'profile.googleMapUrl': 'googleMapUrl',
  'profile.googleReviewUrl': 'googleReviewUrl',
} as const satisfies Record<string, keyof UpdateRestaurantDetailsInput>;

export type ProfileImportFieldKey = keyof typeof PROFILE_IMPORT_TO_DETAILS_FIELD;

export function isProfileImportFieldKey(fieldKey: string): fieldKey is ProfileImportFieldKey {
  return Object.prototype.hasOwnProperty.call(PROFILE_IMPORT_TO_DETAILS_FIELD, fieldKey);
}

export function buildProfileImportPortFailure(
  message: string,
  retryable = false,
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: { code: 'PORT_FAILURE', message, retryable },
  };
}

export function buildProfileImportRegistryFailure(fieldKey: string): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'INVALID_DECISION',
      message: `Field ${fieldKey} is not in the registry.`,
      retryable: false,
    },
  };
}

export function resolveProfileImportFieldConfig(
  registry: ReadonlyArray<DualSyncFieldConfig>,
  fieldKey: string,
):
  | {
      readonly status: 'ready';
      readonly config: DualSyncFieldConfig;
    }
  | {
      readonly status: 'failed';
      readonly result: DualSyncOperationResult;
    } {
  const config = findFieldConfig(registry, fieldKey);
  if (!config) {
    return { status: 'failed', result: buildProfileImportRegistryFailure(fieldKey) };
  }
  if (!config.importable) {
    return {
      status: 'failed',
      result: buildProfileImportPortFailure(`Field ${fieldKey} is not importable.`),
    };
  }
  return { status: 'ready', config };
}

export type ProfileImportProjection =
  | {
      readonly status: 'ready';
      readonly detailsKey: keyof UpdateRestaurantDetailsInput;
      readonly rawGbpValue: string | null;
      readonly normalizedGbpValue: unknown;
    }
  | {
      readonly status: 'failed';
      readonly result: DualSyncOperationResult;
    };

export function projectProfileImportValue(args: {
  readonly fieldKey: ProfileImportFieldKey;
  readonly config: DualSyncFieldConfig;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
}): ProfileImportProjection {
  const profileSection = args.gbpSnapshot.profile;
  if (!profileSection) {
    return {
      status: 'failed',
      result: buildProfileImportPortFailure('Google snapshot is missing profile data.', true),
    };
  }

  const profileKey = args.fieldKey.split('.')[1] as keyof typeof profileSection;
  const rawGbpValue = profileSection[profileKey] ?? null;
  if (rawGbpValue !== null && typeof rawGbpValue !== 'string') {
    return {
      status: 'failed',
      result: buildProfileImportPortFailure(
        `Profile import port cannot project non-scalar value for ${args.fieldKey}.`,
      ),
    };
  }

  return {
    status: 'ready',
    detailsKey: PROFILE_IMPORT_TO_DETAILS_FIELD[args.fieldKey],
    rawGbpValue,
    normalizedGbpValue: args.config.normalizeCoreValue(rawGbpValue),
  };
}

export function buildProfileImportDetailsPartial(args: {
  readonly timezone: string;
  readonly detailsKey: keyof UpdateRestaurantDetailsInput;
  readonly normalizedGbpValue: unknown;
}): UpdateRestaurantDetailsInput {
  const partial: UpdateRestaurantDetailsInput = {
    timezone: args.timezone,
  };
  (partial as Record<string, unknown>)[args.detailsKey] = args.normalizedGbpValue;
  return partial;
}

export function buildProfileImportSuccess(args: {
  readonly config: DualSyncFieldConfig;
  readonly normalizedGbpValue: unknown;
  readonly rawGbpValue: string | null;
}): DualSyncOperationResult {
  const afterCoreHash = hashCanonicalJson(
    args.config.canonicalizeCoreValue(args.normalizedGbpValue),
  );
  const afterGbpHash = hashCanonicalJson(args.config.canonicalizeGbpValue(args.rawGbpValue));

  return {
    status: 'succeeded',
    afterCoreHash,
    afterGbpHash,
  };
}
