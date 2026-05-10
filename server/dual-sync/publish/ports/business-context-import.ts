/**
 * Phase 3e of the unified dual-sync engine.
 *
 * Concrete `applyImportToCore` ports for the four business-context
 * sub-sections: categories, service areas, attributes, and service items.
 *
 * For each sub-section we:
 *  - parse the field key to recover the stable identifier (slug for
 *    display-name-keyed rows, `attributeKey` / `itemKey` otherwise),
 *  - read the full current core list (so we keep the database row ids and
 *    section fields the dual-sync canonical snapshot does not project),
 *  - splice in the canonical Google value (or remove the row when Google
 *    is missing the entry — that is the "delete" semantic for an import),
 *  - send the mutated array back through `updateRestaurantBusinessContext`,
 *  - return the canonical hash of the new state so the orchestrator can
 *    bookkeep `in_sync_hash` for the field.
 */

import {
  getRestaurantBusinessContext,
  updateRestaurantBusinessContext,
  type UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';

import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig, buildRegistry } from '../../registry';
import { slugifyDisplay } from '../../registry/normalizers';

import type {
  DualSyncAttributeValue,
  DualSyncCategoryValue,
  DualSyncServiceAreaValue,
  DualSyncServiceItemValue,
} from '../../snapshots/types';
import type {
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

type CategoriesArray = NonNullable<UpdateRestaurantBusinessContextInput['categories']>;
type ServiceAreasArray = NonNullable<UpdateRestaurantBusinessContextInput['serviceAreas']>;
type AttributesArray = NonNullable<UpdateRestaurantBusinessContextInput['attributes']>;
type ServiceItemsArray = NonNullable<UpdateRestaurantBusinessContextInput['serviceItems']>;

const PREFIX = {
  category: 'businessContext.categories.',
  serviceArea: 'businessContext.serviceAreas.',
  attribute: 'businessContext.attributes.',
  serviceItem: 'businessContext.serviceItems.',
} as const;

function parseSlug(fieldKey: string, prefix: string): string | null {
  if (!fieldKey.startsWith(prefix)) return null;
  const tail = fieldKey.slice(prefix.length);
  return tail.length > 0 ? tail : null;
}

function failedPort(message: string, retryable = false): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: { code: 'PORT_FAILURE', message, retryable },
  };
}

function failedRegistry(fieldKey: string): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'INVALID_DECISION',
      message: `Field ${fieldKey} is not in the registry.`,
      retryable: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function findGoogleCategory(
  ctx: DualSyncOperationContext,
  slug: string,
): DualSyncCategoryValue | null {
  const list = ctx.gbpSnapshot.businessContext?.categories ?? [];
  return (
    list.find((entry) => slugifyDisplay(entry.displayName) === slug) ?? null
  );
}

export async function applyBusinessContextCategoryImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const slug = parseSlug(ctx.decision.fieldKey, PREFIX.category);
  if (!slug) return failedPort(`Categories port does not handle ${ctx.decision.fieldKey}.`);

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, ctx.decision.fieldKey);
  if (!config) return failedRegistry(ctx.decision.fieldKey);

  const googleEntry = findGoogleCategory(ctx, slug);
  const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
  const current = snapshot.core.categories;

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

  const updated: CategoriesArray = googleEntry
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

  await updateRestaurantBusinessContext(
    ctx.restaurantId,
    { categories: updated },
    ctx.client,
    {
      changeOrigin: 'import',
      changedByUserId: ctx.actorUserId ?? null,
      changedVia: 'dual-sync.publish',
      publishJobId: ctx.publishJobId,
    },
  );

  const canonical = config.canonicalizeCoreValue(googleEntry ? [googleEntry] : []);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

// ---------------------------------------------------------------------------
// Service areas
// ---------------------------------------------------------------------------

