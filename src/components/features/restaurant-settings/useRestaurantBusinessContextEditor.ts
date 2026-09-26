'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import {
  useOpsRestaurantBusinessContext,
  useOpsUpdateRestaurantBusinessContext,
  type BusinessContextSaveInput,
} from '@/hooks/ops/useOpsRestaurantBusinessContext';

import {
  getBusinessContextRevision,
  type BusinessContextDrafts,
} from './businessContextDraftState';
import {
  buildBusinessContextFamilyPayload,
  deriveFamilyCounts,
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_SECTION_TITLES,
  type FamilyKey,
} from './businessContextModel';
import { isOnlyServiceLocationChanged } from './discovery/serviceLocation';
import { RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS } from './routes';
import { formatSettingsSectionList, useSettingsSaveSequence } from './shared/settingsSaveSequence';
import { useBusinessContextEditorDraftState } from './useBusinessContextEditorDraftState';

import type { RestaurantBusinessContextFamily } from '@/services/ops/restaurants';

/** Latest `updatedAt` across saved discovery rows: when these details were last saved. */
export function latestBusinessContextUpdatedAt(
  core: RestaurantBusinessContextFamily | null | undefined,
): string | null {
  if (!core) {
    return null;
  }
  const stamps = [
    core.businessDetails?.updatedAt,
    ...(core.links ?? []).map((row) => row.updatedAt),
    ...core.categories.map((row) => row.updatedAt),
    ...core.serviceAreas.map((row) => row.updatedAt),
    ...core.attributes.map((row) => row.updatedAt),
    ...core.serviceItems.map((row) => row.updatedAt),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const stamp of stamps) {
    const time = Date.parse(stamp);
    if (!Number.isNaN(time) && time > latestTime) {
      latest = stamp;
      latestTime = time;
    }
  }
  return latest;
}

export function formatDiscoverySaveToast(savedSections: readonly string[]): string {
  return `Saved ${formatSettingsSectionList(savedSections)}. Each section replaces its full list.`;
}

/**
 * The one request body for a page save: every dirty section, each a full replacement, plus the
 * revision the draft is based on. The service-location switch is stored with business details,
 * so it travels in `businessDetails` even though staff edit it under Where you serve.
 */
export function buildDiscoverySavePayload(
  families: readonly FamilyKey[],
  drafts: BusinessContextDrafts,
  expectedRevision: number | undefined,
): BusinessContextSaveInput {
  const payload: BusinessContextSaveInput = {};
  for (const family of families) {
    Object.assign(payload, buildBusinessContextFamilyPayload(family, drafts));
  }
  if (expectedRevision !== undefined) {
    payload.expectedRevision = expectedRevision;
  }
  return payload;
}

/**
 * Section names for the save step and toast, as staff see them: a change to the
 * service-location switch alone is named Where you serve, not Business status.
 */
export function discoverySaveSectionNames(
  dirtyFamilies: readonly FamilyKey[],
  serviceLocationOnly: boolean,
): string[] {
  return DISCOVERY_SECTION_ORDER.filter((family) => {
    if (serviceLocationOnly && family === 'businessDetails') return false;
    if (serviceLocationOnly && family === 'serviceAreas') return true;
    return dirtyFamilies.includes(family);
  }).map((family) => DISCOVERY_SECTION_TITLES[family]);
}

export function useRestaurantBusinessContextEditor({
  restaurantId,
}: {
  restaurantId: string | null;
}) {
  const contextQuery = useOpsRestaurantBusinessContext(restaurantId);
  const updateMutation = useOpsUpdateRestaurantBusinessContext(restaurantId);
  const draft = useBusinessContextEditorDraftState({ restaurantId, snapshot: contextQuery.data });
  const saveSequence = useSettingsSaveSequence();
  const { applySavedSnapshot, baseline, dirtyFamilies, drafts, resetFamilies, savedDrafts } = draft;
  const { mutateAsync } = updateMutation;
  const { run: runSaveSequence, clearFailure } = saveSequence;

  useRegisterOpsUnsavedChanges(
    RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS.discovery,
    draft.isDirty,
    'You have unsaved discovery detail changes. Leave without saving them?',
  );

  const providerCounts = useMemo(
    () => deriveFamilyCounts(contextQuery.data?.providerSnapshot),
    [contextQuery.data?.providerSnapshot],
  );
  const lastSavedAt = useMemo(
    () => latestBusinessContextUpdatedAt(draft.baseline?.core),
    [draft.baseline],
  );

  /**
   * Sends every section with changes in one request, which the server applies in one
   * transaction together with its audit rows. A failure leaves every section unsaved and keeps
   * the edits; a 409 means the details changed since they were loaded.
   */
  const saveAll = useCallback(async () => {
    if (dirtyFamilies.length === 0) {
      return null;
    }
    const serviceLocationOnly =
      dirtyFamilies.includes('businessDetails') &&
      isOnlyServiceLocationChanged(savedDrafts, drafts);
    const sectionNames = discoverySaveSectionNames(dirtyFamilies, serviceLocationOnly);
    const families = [...dirtyFamilies];
    const sent = drafts;
    const outcome = await runSaveSequence([
      {
        id: 'discovery',
        name: formatSettingsSectionList(sectionNames),
        run: async () => {
          const saved = await mutateAsync(
            buildDiscoverySavePayload(families, sent, getBusinessContextRevision(baseline)),
          );
          // Anything typed while this request was in flight stays as the newer draft.
          applySavedSnapshot(families, saved, sent);
        },
      },
    ]);
    if (outcome?.ok) {
      toast.success(formatDiscoverySaveToast(sectionNames));
    }
    return outcome;
  }, [
    applySavedSnapshot,
    baseline,
    dirtyFamilies,
    drafts,
    mutateAsync,
    runSaveSequence,
    savedDrafts,
  ]);

  const resetFamily = useCallback(
    (family: FamilyKey) => {
      resetFamilies([family]);
    },
    [resetFamilies],
  );

  const discardAll = useCallback(() => {
    resetFamilies(DISCOVERY_SECTION_ORDER);
    clearFailure();
  }, [clearFailure, resetFamilies]);

  return {
    ...draft,
    contextQuery,
    providerCounts,
    lastSavedAt,
    saveProgress: saveSequence.progress,
    saveFailure: saveSequence.failure,
    isSaving: saveSequence.isSaving,
    saveAll,
    resetFamily,
    discardAll,
  };
}

export type RestaurantBusinessContextEditor = ReturnType<typeof useRestaurantBusinessContextEditor>;
