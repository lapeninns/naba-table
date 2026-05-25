'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import {
  useOpsRestaurantBusinessContext,
  useOpsUpdateRestaurantBusinessContext,
} from '@/hooks/ops/useOpsRestaurantBusinessContext';

import { resolveBusinessContextSaveErrorMessage } from './businessContextEditorWorkflow';
import { buildBusinessContextFamilyPayload, deriveFamilyCounts } from './businessContextModel';
import { useBusinessContextEditorDraftState } from './useBusinessContextEditorDraftState';

import type { FamilyKey } from './businessContextModel';

export function useRestaurantBusinessContextEditor({
  restaurantId,
  onDirtyChange,
}: {
  restaurantId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const contextQuery = useOpsRestaurantBusinessContext(restaurantId);
  const updateMutation = useOpsUpdateRestaurantBusinessContext(restaurantId);
  const draft = useBusinessContextEditorDraftState({ snapshot: contextQuery.data });
  const [savingFamily, setSavingFamily] = useState<FamilyKey | null>(null);

  useRegisterOpsUnsavedChanges(
    'restaurant-discovery',
    draft.isDirty,
    'You have unsaved discovery detail changes. Leave without saving them?',
  );

  useEffect(() => {
    onDirtyChange?.(draft.isDirty);
  }, [draft.isDirty, onDirtyChange]);

  const providerCounts = useMemo(
    () => deriveFamilyCounts(contextQuery.data?.providerSnapshot),
    [contextQuery.data?.providerSnapshot],
  );

  const coreCounts = useMemo(
    () => deriveFamilyCounts(contextQuery.data?.core),
    [contextQuery.data?.core],
  );

  const saveFamily = async (family: FamilyKey) => {
    try {
      setSavingFamily(family);
      draft.prepareFamilySave(family);
      await updateMutation.mutateAsync(
        buildBusinessContextFamilyPayload(family, draft.payloadState),
      );

      draft.markFamilySaved(family);
      toast.success('Saved just now.');
    } catch (error) {
      const message = resolveBusinessContextSaveErrorMessage(error);
      draft.markFamilySaveFailed(family, message);
      toast.error(message);
    } finally {
      setSavingFamily(null);
    }
  };

  return {
    contextQuery,
    activeTab: draft.activeTab,
    setActiveTab: draft.setActiveTab,
    businessDetails: draft.businessDetails,
    links: draft.links,
    categories: draft.categories,
    serviceAreas: draft.serviceAreas,
    serviceAreaDraft: draft.serviceAreaDraft,
    setServiceAreaDraft: draft.setServiceAreaDraft,
    attributes: draft.attributes,
    serviceItems: draft.serviceItems,
    seedSource: draft.seedSource,
    dirty: draft.dirty,
    errors: draft.errors,
    savingFamily,
    savedFamily: draft.savedFamily,
    providerCounts,
    coreCounts,
    updateBusinessDetails: draft.updateBusinessDetails,
    addLink: draft.addLink,
    updateLink: draft.updateLink,
    removeLink: draft.removeLink,
    addCategory: draft.addCategory,
    updateCategory: draft.updateCategory,
    removeCategory: draft.removeCategory,
    updateMoreHoursDraft: draft.updateMoreHoursDraft,
    addMoreHoursTypes: draft.addMoreHoursTypes,
    removeMoreHoursType: draft.removeMoreHoursType,
    updateServiceArea: draft.updateServiceArea,
    addServiceAreaFromDraft: draft.addServiceAreaFromDraft,
    removeServiceArea: draft.removeServiceArea,
    toggleAmenityAttribute: draft.toggleAmenityAttribute,
    addAttribute: draft.addAttribute,
    updateAttribute: draft.updateAttribute,
    removeAttribute: draft.removeAttribute,
    addServiceItem: draft.addServiceItem,
    updateServiceItem: draft.updateServiceItem,
    removeServiceItem: draft.removeServiceItem,
    resetFamily: draft.resetFamily,
    saveFamily,
  };
}

export type RestaurantBusinessContextEditor = ReturnType<typeof useRestaurantBusinessContextEditor>;
