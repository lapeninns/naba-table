'use client';

import { createContext, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { compareCanonical, isGbpComparableSection } from '@/lib/dual-sync/compare-field';

import { GbpCompareDialog } from './GbpCompareDialog';
import { GBP_DRIFT_SECTION_ORDER } from './sectionLabels';
import { fieldNeedsOperatorChoice } from '../dual-sync/workspace-progress';

import type {
  GbpDriftContextValue,
  GbpDriftFieldView,
  GbpDriftOpenOptions,
  GbpDriftProviderProps,
} from './types';
import type { DualSyncSectionKey } from '@/server/dual-sync';
import type {
  DualSyncFieldSummary,
  DualSyncPublishRequest,
  DualSyncPublishResponse,
} from '@/services/ops/dual-sync';

const EMPTY_DRIFT_COUNTS = Object.freeze(
  GBP_DRIFT_SECTION_ORDER.reduce<Record<DualSyncSectionKey, number>>(
    (acc, sectionKey) => {
      acc[sectionKey] = 0;
      return acc;
    },
    {} as Record<DualSyncSectionKey, number>,
  ),
);

export const GbpDriftContext = createContext<GbpDriftContextValue | null>(null);

function isComparableField(
  field: DualSyncFieldSummary,
): field is DualSyncFieldSummary & { readonly sectionKey: DualSyncSectionKey } {
  return isGbpComparableSection(field.sectionKey);
}

function buildPublishRequest(fields: ReadonlyArray<GbpDriftFieldView>): DualSyncPublishRequest {
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

function draftValuesEqual(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function GbpDriftProvider({ restaurantId, children }: GbpDriftProviderProps) {
  const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const isLinked = connectionQuery.data?.status === 'linked';
  const dualSync = useOpsDualSync({ restaurantId: isLinked ? restaurantId : null });
  const [draftOverrides, setDraftOverrides] = useState<Record<string, unknown>>({});
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareOptions, setCompareOptions] = useState<GbpDriftOpenOptions>({
    filter: 'drifted_only',
  });

  const fieldViews = useMemo<ReadonlyArray<GbpDriftFieldView>>(() => {
    const fields = dualSync.stateQuery.data?.fields ?? [];
    return fields
      .filter(isComparableField)
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
  }, [draftOverrides, dualSync.stateQuery.data?.fields]);

  const fieldViewByKey = useMemo(
    () => new Map(fieldViews.map((view) => [view.fieldKey, view] as const)),
    [fieldViews],
  );

  const driftCountBySection = useMemo(() => {
    const counts = { ...EMPTY_DRIFT_COUNTS };
    for (const view of fieldViews) {
      if (view.effectiveStatus === 'drifted') {
        counts[view.sectionKey] += 1;
      }
    }
    return counts;
  }, [fieldViews]);

  const totalDriftCount = useMemo(
    () =>
      GBP_DRIFT_SECTION_ORDER.reduce(
        (total, sectionKey) => total + driftCountBySection[sectionKey],
        0,
      ),
    [driftCountBySection],
  );

  const registerDraftOverride = useCallback((fieldKey: string, value: unknown | null) => {
    setDraftOverrides((current) => {
      if (value === null) {
        if (!Object.prototype.hasOwnProperty.call(current, fieldKey)) return current;
        const next = { ...current };
        delete next[fieldKey];
        return next;
      }
      if (
        Object.prototype.hasOwnProperty.call(current, fieldKey) &&
        draftValuesEqual(current[fieldKey], value)
      ) {
        return current;
      }
      return { ...current, [fieldKey]: value };
    });
  }, []);

  const clearDraftOverrides = useCallback((fieldKeys?: ReadonlyArray<string>) => {
    if (!fieldKeys) {
      setDraftOverrides({});
      return;
    }
    setDraftOverrides((current) => {
      const next = { ...current };
      for (const key of fieldKeys) {
        delete next[key];
      }
      return next;
    });
  }, []);

  const openCompare = useCallback((options: GbpDriftOpenOptions = {}) => {
    setCompareOptions({ filter: 'drifted_only', ...options });
    setCompareDialogOpen(true);
  }, []);

  const closeCompare = useCallback(() => setCompareDialogOpen(false), []);

  const publishRequest = useCallback(
    async (request: DualSyncPublishRequest): Promise<DualSyncPublishResponse | null> => {
      if (request.decisions.length === 0) {
        toast.warning('No Google fields are available to apply.');
        return null;
      }
      try {
        const response = await dualSync.publishMutation.mutateAsync(request);
        toast.success(
          request.decisions.length === 1
            ? 'Google field imported to Nabatable.'
            : `${request.decisions.length} Google fields imported to Nabatable.`,
        );
        clearDraftOverrides(request.decisions.map((decision) => decision.fieldKey));
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to import Google fields.';
        toast.error(message);
        return null;
      }
    },
    [clearDraftOverrides, dualSync.publishMutation],
  );

  const applyFieldFromGoogle = useCallback(
    (fieldKey: string) => {
      const view = fieldViewByKey.get(fieldKey);
      if (!view || !view.canImport || view.effectiveStatus !== 'drifted') {
        toast.warning('This Google field is not available to apply.');
        return Promise.resolve(null);
      }
      return publishRequest(buildPublishRequest([view]));
    },
    [fieldViewByKey, publishRequest],
  );

  const applyAllFromGoogle = useCallback(
    (options: GbpDriftOpenOptions = {}) => {
      const sectionSet = new Set<DualSyncSectionKey>(
        options.sectionKeys ??
          (options.sectionKey ? [options.sectionKey] : GBP_DRIFT_SECTION_ORDER),
      );
      const requestedKeys = options.fieldKey ? new Set([options.fieldKey]) : null;
      const views = fieldViews.filter((view) => {
        if (!sectionSet.has(view.sectionKey)) return false;
        if (requestedKeys && !requestedKeys.has(view.fieldKey)) return false;
        return view.canImport && view.effectiveStatus === 'drifted';
      });
      return publishRequest(buildPublishRequest(views));
    },
    [fieldViews, publishRequest],
  );

  const value = useMemo<GbpDriftContextValue>(
    () => ({
      restaurantId,
      isLinked,
      isLoading: connectionQuery.isLoading || dualSync.stateQuery.isLoading,
      fieldViews,
      fieldViewByKey,
      totalDriftCount,
      driftCountBySection,
      registerDraftOverride,
      clearDraftOverrides,
      openCompare,
      closeCompare,
      compareDialogOpen,
      compareOptions,
      applyFieldFromGoogle,
      applyAllFromGoogle,
      isApplying: dualSync.publishMutation.isPending,
    }),
    [
      applyAllFromGoogle,
      applyFieldFromGoogle,
      clearDraftOverrides,
      closeCompare,
      compareDialogOpen,
      compareOptions,
      connectionQuery.isLoading,
      driftCountBySection,
      dualSync.publishMutation.isPending,
      dualSync.stateQuery.isLoading,
      fieldViewByKey,
      fieldViews,
      isLinked,
      openCompare,
      registerDraftOverride,
      restaurantId,
      totalDriftCount,
    ],
  );

  return (
    <GbpDriftContext.Provider value={value}>
      {children}
      <GbpCompareDialog />
    </GbpDriftContext.Provider>
  );
}
