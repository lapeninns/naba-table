/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Public field-registry entry point. Exposes the static registry (profile,
 * weekly operating hours, core-only) plus a `buildRegistry` helper that
 * extends the static set with dynamic per-restaurant entries for service
 * periods, categories, service areas, attributes, and service items.
 *
 * The diff engine and state computer always consume one registry list per
 * restaurant per snapshot pair, so we never need to mutate the static
 * arrays.
 */

import {
  buildAttributeFields,
  buildCategoryFields,
  buildServiceAreaFields,
  buildServiceItemFields,
} from './business-context';
import { CORE_ONLY_FIELDS } from './core-only';
import { OPERATING_HOURS_FIELDS } from './operating-hours';
import { PROFILE_FIELDS } from './profile';
import { buildServicePeriodFields } from './service-periods';

import type { DualSyncFieldConfig, DualSyncFieldCapability, ResolveCapabilityInput } from './types';

export type {
  DualSyncFieldConfig,
  DualSyncFieldCapability,
  ResolveCapabilityInput,
  DualSyncConflictPolicy,
  DualSyncDeletePolicy,
  DualSyncFieldKind,
  DualSyncDecisionLegality,
} from './types';

export {
  PROFILE_FIELDS,
  OPERATING_HOURS_FIELDS,
  CORE_ONLY_FIELDS,
  buildServicePeriodFields,
  buildCategoryFields,
  buildServiceAreaFields,
  buildAttributeFields,
  buildServiceItemFields,
};

export interface DualSyncCanonicalSnapshotShape {
  readonly profile: unknown;
  readonly operatingHours: unknown;
  readonly servicePeriods: unknown;
  readonly businessContext: {
    readonly categories: unknown;
    readonly serviceAreas: unknown;
    readonly attributes: unknown;
    readonly serviceItems: unknown;
  };
}

export interface BuildRegistryInput {
  readonly coreSnapshot: DualSyncCanonicalSnapshotShape;
  readonly gbpSnapshot: DualSyncCanonicalSnapshotShape;
  readonly includeCoreOnly?: boolean;
}

/**
 * Compose the full per-restaurant field registry. Static fields (profile,
 * operating hours weekly, core-only) come first; dynamic per-row fields
 * (service periods, business-context rows) follow in deterministic order.
 */
export function buildRegistry({
  coreSnapshot,
  gbpSnapshot,
  includeCoreOnly = true,
}: BuildRegistryInput): ReadonlyArray<DualSyncFieldConfig> {
  const dynamicServicePeriods = buildServicePeriodFields({
    coreSnapshot: coreSnapshot.servicePeriods,
    gbpSnapshot: gbpSnapshot.servicePeriods,
  });
  const dynamicCategories = buildCategoryFields({
    coreSnapshot: coreSnapshot.businessContext.categories,
    gbpSnapshot: gbpSnapshot.businessContext.categories,
  });
  const dynamicServiceAreas = buildServiceAreaFields({
    coreSnapshot: coreSnapshot.businessContext.serviceAreas,
    gbpSnapshot: gbpSnapshot.businessContext.serviceAreas,
  });
  const dynamicAttributes = buildAttributeFields({
    coreSnapshot: coreSnapshot.businessContext.attributes,
    gbpSnapshot: gbpSnapshot.businessContext.attributes,
  });
  const dynamicServiceItems = buildServiceItemFields({
    coreSnapshot: coreSnapshot.businessContext.serviceItems,
    gbpSnapshot: gbpSnapshot.businessContext.serviceItems,
  });

  return [
    ...PROFILE_FIELDS,
    ...OPERATING_HOURS_FIELDS,
    ...dynamicServicePeriods,
    ...dynamicCategories,
    ...dynamicServiceAreas,
    ...dynamicAttributes,
    ...dynamicServiceItems,
    ...(includeCoreOnly ? CORE_ONLY_FIELDS : []),
  ];
}

/**
 * Lookup a config by `fieldKey`. Tries the static set first, then falls
 * back to a per-call dynamic registry for service-period and
 * business-context rows.
 */
export function findFieldConfig(
  registry: ReadonlyArray<DualSyncFieldConfig>,
  fieldKey: string,
): DualSyncFieldConfig | null {
  return registry.find((entry) => entry.fieldKey === fieldKey) ?? null;
}

// ---------------------------------------------------------------------------
// Capability resolver
// ---------------------------------------------------------------------------

/**
 * Resolve sync capability flags for one field given live Core and Google
 * values. Capability gates align with the legacy V2 profile resolver but
 * extend cleanly to dynamic sections by reading from the registry config.
 */
export function resolveFieldCapability({
  config,
  coreValue,
  gbpValue,
}: ResolveCapabilityInput): DualSyncFieldCapability {
  const reasons: string[] = [];

  let canImport = config.importable;
  if (canImport && (gbpValue === null || gbpValue === undefined)) {
    canImport = false;
    reasons.push('Google has no value to import.');
  }

  let canExport = config.exportable;
  if (config.exportRequiresCoreValue !== false && canExport) {
    if (coreValue === null || coreValue === undefined) {
      canExport = false;
      if (config.exportBlockedReason) {
        reasons.push(config.exportBlockedReason);
      } else {
        reasons.push('Core has no value to export.');
      }
    }
  }

  if (config.exportable && !canExport && config.exportBlockedReason && reasons.length === 0) {
    reasons.push(config.exportBlockedReason);
  }

  return {
    canImport,
    canExport,
    canIgnore: true,
    googleUpdateMask: config.googleUpdateMask,
    blockedReasons: reasons,
  };
}
