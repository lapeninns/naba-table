'use client';

import { useMemo } from 'react';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';
import type { AttributesPanelEditor } from '../panels/AttributesPanel';
import type { BusinessDetailsPanelEditor } from '../panels/BusinessDetailsPanel';
import type { CategoriesPanelEditor } from '../panels/CategoriesPanel';
import type { LinksPanelEditor } from '../panels/LinksPanel';
import type { ServiceAreasPanelEditor } from '../panels/ServiceAreasPanel';
import type { ServiceItemsPanelEditor } from '../panels/ServiceItemsPanel';

/** One editor slice per Discovery section. */
export type DiscoveryPanelEditors = {
  businessDetails: BusinessDetailsPanelEditor;
  categories: CategoriesPanelEditor;
  links: LinksPanelEditor;
  attributes: AttributesPanelEditor;
  serviceItems: ServiceItemsPanelEditor;
  serviceAreas: ServiceAreasPanelEditor;
};

/**
 * Gives each Discovery panel only its own slice of the page editor. The editor object is new on
 * every render, but each slice keeps its identity until that panel's data changes (its actions
 * are stable), so the memoised panels skip renders caused by edits elsewhere on the page.
 */
export function useDiscoveryPanelEditors(
  editor: RestaurantBusinessContextEditor,
): DiscoveryPanelEditors {
  const {
    businessDetails,
    updateBusinessDetails,
    categories,
    addCategory,
    updateCategory,
    makeCategoryPrimary,
    removeCategory,
    updateMoreHoursDraft,
    addMoreHoursTypes,
    removeMoreHoursType,
    links,
    addLink,
    updateLink,
    removeLink,
    attributes,
    setAmenityValue,
    addAttribute,
    updateAttribute,
    removeAttribute,
    serviceItems,
    addServiceItem,
    updateServiceItem,
    removeServiceItem,
    serviceAreas,
    addServiceArea,
    updateServiceArea,
    removeServiceArea,
  } = editor;
  const { isServiceAreaBusiness } = businessDetails;

  const businessDetailsEditor = useMemo(
    () => ({ businessDetails, updateBusinessDetails }),
    [businessDetails, updateBusinessDetails],
  );
  const categoriesEditor = useMemo(
    () => ({
      categories,
      addCategory,
      updateCategory,
      makeCategoryPrimary,
      removeCategory,
      updateMoreHoursDraft,
      addMoreHoursTypes,
      removeMoreHoursType,
    }),
    [
      addCategory,
      addMoreHoursTypes,
      categories,
      makeCategoryPrimary,
      removeCategory,
      removeMoreHoursType,
      updateCategory,
      updateMoreHoursDraft,
    ],
  );
  const linksEditor = useMemo(
    () => ({ links, addLink, updateLink, removeLink }),
    [addLink, links, removeLink, updateLink],
  );
  const attributesEditor = useMemo(
    () => ({ attributes, setAmenityValue, addAttribute, updateAttribute, removeAttribute }),
    [addAttribute, attributes, removeAttribute, setAmenityValue, updateAttribute],
  );
  const serviceItemsEditor = useMemo(
    () => ({ serviceItems, addServiceItem, updateServiceItem, removeServiceItem }),
    [addServiceItem, removeServiceItem, serviceItems, updateServiceItem],
  );
  // Where you serve reads only the service-location switch from business details.
  const serviceAreasEditor = useMemo(
    () => ({
      serviceAreas,
      addServiceArea,
      updateServiceArea,
      removeServiceArea,
      businessDetails: { isServiceAreaBusiness },
      updateBusinessDetails,
    }),
    [
      addServiceArea,
      isServiceAreaBusiness,
      removeServiceArea,
      serviceAreas,
      updateBusinessDetails,
      updateServiceArea,
    ],
  );

  return {
    businessDetails: businessDetailsEditor,
    categories: categoriesEditor,
    links: linksEditor,
    attributes: attributesEditor,
    serviceItems: serviceItemsEditor,
    serviceAreas: serviceAreasEditor,
  };
}
