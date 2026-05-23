import { useEffect, useState } from 'react';

import {
  EMPTY_BUSINESS_DETAILS,
  EMPTY_SEED_SOURCE,
  deriveBusinessContextEditorState,
  deriveBusinessContextFamilyState,
  type BusinessContextFamilyPayloadState,
  type FamilyKey,
} from './businessContextModel';
import { useBusinessContextAttributeDraft } from './useBusinessContextAttributeDraft';
import { useBusinessContextBusinessDetailsDraft } from './useBusinessContextBusinessDetailsDraft';
import { useBusinessContextCategoryDraft } from './useBusinessContextCategoryDraft';
import { useBusinessContextEditorWorkflowState } from './useBusinessContextEditorWorkflowState';
import { useBusinessContextLinkDraft } from './useBusinessContextLinkDraft';
import { useBusinessContextServiceAreaDraft } from './useBusinessContextServiceAreaDraft';
import { useBusinessContextServiceItemDraft } from './useBusinessContextServiceItemDraft';

import type { RestaurantBusinessContextSnapshot } from '@/services/ops/restaurants';

type UseBusinessContextEditorDraftStateOptions = {
  snapshot: RestaurantBusinessContextSnapshot | null | undefined;
};

export function useBusinessContextEditorDraftState({
  snapshot,
}: UseBusinessContextEditorDraftStateOptions) {
  const [activeTab, setActiveTab] = useState<FamilyKey | ''>('businessDetails');
  const [seedSource, setSeedSource] = useState(EMPTY_SEED_SOURCE);
  const workflow = useBusinessContextEditorWorkflowState();
  const { resetWorkflowState } = workflow;
  const {
    businessDetails,
    setBusinessDetails: setBusinessDetailsDraft,
    updateBusinessDetails,
  } = useBusinessContextBusinessDetailsDraft({
    onDirty: () => workflow.markDirty('businessDetails'),
  });
  const {
    links,
    setLinks: setLinkDrafts,
    addLink,
    updateLink,
    removeLink,
  } = useBusinessContextLinkDraft({
    onDirty: () => workflow.markDirty('links'),
  });
  const {
    categories,
    setCategories: setCategoryDrafts,
    addCategory,
    updateCategory,
    removeCategory,
    updateMoreHoursDraft,
    addMoreHoursTypes,
    removeMoreHoursType,
  } = useBusinessContextCategoryDraft({
    onDirty: () => workflow.markDirty('categories'),
  });
  const {
    serviceAreas,
    serviceAreaDraft,
    setServiceAreaDraft,
    resetServiceAreas,
    updateServiceArea,
    addServiceAreaFromDraft,
    removeServiceArea,
  } = useBusinessContextServiceAreaDraft({
    onDirty: () => workflow.markDirty('serviceAreas'),
  });
  const {
    attributes,
    setAttributes: setAttributeDrafts,
    toggleAmenityAttribute,
    addAttribute,
    updateAttribute,
    removeAttribute,
  } = useBusinessContextAttributeDraft({
    onDirty: () => workflow.markDirty('attributes'),
  });
  const {
    serviceItems,
    setServiceItems: setServiceItemDrafts,
    addServiceItem,
    updateServiceItem,
    removeServiceItem,
  } = useBusinessContextServiceItemDraft({
    onDirty: () => workflow.markDirty('serviceItems'),
  });

  const payloadState = {
    businessDetails,
    links,
    categories,
    serviceAreas,
    attributes,
    serviceItems,
  } satisfies BusinessContextFamilyPayloadState;

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const next = deriveBusinessContextEditorState(snapshot);
    setBusinessDetailsDraft(next.businessDetails);
    setLinkDrafts(next.links);
    setCategoryDrafts(next.categories);
    resetServiceAreas(next.serviceAreas);
    setAttributeDrafts(next.attributes);
    setServiceItemDrafts(next.serviceItems);
    setSeedSource(next.seedSource);
    resetWorkflowState();
  }, [
    snapshot,
    resetWorkflowState,
    resetServiceAreas,
    setAttributeDrafts,
    setBusinessDetailsDraft,
    setCategoryDrafts,
    setLinkDrafts,
    setServiceItemDrafts,
  ]);

  const resetFamily = (family: FamilyKey) => {
    if (!snapshot) {
      return;
    }

    const next = deriveBusinessContextFamilyState(snapshot, family);

    if (family === 'businessDetails') {
      setBusinessDetailsDraft(next.businessDetails ?? EMPTY_BUSINESS_DETAILS);
    }
    if (family === 'links') {
      setLinkDrafts(next.links ?? []);
    }
    if (family === 'categories') {
      setCategoryDrafts(next.categories ?? []);
    }
    if (family === 'serviceAreas') {
      resetServiceAreas(next.serviceAreas ?? []);
    }
    if (family === 'attributes') {
      setAttributeDrafts(next.attributes ?? []);
    }
    if (family === 'serviceItems') {
      setServiceItemDrafts(next.serviceItems ?? []);
    }

    setSeedSource((current) => ({
      ...current,
      [family]: next.seedSource?.[family] ?? EMPTY_SEED_SOURCE[family],
    }));
    workflow.markFamilyClean(family);
  };

  return {
    activeTab,
    setActiveTab,
    businessDetails,
    links,
    categories,
    serviceAreas,
    serviceAreaDraft,
    setServiceAreaDraft,
    attributes,
    serviceItems,
    seedSource,
    dirty: workflow.dirty,
    errors: workflow.errors,
    savedFamily: workflow.savedFamily,
    isDirty: workflow.isDirty,
    payloadState,
    updateBusinessDetails,
    addLink,
    updateLink,
    removeLink,
    addCategory,
    updateCategory,
    removeCategory,
    updateMoreHoursDraft,
    addMoreHoursTypes,
    removeMoreHoursType,
    updateServiceArea,
    addServiceAreaFromDraft,
    removeServiceArea,
    toggleAmenityAttribute,
    addAttribute,
    updateAttribute,
    removeAttribute,
    addServiceItem,
    updateServiceItem,
    removeServiceItem,
    resetFamily,
    prepareFamilySave: workflow.prepareFamilySave,
    markFamilySaved: workflow.markFamilySaved,
    markFamilySaveFailed: workflow.markFamilySaveFailed,
  };
}
