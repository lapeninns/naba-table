/**
 * Phase 3f of the unified dual-sync engine.
 *
 * Pure builders that translate dual-sync canonical values into the
 * shapes Google's Business Profile API expects on the wire. These are
 * intentionally narrow — they don't talk to the network and don't read
 * any Supabase tables — so the export ports can be unit-tested without
 * mocking large surfaces.
 *
 * Mirrors the V2 publish wiring helpers so the two stacks stay aligned
 * during the overlap window.
 */

import type {
  DualSyncAttributeValue,
  DualSyncCategoryValue,
  DualSyncProfileSectionValue,
  DualSyncServiceAreaValue,
  DualSyncServiceItemValue,
} from '../../snapshots/types';

export function normalizeGoogleCategoryName(categoryCode: string | null): string | null {
  if (!categoryCode) return null;
  const trimmed = categoryCode.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('categories/') ? trimmed : `categories/${trimmed}`;
}

export function buildGoogleCategoryPayload(category: DualSyncCategoryValue) {
  const name = normalizeGoogleCategoryName(category.categoryCode);
  if (!name) {
    throw new Error(`Category "${category.displayName}" requires a Google category code.`);
  }
  return {
    name,
    displayName: category.displayName,
    moreHoursTypes: category.moreHoursTypes.map((type) => ({
      ...(type.hoursTypeId ? { hoursTypeId: type.hoursTypeId } : {}),
      ...(type.displayName ? { displayName: type.displayName } : {}),
      ...(type.localizedDisplayName ? { localizedDisplayName: type.localizedDisplayName } : {}),
    })),
  };
}

export function buildGoogleCategoriesPatch(categories: ReadonlyArray<DualSyncCategoryValue>) {
  if (categories.length === 0) {
    throw new Error('At least one category is required before exporting categories to Google.');
  }
  const primary = categories.find((c) => c.isPrimary) ?? categories[0];
  if (!primary) {
    throw new Error('At least one category is required before exporting categories to Google.');
  }
  return {
    primaryCategory: buildGoogleCategoryPayload(primary),
    additionalCategories: categories
      .filter((c) => c !== primary)
      .map(buildGoogleCategoryPayload),
  };
}

export function googleBusinessTypeForServiceAreas(
  serviceAreas: ReadonlyArray<DualSyncServiceAreaValue>,
): string {
  for (const area of serviceAreas) {
    const businessType =
      area.placeData && typeof area.placeData.businessType === 'string'
        ? (area.placeData.businessType as string).trim()
        : '';
    if (businessType) return businessType;
  }
  return 'CUSTOMER_LOCATION_ONLY';
}

export function buildGoogleServiceAreaPatch(
  serviceAreas: ReadonlyArray<DualSyncServiceAreaValue>,
): Record<string, unknown> {
  if (serviceAreas.length === 0) {
    throw new Error(
      'At least one service area is required before exporting service areas to Google.',
    );
  }
  const placeInfos = serviceAreas
    .map((area) => area.placeData)
    .filter((placeData): placeData is Record<string, unknown> =>
      Boolean(placeData && Object.keys(placeData).length > 0),
    );
  const regionCode =
    serviceAreas.find((area) => area.regionCode)?.regionCode ??
    serviceAreas
      .map((area) =>
        area.placeData && typeof area.placeData.regionCode === 'string'
          ? (area.placeData.regionCode as string).trim()
          : null,
      )
      .find((value): value is string => Boolean(value)) ??
    undefined;

  return {
    businessType: googleBusinessTypeForServiceAreas(serviceAreas),
    ...(regionCode ? { regionCode } : {}),
    ...(placeInfos.length > 0 ? { places: { placeInfos } } : {}),
  };
}

export function buildGoogleServiceItemsPatch(
  serviceItems: ReadonlyArray<DualSyncServiceItemValue>,
): Array<Record<string, unknown>> {
  return serviceItems.map((item) => {
    if (!item.payload || Object.keys(item.payload).length === 0) {
      throw new Error(`Service item "${item.itemKey}" requires a canonical Google payload.`);
    }
    return item.payload;
  });
}

export function normalizeAttributeName(attribute: DualSyncAttributeValue): string {
  const raw =
    attribute.attributeName?.trim() ||
    attribute.attributeId?.trim() ||
    attribute.attributeKey.trim();
  if (!raw) {
    throw new Error(`Attribute "${attribute.attributeKey}" requires a Google attribute name.`);
  }
  const locationScoped = raw.match(/\/attributes\/([^/]+)$/);
  if (locationScoped?.[1]) {
    return `attributes/${locationScoped[1]}`;
  }
  return raw.startsWith('attributes/') ? raw : `attributes/${raw}`;
}

export function buildGoogleAttribute(
  attribute: DualSyncAttributeValue,
): Record<string, unknown> {
  const name = normalizeAttributeName(attribute);
  const valueType = attribute.valueType.toUpperCase();
  if (valueType.includes('BOOL')) {
    if (typeof attribute.boolValue !== 'boolean') {
      throw new Error(`Attribute "${attribute.attributeKey}" requires a boolean value.`);
    }
    return { name, values: [{ boolValue: attribute.boolValue }] };
  }
  if (valueType.includes('URL')) {
    const uris = [
      ...(attribute.uriValue ? [attribute.uriValue] : []),
      ...attribute.uriValues,
    ].filter((value, index, all) => value && all.indexOf(value) === index);
    if (uris.length === 0) {
      throw new Error(`Attribute "${attribute.attributeKey}" requires at least one URL.`);
    }
    return { name, uriValues: uris.map((uri) => ({ uri })) };
  }
  if (valueType.includes('ENUM')) {
    const enumValues = [...attribute.enumValues, ...attribute.unsetEnumValues];
    if (enumValues.length === 0 || enumValues.some((value) => /\s/.test(value.trim()))) {
      throw new Error(
        `Attribute "${attribute.attributeKey}" requires raw Google enum value IDs before export.`,
      );
    }
    return {
      name,
      repeatedEnumValue: {
        setValues: [...attribute.enumValues],
        unsetValues: [...attribute.unsetEnumValues],
      },
    };
  }
  if (!attribute.textValue) {
    throw new Error(`Attribute "${attribute.attributeKey}" requires a text value.`);
  }
  return { name, values: [{ stringValue: attribute.textValue }] };
}

export function buildGoogleStorefrontAddressPatch(input: {
  readonly nabatableAddress: string | null;
  readonly googleAddress: DualSyncProfileSectionValue['storefrontAddress'];
}): Record<string, unknown> {
  if (!input.nabatableAddress?.trim()) {
    throw new Error('Address export requires a Nabatable address value.');
  }
  if (!input.googleAddress?.regionCode) {
    throw new Error('Address export requires an existing Google storefrontAddress region code.');
  }
  return {
    addressLines: [input.nabatableAddress.trim()],
    locality: input.googleAddress.locality ?? undefined,
    administrativeArea: input.googleAddress.administrativeArea ?? undefined,
    postalCode: input.googleAddress.postalCode ?? undefined,
    regionCode: input.googleAddress.regionCode,
    languageCode: input.googleAddress.languageCode ?? undefined,
    sublocality: input.googleAddress.sublocality ?? undefined,
    organization: input.googleAddress.organization ?? undefined,
    recipients: input.googleAddress.recipients,
  };
}