function findGoogleServiceArea(
  ctx: DualSyncOperationContext,
  slug: string,
): DualSyncServiceAreaValue | null {
  const list = ctx.gbpSnapshot.businessContext?.serviceAreas ?? [];
  return list.find((entry) => slugifyDisplay(entry.displayName) === slug) ?? null;
}

export async function applyBusinessContextServiceAreaImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const slug = parseSlug(ctx.decision.fieldKey, PREFIX.serviceArea);
  if (!slug) return failedPort(`Service-areas port does not handle ${ctx.decision.fieldKey}.`);

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, ctx.decision.fieldKey);
  if (!config) return failedRegistry(ctx.decision.fieldKey);

  const googleEntry = findGoogleServiceArea(ctx, slug);
  const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
  const current = snapshot.core.serviceAreas;

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

  const updated: ServiceAreasArray = googleEntry
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

  await updateRestaurantBusinessContext(
    ctx.restaurantId,
    { serviceAreas: updated },
    ctx.client,
    {
      changeOrigin: 'import',
      changedByUserId: ctx.actorUserId ?? null,
      changedVia: 'dual-sync.publish',
      publishJobId: ctx.publishJobId,
    },
  );

  const canonical = config.canonicalizeCoreValue(googleEntry ? [googleEntry] : []);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

function findGoogleAttribute(
  ctx: DualSyncOperationContext,
  attributeKey: string,
): DualSyncAttributeValue | null {
  const list = ctx.gbpSnapshot.businessContext?.attributes ?? [];
  return list.find((entry) => entry.attributeKey === attributeKey) ?? null;
}

export async function applyBusinessContextAttributeImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const attributeKey = parseSlug(ctx.decision.fieldKey, PREFIX.attribute);
  if (!attributeKey) {
    return failedPort(`Attributes port does not handle ${ctx.decision.fieldKey}.`);
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, ctx.decision.fieldKey);
  if (!config) return failedRegistry(ctx.decision.fieldKey);

  const googleEntry = findGoogleAttribute(ctx, attributeKey);
  const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
  const current = snapshot.core.attributes;

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

  const updated: AttributesArray = googleEntry
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

  await updateRestaurantBusinessContext(
    ctx.restaurantId,
    { attributes: updated },
    ctx.client,
    {
      changeOrigin: 'import',
      changedByUserId: ctx.actorUserId ?? null,
      changedVia: 'dual-sync.publish',
      publishJobId: ctx.publishJobId,
    },
  );

  const canonical = config.canonicalizeCoreValue(googleEntry ? [googleEntry] : []);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

// ---------------------------------------------------------------------------
// Service items
// ---------------------------------------------------------------------------

function findGoogleServiceItem(
  ctx: DualSyncOperationContext,
  itemKey: string,
): DualSyncServiceItemValue | null {
  const list = ctx.gbpSnapshot.businessContext?.serviceItems ?? [];
  return list.find((entry) => entry.itemKey === itemKey) ?? null;
}

export async function applyBusinessContextServiceItemImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const itemKey = parseSlug(ctx.decision.fieldKey, PREFIX.serviceItem);
  if (!itemKey) {
    return failedPort(`Service-items port does not handle ${ctx.decision.fieldKey}.`);
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, ctx.decision.fieldKey);
  if (!config) return failedRegistry(ctx.decision.fieldKey);

  const googleEntry = findGoogleServiceItem(ctx, itemKey);
  const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
  const current = snapshot.core.serviceItems;

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

  const updated: ServiceItemsArray = googleEntry
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

  await updateRestaurantBusinessContext(
    ctx.restaurantId,
    { serviceItems: updated },
    ctx.client,
    {
      changeOrigin: 'import',
      changedByUserId: ctx.actorUserId ?? null,
      changedVia: 'dual-sync.publish',
      publishJobId: ctx.publishJobId,
    },
  );

  const canonical = config.canonicalizeCoreValue(googleEntry ? [googleEntry] : []);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}
