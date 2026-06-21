import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig } from '../../registry';
import { slugifyDisplay } from '../../registry/normalizers';

import type { DualSyncFieldConfig } from '../../registry';
import type {
  DualSyncAttributeValue,
  DualSyncCanonicalSnapshot,
  DualSyncCategoryValue,
  DualSyncServiceAreaValue,
  DualSyncServiceItemValue,
} from '../../snapshots/types';
import type { DualSyncOperationResult } from '../types';
import type {
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';

export const BUSINESS_CONTEXT_IMPORT_PREFIX = {
  category: 'businessContext.categories.',
  serviceArea: 'businessContext.serviceAreas.',
  attribute: 'businessContext.attributes.',
  serviceItem: 'businessContext.serviceItems.',
} as const;

type CategoriesArray = NonNullable<UpdateRestaurantBusinessContextInput['categories']>;
type ServiceAreasArray = NonNullable<UpdateRestaurantBusinessContextInput['serviceAreas']>;
type AttributesArray = NonNullable<UpdateRestaurantBusinessContextInput['attributes']>;
type ServiceItemsArray = NonNullable<UpdateRestaurantBusinessContextInput['serviceItems']>;

export function parseBusinessContextImportId(fieldKey: string, prefix: string): string | null {
  if (!fieldKey.startsWith(prefix)) return null;
  const tail = fieldKey.slice(prefix.length);
  return tail.length > 0 ? tail : null;
}

export function buildBusinessContextImportPortFailure(
  message: string,
  retryable = false,
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: { code: 'PORT_FAILURE', message, retryable },
  };
}

export function buildBusinessContextImportRegistryFailure(
  fieldKey: string,
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'INVALID_DECISION',
      message: `Field ${fieldKey} is not in the registry.`,
      retryable: false,
    },
  };
}

export function resolveBusinessContextImportFieldConfig(
  registry: ReadonlyArray<DualSyncFieldConfig>,
  fieldKey: string,
):
  | {
      readonly status: 'ready';
      readonly config: DualSyncFieldConfig;
    }
  | {
      readonly status: 'failed';
      readonly result: DualSyncOperationResult;
    } {
  const config = findFieldConfig(registry, fieldKey);
  if (!config) {
    return { status: 'failed', result: buildBusinessContextImportRegistryFailure(fieldKey) };
  }
  return { status: 'ready', config };
}

