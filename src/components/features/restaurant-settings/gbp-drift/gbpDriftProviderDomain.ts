import { compareCanonical, isGbpComparableSection } from '@/lib/dual-sync/compare-field';

import { GBP_DRIFT_SECTION_ORDER } from './sectionLabels';
import { fieldNeedsOperatorChoice } from '../dual-sync/workspace-progress';

import type { GbpDriftFieldView, GbpDriftOpenOptions } from './types';
import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary, DualSyncPublishRequest } from '@/services/ops/dual-sync';

export const EMPTY_DRIFT_COUNTS = Object.freeze(
  GBP_DRIFT_SECTION_ORDER.reduce<Record<DualSyncSectionKey, number>>(
    (acc, sectionKey) => {
      acc[sectionKey] = 0;
      return acc;
    },
    {} as Record<DualSyncSectionKey, number>,
  ),
);

export function isComparableGbpDriftField(
  field: DualSyncFieldSummary,
): field is DualSyncFieldSummary & { readonly sectionKey: DualSyncSectionKey } {
  return isGbpComparableSection(field.sectionKey);
}

export function draftValuesEqual(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function deriveGbpDriftFieldViews({
  fields,
  draftOverrides,
}: {
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly draftOverrides: Readonly<Record<string, unknown>>;
}): ReadonlyArray<GbpDriftFieldView> {
  return fields
    .filter(isComparableGbpDriftField)
    .map((field) => {
      const hasDraft = Object.prototype.hasOwnProperty.call(draftOverrides, field.fieldKey);
      const localValue = hasDraft ? draftOverrides[field.fieldKey] : field.coreValue;
      const compare = compareCanonical(field.fieldKey, localValue, field.gbpValue);
      const savedNeedsReview = fieldNeedsOperatorChoice(field);
      const liveStatus: GbpDriftFieldView['liveStatus'] = compare.matches ? 'synced' : 'drifted';
      const effectiveStatus: GbpDriftFieldView['effectiveStatus'] =
        liveStatus === 'drifted' || (!hasDraft && savedNeedsReview) ? 'drifted' : 'synced';

      return {
        field,
        fieldKey: field.fieldKey,
        sectionKey: field.sectionKey,
        label: field.label,
        helpText: field.helpText,
        localValue,
        gbpValue: field.gbpValue,
        hasDraftOverride: hasDraft,
        savedNeedsReview,
        liveMatches: compare.matches,
        liveStatus,
        effectiveStatus,
        canImport: field.capability.canImport && field.conflictPolicy !== 'unsupported',
      };
    })
    .sort((a, b) => {
      const sectionDelta =
        GBP_DRIFT_SECTION_ORDER.indexOf(a.sectionKey) -
        GBP_DRIFT_SECTION_ORDER.indexOf(b.sectionKey);
      return sectionDelta === 0 ? a.field.sortOrder - b.field.sortOrder : sectionDelta;
    });
}

export function getGbpDriftFieldViewByKey(
  fieldViews: ReadonlyArray<GbpDriftFieldView>,
): ReadonlyMap<string, GbpDriftFieldView> {
  return new Map(fieldViews.map((view) => [view.fieldKey, view] as const));
}

export function getGbpDriftCountBySection(
  fieldViews: ReadonlyArray<GbpDriftFieldView>,
): Record<DualSyncSectionKey, number> {
  const counts = { ...EMPTY_DRIFT_COUNTS };
  for (const view of fieldViews) {
    if (view.effectiveStatus === 'drifted') {
      counts[view.sectionKey] += 1;
    }
  }
  return counts;
}

export function getTotalGbpDriftCount(
  driftCountBySection: Readonly<Record<DualSyncSectionKey, number>>,
): number {
  return GBP_DRIFT_SECTION_ORDER.reduce(
    (total, sectionKey) => total + driftCountBySection[sectionKey],
    0,
  );
}

export function filterImportableGbpDriftViews(
  fieldViews: ReadonlyArray<GbpDriftFieldView>,
  options: GbpDriftOpenOptions = {},
): ReadonlyArray<GbpDriftFieldView> {
  const sectionSet = new Set<DualSyncSectionKey>(
    options.sectionKeys ?? (options.sectionKey ? [options.sectionKey] : GBP_DRIFT_SECTION_ORDER),
  );
  const requestedKeys = options.fieldKey ? new Set([options.fieldKey]) : null;

  return fieldViews.filter((view) => {
    if (!sectionSet.has(view.sectionKey)) return false;
    if (requestedKeys && !requestedKeys.has(view.fieldKey)) return false;
    return view.canImport && view.effectiveStatus === 'drifted';
  });
}

export function buildGbpDriftPublishRequest(
  fields: ReadonlyArray<GbpDriftFieldView>,
): DualSyncPublishRequest {
  return {
    clientRequestId: `gbp-drift-${Date.now()}`,
    decisions: fields.map((view) => ({
      fieldKey: view.fieldKey,
      sectionKey: view.sectionKey,
      action: 'import_from_google',
      pinnedCoreHash: view.field.coreCanonicalHash,
      pinnedGbpHash: view.field.gbpCanonicalHash,
    })),
  };
}
