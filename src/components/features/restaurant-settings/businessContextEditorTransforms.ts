import {
  RESTAURANT_EDITABLE_LINK_TYPES,
  type RestaurantEditableLinkType,
} from '@/lib/ops/restaurant-link-types';

import type {
  AttributeEditor,
  BusinessDetailsEditor,
  CategoryEditor,
  LinkEditor,
  ServiceAreaEditor,
  ServiceItemEditor,
} from './businessContextModel';
import type {
  RestaurantBusinessContextAttribute,
  RestaurantBusinessContextBusinessDetails,
  RestaurantBusinessContextCategory,
  RestaurantBusinessContextLink,
  RestaurantBusinessContextServiceArea,
  RestaurantBusinessContextServiceItem,
} from '@/services/ops/restaurants';

const EMPTY_BUSINESS_DETAILS: BusinessDetailsEditor = {
  openingDate: '',
  businessStatus: 'unset',
  isServiceAreaBusiness: false,
};

const EDITABLE_LINK_TYPES = new Set<RestaurantEditableLinkType>(RESTAURANT_EDITABLE_LINK_TYPES);

export function toPrettyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value) && value.length === 0) {
    return '';
  }
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  ) {
    return '';
  }
  return JSON.stringify(value, null, 2);
}

export function isEditableLinkType(linkType: string): linkType is RestaurantEditableLinkType {
  return EDITABLE_LINK_TYPES.has(linkType as RestaurantEditableLinkType);
}

export function filterEditableLinks(
  input: RestaurantBusinessContextLink[] | null | undefined,
): RestaurantBusinessContextLink[] {
  return (input ?? []).filter((row) => isEditableLinkType(row.linkType));
}

export function toCategoryEditors(input: RestaurantBusinessContextCategory[]): CategoryEditor[] {
  return input.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    categoryCode: row.categoryCode ?? '',
    isPrimary: row.isPrimary,
    moreHoursTypes: row.moreHoursTypes.map((moreHoursType) => ({
      hoursTypeId: moreHoursType.hoursTypeId,
      displayName: moreHoursType.displayName,
      localizedDisplayName: moreHoursType.localizedDisplayName,
    })),
    moreHoursTypeDraft: '',
  }));
}

export function toServiceAreaEditors(
  input: RestaurantBusinessContextServiceArea[],
): ServiceAreaEditor[] {
  return input.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    areaType: row.areaType,
    regionCode: row.regionCode ?? '',
    googlePlaceId: row.googlePlaceId ?? '',
    googlePlaceResourceName: row.googlePlaceResourceName ?? '',
    placeDataJson: toPrettyJson(row.placeData),
  }));
}

export function toAttributeEditors(input: RestaurantBusinessContextAttribute[]): AttributeEditor[] {
  return input.map((row) => ({
    id: row.id,
    attributeGroup: row.attributeGroup ?? '',
    attributeKey: row.attributeKey,
    attributeName: row.attributeName ?? '',
    attributeId: row.attributeId ?? '',
    displayName: row.displayName ?? '',
    displayText: row.displayText ?? '',
    displayTextStandalone: row.displayTextStandalone ?? '',
    displayTextNegative: row.displayTextNegative ?? '',
    valueType: row.valueType,
    boolValue: row.boolValue === true ? 'true' : row.boolValue === false ? 'false' : 'unset',
    textValue: row.textValue ?? '',
    uriValue: row.uriValue ?? '',
    uriValuesText: row.uriValues.join(', '),
    enumValuesText: row.enumValues.join(', '),
    unsetEnumValuesText: row.unsetEnumValues.join(', '),
    rawValueJson: toPrettyJson(row.rawValue),
    rawEnumValuesJson: toPrettyJson(row.rawEnumValues),
    displayValueJson: toPrettyJson(row.displayValue),
    valueMetadataJson: toPrettyJson(row.valueMetadata),
  }));
}

export function toServiceItemEditors(
  input: RestaurantBusinessContextServiceItem[],
): ServiceItemEditor[] {
  return input.map((row) => ({
    id: row.id,
    itemKey: row.itemKey,
    itemType: row.itemType ?? '',
    displayName: row.displayName ?? '',
    description: row.description ?? '',
    payloadJson: toPrettyJson(row.payload),
  }));
}

export function toBusinessDetailsEditor(
  input: RestaurantBusinessContextBusinessDetails | null | undefined,
): BusinessDetailsEditor {
  if (!input) {
    return EMPTY_BUSINESS_DETAILS;
  }

  return {
    openingDate: input.openingDate ?? '',
    businessStatus:
      input.businessStatus === 'open' ||
      input.businessStatus === 'closed_permanently' ||
      input.businessStatus === 'closed_temporarily'
        ? input.businessStatus
        : 'unset',
    isServiceAreaBusiness: input.isServiceAreaBusiness,
  };
}

export function toLinkEditors(input: RestaurantBusinessContextLink[]): LinkEditor[] {
  return filterEditableLinks(input).map((row) => ({
    id: row.id,
    linkType: row.linkType,
    label: row.label ?? '',
    url: row.url,
    isPrimary: row.isPrimary,
  }));
}
