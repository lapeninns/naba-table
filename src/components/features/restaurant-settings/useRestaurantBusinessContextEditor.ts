'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import {
  useOpsRestaurantBusinessContext,
  useOpsUpdateRestaurantBusinessContext,
} from '@/hooks/ops/useOpsRestaurantBusinessContext';

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

import type { SettingsSaveStep } from './shared/settingsSaveSequence';
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

export function useRestaurantBusinessContextEditor({
  restaurantId,
}: {
  restaurantId: string | null;
}) {
  const contextQuery = useOpsRestaurantBusinessContext(restaurantId);
  const updateMutation = useOpsUpdateRestaurantBusinessContext(restaurantId);
  const draft = useBusinessContextEditorDraftState({ restaurantId, snapshot: contextQuery.data });
  const saveSequence = useSettingsSaveSequence();
  const { applySavedSnapshot, dirtyFamilies, drafts, resetFamilies, savedDrafts } = draft;
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
   * Sends every section with changes, one after another, through the existing endpoint. Each
   * request replaces that section's full list; a failure stops the sequence and keeps the edits.
   * When only the service-location switch changed, its business details request runs inside the
   * Where you serve step, where staff edit it.
   */
  const saveAll = useCallback(async () => {
    const saveFamily = async (family: FamilyKey) => {
      const saved = await mutateAsync(buildBusinessContextFamilyPayload(family, drafts));
      // Anything typed while this request was in flight stays as the newer draft.
      applySavedSnapshot(family, saved, drafts);
    };
    const serviceLocationOnly =
      dirtyFamilies.includes('businessDetails') &&
      isOnlyServiceLocationChanged(savedDrafts, drafts);

    const steps: SettingsSaveStep[] = [];
    for (const family of DISCOVERY_SECTION_ORDER) {
      if (family === 'businessDetails' && serviceLocationOnly) {
        continue;
      }
      if (family === 'serviceAreas' && serviceLocationOnly) {
        const areasChanged = dirtyFamilies.includes('serviceAreas');
        steps.push({
          id: family,
          name: DISCOVERY_SECTION_TITLES[family],
          run: async () => {
            await saveFamily('businessDetails');
            if (areasChanged) {
              await saveFamily('serviceAreas');
            }
          },
        });
        continue;
      }
      if (dirtyFamilies.includes(family)) {
        steps.push({
          id: family,
          name: DISCOVERY_SECTION_TITLES[family],
          run: () => saveFamily(family),
        });
      }
    }
    if (steps.length === 0) {
      return null;
    }
    const outcome = await runSaveSequence(steps);
    if (outcome?.ok) {
      toast.success(formatDiscoverySaveToast(outcome.saved));
    }
    return outcome;
  }, [applySavedSnapshot, dirtyFamilies, drafts, mutateAsync, runSaveSequence, savedDrafts]);

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
