import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig } from '../../registry';

import type { DualSyncFieldConfig } from '../../registry';
import type { DualSyncCanonicalSnapshot } from '../../snapshots/types';
import type { DualSyncOperationResult, DualSyncPublishDecision } from '../types';

export const PROFILE_EXPORT_FIELD_PREFIX = 'profile.';

export type ProfileSimplePushField = 'name' | 'contactPhone';
export type ProfileLocationPatchField = 'address' | 'businessDescription';
export type ProfileUnsupportedExportField =
  | 'googleMapUrl'
  | 'googleReviewUrl'
  | 'storefrontAddress';

export interface ProfileExportBatchPlan {
  readonly supported: true;
  readonly simplePush: ReadonlyArray<{
    readonly fieldKey: string;
    readonly field: ProfileSimplePushField;
  }>;
  readonly locationPatch: ReadonlyArray<{
    readonly fieldKey: string;
    readonly field: ProfileLocationPatchField;
  }>;
  readonly unsupportedKeys: ReadonlyArray<string>;
  readonly handledKeys: ReadonlyArray<string>;
}

export function parseProfileExportField(fieldKey: string): string | null {
  if (!fieldKey.startsWith(PROFILE_EXPORT_FIELD_PREFIX)) return null;
  const tail = fieldKey.slice(PROFILE_EXPORT_FIELD_PREFIX.length);
  return tail.length > 0 ? tail : null;
}

export function buildProfileExportPortFailure(
  message: string,
  retryable = false,
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: { code: 'PORT_FAILURE', message, retryable },
  };
}

export function buildProfileExportUnsupportedFailure(fieldKey: string): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'UNSUPPORTED_FIELD',
      message: `${fieldKey} is not exportable to Google.`,
      retryable: false,
    },
  };
}

export function buildProfileExportUnwiredFailure(fieldKey: string): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'UNSUPPORTED_FIELD',
      message: `Profile field ${fieldKey} has no export wiring.`,
      retryable: false,
    },
  };
}

export function buildProfileExportRegistryFailure(fieldKey: string): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'INVALID_DECISION',
      message: `Field ${fieldKey} is not in the registry.`,
      retryable: false,
    },
  };
}

export function resolveProfileExportFieldConfig(
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
    return { status: 'failed', result: buildProfileExportRegistryFailure(fieldKey) };
  }
  return { status: 'ready', config };
}

export function buildProfileExportSuccess(
  config: DualSyncFieldConfig,
  profile: DualSyncCanonicalSnapshot['profile'],
): DualSyncOperationResult {
  const canonical = config.canonicalizeCoreValue(profile);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

export function isProfileSimplePushField(field: string): field is ProfileSimplePushField {
  return field === 'name' || field === 'contactPhone';
}

export function isProfileLocationPatchField(field: string): field is ProfileLocationPatchField {
  return field === 'address' || field === 'businessDescription';
}

export function isProfileUnsupportedExportField(
  field: string,
): field is ProfileUnsupportedExportField {
  return field === 'googleMapUrl' || field === 'googleReviewUrl' || field === 'storefrontAddress';
}

export type PlanProfileExportBatchResult = { readonly supported: false } | ProfileExportBatchPlan;

export function planProfileExportBatch(
  decisions: ReadonlyArray<DualSyncPublishDecision>,
): PlanProfileExportBatchResult {
  const simplePush: Array<{ fieldKey: string; field: ProfileSimplePushField }> = [];
  const locationPatch: Array<{ fieldKey: string; field: ProfileLocationPatchField }> = [];
  const unsupportedKeys: string[] = [];
  const handledKeys: string[] = [];

  for (const decision of decisions) {
    const field = parseProfileExportField(decision.fieldKey);
    if (field === null) return { supported: false };
    if (isProfileUnsupportedExportField(field)) {
      unsupportedKeys.push(decision.fieldKey);
      continue;
    }
    if (isProfileSimplePushField(field)) {
      simplePush.push({ fieldKey: decision.fieldKey, field });
      handledKeys.push(decision.fieldKey);
      continue;
    }
    if (isProfileLocationPatchField(field)) {
      locationPatch.push({ fieldKey: decision.fieldKey, field });
      handledKeys.push(decision.fieldKey);
      continue;
    }
    return { supported: false };
  }

  return {
    supported: true,
    simplePush,
    locationPatch,
    unsupportedKeys,
    handledKeys,
  };
}

export function applyProfileBatchFailure(
  perField: Record<string, DualSyncOperationResult>,
  fieldKeys: ReadonlyArray<string>,
  message: string,
): Record<string, DualSyncOperationResult> {
  const next = { ...perField };
  for (const fieldKey of fieldKeys) {
    next[fieldKey] = buildProfileExportPortFailure(message, true);
  }
  return next;
}
