'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';

import { GbpDriftContext } from './context';
import { GbpCompareDialog } from './GbpCompareDialog';
import {
  buildGbpDriftPublishRequest,
  deriveGbpDriftFieldViews,
  draftValuesEqual,
  filterImportableGbpDriftViews,
  getGbpDriftCountBySection,
  getGbpDriftFieldViewByKey,
  getTotalGbpDriftCount,
} from './gbpDriftProviderDomain';

import type {
  GbpDriftContextValue,
  GbpDriftFieldView,
  GbpDriftOpenOptions,
  GbpDriftProviderProps,
} from './types';
import type { DualSyncPublishRequest, DualSyncPublishResponse } from '@/services/ops/dual-sync';

export function GbpDriftProvider({
  restaurantId,
  enabled = true,
  children,
}: GbpDriftProviderProps) {
  const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId, { enabled });
  const isLinked = connectionQuery.data?.status === 'linked';
  const dualSync = useOpsDualSync({
    restaurantId: isLinked ? restaurantId : null,
    stateEnabled: enabled,
  });
  const [draftOverrides, setDraftOverrides] = useState<Record<string, unknown>>({});
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareOptions, setCompareOptions] = useState<GbpDriftOpenOptions>({
    filter: 'drifted_only',
  });

  const fieldViews = useMemo<ReadonlyArray<GbpDriftFieldView>>(() => {
    const fields = dualSync.stateQuery.data?.fields ?? [];
    return deriveGbpDriftFieldViews({ fields, draftOverrides });
  }, [draftOverrides, dualSync.stateQuery.data?.fields]);

  const fieldViewByKey = useMemo(() => getGbpDriftFieldViewByKey(fieldViews), [fieldViews]);

  const driftCountBySection = useMemo(() => {
    return getGbpDriftCountBySection(fieldViews);
  }, [fieldViews]);

  const totalDriftCount = useMemo(
    () => getTotalGbpDriftCount(driftCountBySection),
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
      return publishRequest(buildGbpDriftPublishRequest([view]));
    },
    [fieldViewByKey, publishRequest],
  );

  const applyAllFromGoogle = useCallback(
    (options: GbpDriftOpenOptions = {}) => {
      const views = filterImportableGbpDriftViews(fieldViews, options);
      return publishRequest(buildGbpDriftPublishRequest(views));
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
