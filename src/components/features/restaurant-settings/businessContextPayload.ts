import type { BusinessContextFamilyPayloadState, FamilyKey } from './businessContextModel';
import type {
  RestaurantBusinessContextMoreHoursType,
  UpdateRestaurantBusinessContextInput,
} from '@/services/ops/restaurants';

export function csvToArray(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeMoreHoursTypes(
  rows: RestaurantBusinessContextMoreHoursType[],
): RestaurantBusinessContextMoreHoursType[] {
  return rows
    .map((row) => ({
      hoursTypeId: row.hoursTypeId?.trim() || null,
      displayName: row.displayName?.trim() || null,
      localizedDisplayName: row.localizedDisplayName?.trim() || null,
    }))
    .filter(
      (row) =>
        row.hoursTypeId !== null || row.displayName !== null || row.localizedDisplayName !== null,
    );
}

export function parseJsonRecord(value: string, label: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON object syntax.`);
  }
}

export function parseJsonArray<T>(value: string, label: string): T[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as T[];
  } catch {
    throw new Error(`${label} must be valid JSON array syntax.`);
  }
}

export function buildBusinessContextFamilyPayload(
  family: FamilyKey,
  state: BusinessContextFamilyPayloadState,
): UpdateRestaurantBusinessContextInput {
  if (family === 'businessDetails') {
    return {
      businessDetails: {
        openingDate: state.businessDetails.openingDate.trim() || null,
        businessStatus:
          state.businessDetails.businessStatus === 'unset'
            ? null
            : state.businessDetails.businessStatus,
        isServiceAreaBusiness: state.businessDetails.isServiceAreaBusiness,
      },
    };
  }

  if (family === 'links') {
    return {
      links: state.links.map((row) => ({
        id: row.id.startsWith('link-') ? undefined : row.id,
        linkType: row.linkType.trim(),
        linkStatus: 'current',
        label: row.label.trim() || null,
        url: row.url.trim(),
        isPrimary: row.isPrimary,
      })),
    };
  }

  if (family === 'categories') {
    const primaryCount = state.categories.filter((row) => row.isPrimary).length;
    if (primaryCount > 1) {
      throw new Error('Only one category can be marked as primary.');
    }

    return {
      categories: state.categories.map((row) => ({
        id: row.id.startsWith('category-') ? undefined : row.id,
        displayName: row.displayName.trim(),
        categoryCode: row.categoryCode.trim() || null,
        isPrimary: row.isPrimary,
        moreHoursTypes: serializeMoreHoursTypes(row.moreHoursTypes),
      })),
    };
  }

  if (family === 'serviceAreas') {
    return {
      serviceAreas: state.serviceAreas.map((row) => ({
        id: row.id.startsWith('service-area-') ? undefined : row.id,
        displayName: row.displayName.trim(),
        areaType: row.areaType.trim() || 'region',
        regionCode: row.regionCode.trim() || null,
        googlePlaceId: row.googlePlaceId.trim() || null,
        googlePlaceResourceName: row.googlePlaceResourceName.trim() || null,
        placeData: parseJsonRecord(row.placeDataJson, 'Place data'),
      })),
    };
  }

  if (family === 'attributes') {
    return {
      attributes: state.attributes.map((row) => ({
        id: row.id.startsWith('attribute-') ? undefined : row.id,
        attributeGroup: row.attributeGroup.trim() || null,
        attributeKey: row.attributeKey.trim(),
        attributeName: row.attributeName.trim() || null,
        attributeId: row.attributeId.trim() || null,
        displayName: row.displayName.trim() || null,
        displayText: row.displayText.trim() || null,
        displayTextStandalone: row.displayTextStandalone.trim() || null,
        displayTextNegative: row.displayTextNegative.trim() || null,
        valueType: row.valueType.trim(),
        boolValue: row.boolValue === 'unset' ? null : row.boolValue === 'true',
        textValue: row.textValue.trim() || null,
        uriValue: row.uriValue.trim() || null,
        uriValues: csvToArray(row.uriValuesText),
        enumValues: csvToArray(row.enumValuesText),
        unsetEnumValues: csvToArray(row.unsetEnumValuesText),
        rawValue: parseJsonRecord(row.rawValueJson, 'Raw value'),
        rawEnumValues: parseJsonRecord(row.rawEnumValuesJson, 'Raw enum values'),
        displayValue: parseJsonRecord(row.displayValueJson, 'Display value'),
        valueMetadata: parseJsonArray(row.valueMetadataJson, 'Value metadata'),
      })),
    };
  }

  return {
    serviceItems: state.serviceItems.map((row) => ({
      id: row.id.startsWith('service-item-') ? undefined : row.id,
      itemKey: row.itemKey.trim(),
      itemType: row.itemType.trim() || null,
      displayName: row.displayName.trim() || null,
      description: row.description.trim() || null,
      payload: parseJsonRecord(row.payloadJson, 'Payload'),
    })),
  };
}
