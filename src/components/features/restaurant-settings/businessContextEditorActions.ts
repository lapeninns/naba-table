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

/**
 * Adds a named category. The first category becomes the main one, as a listing needs one.
 */
export function addNamedCategoryEditor(
  categories: CategoryEditor[],
  row: CategoryEditor,
): CategoryEditor[] {
  return [...categories, { ...row, isPrimary: categories.length === 0 }];
}

/** Marks one category as the main one and clears the others: only one can be main. */
export function makePrimaryCategoryEditor(
  categories: CategoryEditor[],
  rowId: string,
): CategoryEditor[] {
  return categories.map((item) => ({ ...item, isPrimary: item.id === rowId }));
}

/** Removes a category; when the main one goes, the first remaining category becomes main. */
export function removeCategoryEditor(
  categories: CategoryEditor[],
  rowId: string,
): CategoryEditor[] {
  const removed = categories.find((item) => item.id === rowId);
  const remaining = removeEditorRow(categories, rowId);
  if (!removed?.isPrimary || remaining.length === 0 || remaining.some((item) => item.isPrimary)) {
    return remaining;
  }
  return remaining.map((item, index) => (index === 0 ? { ...item, isPrimary: true } : item));
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

/** Adds an area by name unless it is already listed. */
export function addNamedServiceAreaEditor(
  serviceAreas: ServiceAreaEditor[],
  row: ServiceAreaEditor,
): ServiceAreaEditor[] {
  const name = row.displayName.trim().toLowerCase();
  if (!name || serviceAreas.some((item) => item.displayName.trim().toLowerCase() === name)) {
    return serviceAreas;
  }
  return [...serviceAreas, row];
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

export type AmenityValue = AttributeEditor['boolValue'];

export function createAmenityAttributeEditor(
  definition: AmenityAttributeDefinition,
  groupTitle: string,
  value: Exclude<AmenityValue, 'unset'> = 'true',
): AttributeEditor {
  return {
    ...createAttributeEditor(),
    id: makeEditorId('attribute'),
    attributeGroup: groupTitle,
    attributeKey: definition.key,
    attributeId: definition.key,
    displayName: definition.label,
    valueType: 'boolean',
    boolValue: value,
  };
}

function isUnsavedEditorRow(row: { id: string }, prefix: string): boolean {
  return row.id.startsWith(`${prefix}-`);
}

/**
 * Sets an amenity to Yes, No or Not set. "Not set" keeps a saved row (its value becomes unknown)
 * but drops a row that was only added in this draft, so nothing new is sent for it.
 */
export function setAmenityAttributeValue(
  attributes: AttributeEditor[],
  definition: AmenityAttributeDefinition,
  groupTitle: string,
  value: AmenityValue,
): AttributeEditor[] {
  const existing = attributes.find((item) => item.attributeKey === definition.key);
  if (!existing) {
    return value === 'unset'
      ? attributes
      : [...attributes, createAmenityAttributeEditor(definition, groupTitle, value)];
  }

  if (value === 'unset' && isUnsavedEditorRow(existing, 'attribute')) {
    return removeEditorRow(attributes, existing.id);
  }

  return attributes.map((item) =>
    item.id === existing.id
      ? {
          ...item,
          attributeGroup: item.attributeGroup || groupTitle,
          attributeId: item.attributeId || definition.key,
          displayName: item.displayName || definition.label,
          valueType: item.valueType || 'boolean',
          boolValue: value,
        }
      : item,
  );
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
