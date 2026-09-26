'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import { GbpDriftContext } from './context';
import {
  buildGbpDriftPublishRequest,
  deriveGbpDriftFieldViews,
  draftValuesEqual,
  filterImportableGbpDriftViews,
  formatGbpDriftImportMessage,
  gbpDriftImportIntentKey,
  getGbpDriftCountBySection,
  getGbpDriftFieldViewByKey,
  getTotalGbpDriftCount,
  summarizeGbpDriftImport,
} from './gbpDriftProviderDomain';
import { getSafeSettingsErrorMessage } from '../shared/settingsErrorCopy';

import type {
  GbpDriftContextValue,
  GbpDriftFieldView,
  GbpDriftOpenOptions,
  GbpDriftProviderProps,
} from './types';
import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

// The compare dialog (accordion, scroll area, toggle group, field rows) is only
// needed once an operator asks to compare with Google, so keep it out of the
// initial settings chunk. It opens from a client interaction, so there is
// nothing to server-render.
const GbpCompareDialog = dynamic(
  () => import('./GbpCompareDialog').then((mod) => mod.GbpCompareDialog),
  { ssr: false },
);

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
  // Mount on first open, then stay mounted so Radix can run its close
  // transition and re-opening does not suspend on the lazy chunk again.
  const [compareDialogMounted, setCompareDialogMounted] = useState(false);
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
    setCompareDialogMounted(true);
    setCompareDialogOpen(true);
  }, []);

  const closeCompare = useCallback(() => setCompareDialogOpen(false), []);

  // One request id per import intent (the same fields pinned to the same values), kept until the
  // server answers, so a retry after a lost response is replayed rather than imported twice.
  const importRequestIds = useRef(new Map<string, string>());
  const { mutateAsync: publishDecisions } = dualSync.publishMutation;

  const importFromGoogle = useCallback(
    async (views: ReadonlyArray<GbpDriftFieldView>): Promise<DualSyncPublishResponse | null> => {
      if (views.length === 0) {
        toast.warning('No Google fields are available to apply.');
        return null;
      }
      const intentKey = gbpDriftImportIntentKey(buildGbpDriftPublishRequest(views, '').decisions);
      const clientRequestId = importRequestIds.current.get(intentKey) ?? generateIdempotencyKey();
      importRequestIds.current.set(intentKey, clientRequestId);
      const request = buildGbpDriftPublishRequest(views, clientRequestId);

      let response: DualSyncPublishResponse;
      try {
        response = await publishDecisions(request);
      } catch (error) {
        toast.error(getSafeSettingsErrorMessage(error, 'Google fields could not be imported.'));
        return null;
      }
      importRequestIds.current.delete(intentKey);

      const outcome = summarizeGbpDriftImport(request, response);
      const labelFor = (fieldKey: string) =>
        views.find((view) => view.fieldKey === fieldKey)?.label ?? fieldKey;
      const message = formatGbpDriftImportMessage(outcome, labelFor);
      if (outcome.kind === 'success') {
        toast.success(message);
      } else if (outcome.kind === 'partial') {
        toast.warning(message);
      } else {
        toast.error(message);
      }
      // Only fields that were imported leave the local draft; failed ones keep what staff typed.
      if (outcome.succeededFieldKeys.length > 0) {
        clearDraftOverrides(outcome.succeededFieldKeys);
      }
      return response;
    },
    [clearDraftOverrides, publishDecisions],
  );

  const applyFieldFromGoogle = useCallback(
    (fieldKey: string) => {
      const view = fieldViewByKey.get(fieldKey);
      if (!view || !view.canImport || view.effectiveStatus !== 'drifted') {
        toast.warning('This Google field is not available to apply.');
        return Promise.resolve(null);
      }
      return importFromGoogle([view]);
    },
    [fieldViewByKey, importFromGoogle],
  );

  const applyAllFromGoogle = useCallback(
    (options: GbpDriftOpenOptions = {}) =>
      importFromGoogle(filterImportableGbpDriftViews(fieldViews, options)),
    [fieldViews, importFromGoogle],
  );

  // Any publish for this restaurant (this surface or another) blocks a new import until it lands.
  const isApplying = Boolean(dualSync.isPublishPending) || dualSync.publishMutation.isPending;

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
      isApplying,
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
      dualSync.stateQuery.isLoading,
      fieldViewByKey,
      fieldViews,
      isApplying,
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
      {compareDialogMounted ? <GbpCompareDialog /> : null}
    </GbpDriftContext.Provider>
  );
}