export function buildBusinessContextImportSuccess(
  config: DualSyncFieldConfig,
  googleEntry: unknown | null,
): DualSyncOperationResult {
  const canonical = config.canonicalizeCoreValue(googleEntry ? [googleEntry] : []);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

export function findGoogleCategoryForImport(
  snapshot: DualSyncCanonicalSnapshot,
  slug: string,
): DualSyncCategoryValue | null {
  const list = snapshot.businessContext?.categories ?? [];
  return list.find((entry) => slugifyDisplay(entry.displayName) === slug) ?? null;
}

export function findGoogleServiceAreaForImport(
  snapshot: DualSyncCanonicalSnapshot,
  slug: string,
): DualSyncServiceAreaValue | null {
  const list = snapshot.businessContext?.serviceAreas ?? [];
  return list.find((entry) => slugifyDisplay(entry.displayName) === slug) ?? null;
}

export function findGoogleAttributeForImport(
  snapshot: DualSyncCanonicalSnapshot,
  attributeKey: string,
): DualSyncAttributeValue | null {
  const list = snapshot.businessContext?.attributes ?? [];
  return list.find((entry) => entry.attributeKey === attributeKey) ?? null;
}

export function findGoogleServiceItemForImport(
  snapshot: DualSyncCanonicalSnapshot,
  itemKey: string,
): DualSyncServiceItemValue | null {
  const list = snapshot.businessContext?.serviceItems ?? [];
  return list.find((entry) => entry.itemKey === itemKey) ?? null;
}

export function buildCategoryImportUpdate(
  current: RestaurantBusinessContextSnapshot['core']['categories'],
  slug: string,
  googleEntry: DualSyncCategoryValue | null,
): CategoriesArray {
  const others = current
    .filter((row) => slugifyDisplay(row.displayName) !== slug)
    .map<CategoriesArray[number]>((row) => ({
      id: row.id,
      displayName: row.displayName,
      categoryCode: row.categoryCode,
      moreHoursTypes: [...row.moreHoursTypes],
      isPrimary: row.isPrimary,
    }));
  const existing = current.find((row) => slugifyDisplay(row.displayName) === slug);

  return googleEntry
    ? [
        ...others,
        {
          id: existing?.id,
          displayName: googleEntry.displayName,
          categoryCode: googleEntry.categoryCode,
          moreHoursTypes: googleEntry.moreHoursTypes
            ? googleEntry.moreHoursTypes.map((entry) => ({
                hoursTypeId: entry.hoursTypeId,
                displayName: entry.displayName,
                localizedDisplayName: entry.localizedDisplayName,
              }))
            : [],
          isPrimary: googleEntry.isPrimary,
        },
      ]
    : others;
}

export function buildServiceAreaImportUpdate(
  current: RestaurantBusinessContextSnapshot['core']['serviceAreas'],
  slug: string,
  googleEntry: DualSyncServiceAreaValue | null,
): ServiceAreasArray {
  const others = current
    .filter((row) => slugifyDisplay(row.displayName) !== slug)
    .map<ServiceAreasArray[number]>((row) => ({
      id: row.id,
      displayName: row.displayName,
      areaType: row.areaType,
      regionCode: row.regionCode,
      googlePlaceId: row.googlePlaceId,
      googlePlaceResourceName: row.googlePlaceResourceName,
      placeData: row.placeData,
    }));
  const existing = current.find((row) => slugifyDisplay(row.displayName) === slug);

  return googleEntry
    ? [
        ...others,
        {
          id: existing?.id,
          displayName: googleEntry.displayName,
          areaType: googleEntry.areaType,
          regionCode: googleEntry.regionCode,
          googlePlaceId: existing?.googlePlaceId ?? null,
          googlePlaceResourceName: existing?.googlePlaceResourceName ?? null,
          placeData: googleEntry.placeData,
        },
      ]
    : others;
}

export function buildAttributeImportUpdate(
  current: RestaurantBusinessContextSnapshot['core']['attributes'],
  attributeKey: string,
  googleEntry: DualSyncAttributeValue | null,
): AttributesArray {
  const others = current
    .filter((row) => row.attributeKey !== attributeKey)
    .map<AttributesArray[number]>((row) => ({
      id: row.id,
      attributeGroup: row.attributeGroup,
      attributeKey: row.attributeKey,
      attributeName: row.attributeName,
      attributeId: row.attributeId,
      displayName: row.displayName,
      displayText: row.displayText,
      displayTextStandalone: row.displayTextStandalone,
      displayTextNegative: row.displayTextNegative,
      valueType: row.valueType,
      boolValue: row.boolValue,
      textValue: row.textValue,
      uriValue: row.uriValue,
      uriValues: [...row.uriValues],
      enumValues: [...row.enumValues],
      unsetEnumValues: [...row.unsetEnumValues],
      rawValue: row.rawValue,
      rawEnumValues: row.rawEnumValues,
      displayValue: row.displayValue,
      valueMetadata: [...row.valueMetadata],
    }));
  const existing = current.find((row) => row.attributeKey === attributeKey);

  return googleEntry
    ? [
        ...others,
        {
          id: existing?.id,
          attributeGroup: existing?.attributeGroup ?? null,
          attributeKey: googleEntry.attributeKey,
          attributeName: googleEntry.attributeName ?? existing?.attributeName ?? null,
          attributeId: googleEntry.attributeId ?? existing?.attributeId ?? null,
          displayName: existing?.displayName ?? null,
          displayText: existing?.displayText ?? null,
          displayTextStandalone: existing?.displayTextStandalone ?? null,
          displayTextNegative: existing?.displayTextNegative ?? null,
          valueType: googleEntry.valueType,
          boolValue: googleEntry.boolValue,
          textValue: googleEntry.textValue,
          uriValue: googleEntry.uriValue,
          uriValues: [...googleEntry.uriValues],
          enumValues: [...googleEntry.enumValues],
          unsetEnumValues: [...googleEntry.unsetEnumValues],
          rawValue: existing?.rawValue ?? null,
          rawEnumValues: existing?.rawEnumValues ?? null,
          displayValue: existing?.displayValue ?? null,
          valueMetadata: existing ? [...existing.valueMetadata] : [],
        },
      ]
    : others;
}

export function buildServiceItemImportUpdate(
  current: RestaurantBusinessContextSnapshot['core']['serviceItems'],
  itemKey: string,
  googleEntry: DualSyncServiceItemValue | null,
): ServiceItemsArray {
  const others = current
    .filter((row) => row.itemKey !== itemKey)
    .map<ServiceItemsArray[number]>((row) => ({
      id: row.id,
      itemKey: row.itemKey,
      itemType: row.itemType,
      displayName: row.displayName,
      description: row.description,
      payload: row.payload,
    }));
  const existing = current.find((row) => row.itemKey === itemKey);

  return googleEntry
    ? [
        ...others,
        {
          id: existing?.id,
          itemKey: googleEntry.itemKey,
          itemType: googleEntry.itemType,
          displayName: googleEntry.displayName,
          description: googleEntry.description,
          payload: googleEntry.payload,
        },
      ]
    : others;
}
