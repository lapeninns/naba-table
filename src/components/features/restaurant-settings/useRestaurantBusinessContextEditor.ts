'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  useOpsRestaurantBusinessContext,
  useOpsUpdateRestaurantBusinessContext,
} from '@/hooks/ops/useOpsRestaurantBusinessContext';

import {
  EMPTY_DIRTY_STATE,
  EMPTY_SEED_SOURCE,
  buildBusinessContextFamilyPayload,
  deriveBusinessContextEditorState,
  deriveFamilyCounts,
  formatMoreHoursTypeLabel,
  makeEditorId,
  splitChipDraft,
  type AmenityAttributeDefinition,
  type AttributeEditor,
  type BusinessDetailsEditor,
  type CategoryEditor,
  type DirtyState,
  type ErrorState,
  type FamilyKey,
  type LinkEditor,
  type ServiceAreaEditor,
  type ServiceItemEditor,
} from './businessContextModel';

export function useRestaurantBusinessContextEditor({
  restaurantId,
  onDirtyChange,
}: {
  restaurantId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const contextQuery = useOpsRestaurantBusinessContext(restaurantId);
  const updateMutation = useOpsUpdateRestaurantBusinessContext(restaurantId);
  const [activeTab, setActiveTab] = useState<FamilyKey | ''>('businessDetails');
  const [businessDetails, setBusinessDetails] = useState<BusinessDetailsEditor>({
    openingDate: '',
    businessStatus: 'unset',
    isServiceAreaBusiness: false,
  });
  const [links, setLinks] = useState<LinkEditor[]>([]);
  const [categories, setCategories] = useState<CategoryEditor[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaEditor[]>([]);
  const [serviceAreaDraft, setServiceAreaDraft] = useState('');
  const [attributes, setAttributes] = useState<AttributeEditor[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItemEditor[]>([]);
  const [seedSource, setSeedSource] = useState(EMPTY_SEED_SOURCE);
  const [dirty, setDirty] = useState<DirtyState>(EMPTY_DIRTY_STATE);
  const [errors, setErrors] = useState<ErrorState>({});
  const [savingFamily, setSavingFamily] = useState<FamilyKey | null>(null);
  const [savedFamily, setSavedFamily] = useState<FamilyKey | null>(null);

  useEffect(() => {
    onDirtyChange?.(Object.values(dirty).some(Boolean));
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    const data = contextQuery.data;
    if (!data) {
      return;
    }

    const next = deriveBusinessContextEditorState(data);
    setBusinessDetails(next.businessDetails);
    setLinks(next.links);
    setCategories(next.categories);
    setServiceAreas(next.serviceAreas);
    setServiceAreaDraft('');
    setAttributes(next.attributes);
    setServiceItems(next.serviceItems);
    setSeedSource(next.seedSource);
    setDirty(EMPTY_DIRTY_STATE);
    setErrors({});
    setSavedFamily(null);
  }, [contextQuery.data]);

  const providerCounts = useMemo(
    () => deriveFamilyCounts(contextQuery.data?.providerSnapshot),
    [contextQuery.data?.providerSnapshot],
  );

  const coreCounts = useMemo(
    () => deriveFamilyCounts(contextQuery.data?.core),
    [contextQuery.data?.core],
  );

  const markDirty = (family: FamilyKey) => {
    setDirty((current) => ({ ...current, [family]: true }));
    setErrors((current) => ({ ...current, [family]: null }));
    setSavedFamily((current) => (current === family ? null : current));
  };

  const updateBusinessDetails = <Key extends keyof BusinessDetailsEditor>(
    field: Key,
    value: BusinessDetailsEditor[Key],
  ) => {
    setBusinessDetails((current) => ({ ...current, [field]: value }));
    markDirty('businessDetails');
  };

  const addLink = () => {
    setLinks((current) => [
      ...current,
      {
        id: makeEditorId('link'),
        linkType: 'website',
        label: '',
        url: '',
        isPrimary: false,
      },
    ]);
    markDirty('links');
  };

  const updateLink = <Key extends keyof LinkEditor>(
    rowId: string,
    field: Key,
    value: LinkEditor[Key],
  ) => {
    setLinks((current) =>
      current.map((item) => (item.id === rowId ? { ...item, [field]: value } : item)),
    );
    markDirty('links');
  };

  const removeLink = (rowId: string) => {
    setLinks((current) => current.filter((item) => item.id !== rowId));
    markDirty('links');
  };

  const addCategory = () => {
    setCategories((current) => [
      ...current,
      {
        id: makeEditorId('category'),
        displayName: '',
        categoryCode: '',
        isPrimary: false,
        moreHoursTypes: [],
        moreHoursTypeDraft: '',
      },
    ]);
    markDirty('categories');
  };

  const updateCategory = <Key extends keyof CategoryEditor>(
    rowId: string,
    field: Key,
    value: CategoryEditor[Key],
  ) => {
    setCategories((current) =>
      current.map((item) => (item.id === rowId ? { ...item, [field]: value } : item)),
    );
    markDirty('categories');
  };

  const removeCategory = (rowId: string) => {
    setCategories((current) => current.filter((item) => item.id !== rowId));
    markDirty('categories');
  };

  const updateMoreHoursDraft = (rowId: string, value: string) => {
    setCategories((current) =>
      current.map((item) => (item.id === rowId ? { ...item, moreHoursTypeDraft: value } : item)),
    );
  };

  const addMoreHoursTypes = (rowId: string, value: string) => {
    const nextValues = splitChipDraft(value);
    if (nextValues.length === 0) {
      updateMoreHoursDraft(rowId, '');
      return;
    }

    setCategories((current) =>
      current.map((item) => {
        if (item.id !== rowId) {
          return item;
        }

        const existing = new Set(
          item.moreHoursTypes
            .map((moreHoursType) => formatMoreHoursTypeLabel(moreHoursType).toLowerCase())
            .filter(Boolean),
        );
        const additions = nextValues
          .filter((nextValue) => !existing.has(nextValue.toLowerCase()))
          .map((nextValue) => ({
            hoursTypeId: nextValue,
            displayName: null,
            localizedDisplayName: null,
          }));

        return {
          ...item,
          moreHoursTypes: [...item.moreHoursTypes, ...additions],
          moreHoursTypeDraft: '',
        };
      }),
    );
    markDirty('categories');
  };

  const removeMoreHoursType = (rowId: string, typeIndex: number) => {
    setCategories((current) =>
      current.map((item) =>
        item.id === rowId
          ? {
              ...item,
              moreHoursTypes: item.moreHoursTypes.filter((_, index) => index !== typeIndex),
            }
          : item,
      ),
    );
    markDirty('categories');
  };

  const updateServiceArea = <Key extends keyof ServiceAreaEditor>(
    rowId: string,
    field: Key,
    value: ServiceAreaEditor[Key],
  ) => {
    setServiceAreas((current) =>
      current.map((item) => (item.id === rowId ? { ...item, [field]: value } : item)),
    );
    markDirty('serviceAreas');
  };

  const addServiceAreaFromDraft = () => {
    const displayName = serviceAreaDraft.trim();
    if (!displayName) {
      return;
    }
    setServiceAreas((current) => [
      ...current,
      {
        id: makeEditorId('service-area'),
        displayName,
        areaType: 'region',
        regionCode: '',
        googlePlaceId: '',
        googlePlaceResourceName: '',
        placeDataJson: '',
      },
    ]);
    setServiceAreaDraft('');
    markDirty('serviceAreas');
  };

  const removeServiceArea = (rowId: string) => {
    setServiceAreas((current) => current.filter((item) => item.id !== rowId));
    markDirty('serviceAreas');
  };

  const toggleAmenityAttribute = (
    definition: AmenityAttributeDefinition,
    groupTitle: string,
    checked: boolean,
  ) => {
    setAttributes((current) => {
      const existing = current.find((item) => item.attributeKey === definition.key);
      if (existing) {
        return current.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                attributeGroup: item.attributeGroup || groupTitle,
                attributeId: item.attributeId || definition.key,
                displayName: item.displayName || definition.label,
                valueType: item.valueType || 'boolean',
                boolValue: checked ? 'true' : 'false',
              }
            : item,
        );
      }

      if (!checked) {
        return current;
      }

      return [
        ...current,
        {
          id: makeEditorId('attribute'),
          attributeGroup: groupTitle,
          attributeKey: definition.key,
          attributeName: '',
          attributeId: definition.key,
          displayName: definition.label,
          displayText: '',
          displayTextStandalone: '',
          displayTextNegative: '',
          valueType: 'boolean',
          boolValue: 'true',
          textValue: '',
          uriValue: '',
          uriValuesText: '',
          enumValuesText: '',
          unsetEnumValuesText: '',
          rawValueJson: '',
          rawEnumValuesJson: '',
          displayValueJson: '',
          valueMetadataJson: '',
        },
      ];
    });
    markDirty('attributes');
  };

  const addAttribute = () => {
    setAttributes((current) => [
      ...current,
      {
        id: makeEditorId('attribute'),
        attributeGroup: '',
        attributeKey: '',
        attributeName: '',
        attributeId: '',
        displayName: '',
        displayText: '',
        displayTextStandalone: '',
        displayTextNegative: '',
        valueType: 'text',
        boolValue: 'unset',
        textValue: '',
        uriValue: '',
        uriValuesText: '',
        enumValuesText: '',
        unsetEnumValuesText: '',
        rawValueJson: '',
        rawEnumValuesJson: '',
        displayValueJson: '',
        valueMetadataJson: '',
      },
    ]);
    markDirty('attributes');
  };

  const updateAttribute = <Key extends keyof AttributeEditor>(
    rowId: string,
    field: Key,
    value: AttributeEditor[Key],
  ) => {
    setAttributes((current) =>
      current.map((item) => (item.id === rowId ? { ...item, [field]: value } : item)),
    );
    markDirty('attributes');
  };

  const removeAttribute = (rowId: string) => {
    setAttributes((current) => current.filter((item) => item.id !== rowId));
    markDirty('attributes');
  };

  const addServiceItem = () => {
    setServiceItems((current) => [
      ...current,
      {
        id: makeEditorId('service-item'),
        itemKey: '',
        itemType: '',
        displayName: '',
        description: '',
        payloadJson: '',
      },
    ]);
    markDirty('serviceItems');
  };

  const updateServiceItem = <Key extends keyof ServiceItemEditor>(
    rowId: string,
    field: Key,
    value: ServiceItemEditor[Key],
  ) => {
    setServiceItems((current) =>
      current.map((item) => (item.id === rowId ? { ...item, [field]: value } : item)),
    );
    markDirty('serviceItems');
  };

  const removeServiceItem = (rowId: string) => {
    setServiceItems((current) => current.filter((item) => item.id !== rowId));
    markDirty('serviceItems');
  };

  const resetFamily = (family: FamilyKey) => {
    const data = contextQuery.data;
    if (!data) {
      return;
    }

    const next = deriveBusinessContextEditorState(data);

    if (family === 'businessDetails') {
      setBusinessDetails(next.businessDetails);
    }
    if (family === 'links') {
      setLinks(next.links);
    }
    if (family === 'categories') {
      setCategories(next.categories);
    }
    if (family === 'serviceAreas') {
      setServiceAreas(next.serviceAreas);
      setServiceAreaDraft('');
    }
    if (family === 'attributes') {
      setAttributes(next.attributes);
    }
    if (family === 'serviceItems') {
      setServiceItems(next.serviceItems);
    }

    setSeedSource((current) => ({ ...current, [family]: next.seedSource[family] }));
    setDirty((current) => ({ ...current, [family]: false }));
    setErrors((current) => ({ ...current, [family]: null }));
  };

  const saveFamily = async (family: FamilyKey) => {
    try {
      setSavingFamily(family);
      setErrors((current) => ({ ...current, [family]: null }));
      await updateMutation.mutateAsync(
        buildBusinessContextFamilyPayload(family, {
          businessDetails,
          links,
          categories,
          serviceAreas,
          attributes,
          serviceItems,
        }),
      );

      setDirty((current) => ({ ...current, [family]: false }));
      setSavedFamily(family);
      toast.success('Saved just now.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save changes.';
      setErrors((current) => ({ ...current, [family]: message }));
      toast.error(message);
    } finally {
      setSavingFamily(null);
    }
  };

  return {
    contextQuery,
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
    dirty,
    errors,
    savingFamily,
    savedFamily,
    providerCounts,
    coreCounts,
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
    saveFamily,
  };
}

export type RestaurantBusinessContextEditor = ReturnType<typeof useRestaurantBusinessContextEditor>;
