import { formatMoreHoursTypeLabel, makeEditorId, splitChipDraft } from './businessContextModel';

import type {
  AmenityAttributeDefinition,
  AttributeEditor,
  CategoryEditor,
  LinkEditor,
  ServiceAreaEditor,
  ServiceItemEditor,
} from './businessContextModel';

export function updateEditorRow<T extends { id: string }, Key extends keyof T>(
  rows: T[],
  rowId: string,
  field: Key,
  value: T[Key],
): T[] {
  return rows.map((item) => (item.id === rowId ? { ...item, [field]: value } : item));
}

export function removeEditorRow<T extends { id: string }>(rows: T[], rowId: string): T[] {
  return rows.filter((item) => item.id !== rowId);
}

export function createLinkEditor(): LinkEditor {
  return {
    id: makeEditorId('link'),
    linkType: 'website',
    label: '',
    url: '',
    isPrimary: false,
  };
}

export function createCategoryEditor(): CategoryEditor {
  return {
    id: makeEditorId('category'),
    displayName: '',
    categoryCode: '',
    isPrimary: false,
    moreHoursTypes: [],
    moreHoursTypeDraft: '',
  };
}

export function updateCategoryMoreHoursDraft(
  categories: CategoryEditor[],
  rowId: string,
  value: string,
): CategoryEditor[] {
  return updateEditorRow(categories, rowId, 'moreHoursTypeDraft', value);
}

export function hasMoreHoursTypeDraftValues(value: string): boolean {
  return splitChipDraft(value).length > 0;
}

export function addMoreHoursTypesToCategory(
  categories: CategoryEditor[],
  rowId: string,
  value: string,
): CategoryEditor[] {
  const nextValues = splitChipDraft(value);
  if (nextValues.length === 0) {
    return updateCategoryMoreHoursDraft(categories, rowId, '');
  }

  return categories.map((item) => {
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
  });
}

export function removeMoreHoursTypeFromCategory(
  categories: CategoryEditor[],
  rowId: string,
  typeIndex: number,
): CategoryEditor[] {
  return categories.map((item) =>
    item.id === rowId
      ? {
          ...item,
          moreHoursTypes: item.moreHoursTypes.filter((_, index) => index !== typeIndex),
        }
      : item,
  );
}

export function createServiceAreaEditor(displayName: string): ServiceAreaEditor {
  return {
    id: makeEditorId('service-area'),
    displayName,
    areaType: 'region',
    regionCode: '',
    googlePlaceId: '',
    googlePlaceResourceName: '',
    placeDataJson: '',
  };
}

export function createAttributeEditor(): AttributeEditor {
  return {
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
  };
}

export function createAmenityAttributeEditor(
  definition: AmenityAttributeDefinition,
  groupTitle: string,
): AttributeEditor {
  return {
    ...createAttributeEditor(),
    id: makeEditorId('attribute'),
    attributeGroup: groupTitle,
    attributeKey: definition.key,
    attributeId: definition.key,
    displayName: definition.label,
    valueType: 'boolean',
    boolValue: 'true',
  };
}

export function toggleAmenityAttributeEditor(
  attributes: AttributeEditor[],
  definition: AmenityAttributeDefinition,
  groupTitle: string,
  checked: boolean,
): AttributeEditor[] {
  const existing = attributes.find((item) => item.attributeKey === definition.key);
  if (existing) {
    return attributes.map((item) =>
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
    return attributes;
  }

  return [...attributes, createAmenityAttributeEditor(definition, groupTitle)];
}

export function createServiceItemEditor(): ServiceItemEditor {
  return {
    id: makeEditorId('service-item'),
    itemKey: '',
    itemType: '',
    displayName: '',
    description: '',
    payloadJson: '',
  };
}
