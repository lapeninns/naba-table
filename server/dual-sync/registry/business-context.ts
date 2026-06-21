/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Business-context registry builders for categories, service areas,
 * attributes, and service items. Each entry represents one row in its
 * sub-section. Like service periods, registry entries are computed on the
 * fly from the union of Core and Google rows.
 */

import { canonicalizeStringArray, slugifyDisplay } from './normalizers';
import { withFieldPolicy } from './policy';

import type { DualSyncFieldConfig } from './types';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

interface CategoryValue {
  readonly displayName: string;
  readonly categoryCode: string | null;
  readonly isPrimary: boolean;
  readonly moreHoursTypes: ReadonlyArray<unknown>;
}

function readCategories(value: unknown): ReadonlyArray<CategoryValue> {
  return Array.isArray(value) ? (value as ReadonlyArray<CategoryValue>) : [];
}

function categoryValue(value: unknown, slug: string): CategoryValue | null {
  return readCategories(value).find((entry) => slugifyDisplay(entry.displayName) === slug) ?? null;
}

function canonicalizeCategory(value: unknown, slug: string): unknown {
  const category = categoryValue(value, slug);
  if (!category) return null;
  return {
    displayName: category.displayName.trim().toLowerCase(),
    categoryCode: category.categoryCode,
    isPrimary: Boolean(category.isPrimary),
  };
}

export function buildCategoryFields({
  coreSnapshot,
  gbpSnapshot,
}: {
  readonly coreSnapshot: unknown;
  readonly gbpSnapshot: unknown;
}): ReadonlyArray<DualSyncFieldConfig> {
  const slugs = new Set<string>();
  const sampleByslug = new Map<string, CategoryValue>();
  for (const c of [...readCategories(coreSnapshot), ...readCategories(gbpSnapshot)]) {
    if (!c || typeof c.displayName !== 'string') continue;
    const slug = slugifyDisplay(c.displayName);
    if (!slug) continue;
    if (!slugs.has(slug)) {
      slugs.add(slug);
      sampleByslug.set(slug, c);
    }
  }
  return [...slugs].sort().map((slug, index) => {
    const sample = sampleByslug.get(slug)!;
    return withFieldPolicy({
      fieldKey: `businessContext.categories.${slug}`,
      sectionKey: 'businessContext.categories',
      kind: 'businessContext.category',
      label: sample.displayName,
      helpText: 'Business category. Export requires a Google category code.',
      corePath: `businessContext.categories.${slug}`,
      gbpPath: `businessContext.categories.${slug}`,
      importable: true,
      exportable: true,
      normalizeCoreValue: (value: unknown) => categoryValue(value, slug),
      normalizeGbpValue: (value: unknown) => categoryValue(value, slug),
      canonicalizeCoreValue: (value: unknown) => canonicalizeCategory(value, slug),
      canonicalizeGbpValue: (value: unknown) => canonicalizeCategory(value, slug),
      conflictPolicy: 'manual',
      deletePolicy: 'manual',
      googleUpdateMask: 'categories',
      requiresGoogleCapability: 'categoryCode',
      exportBlockedReason:
        'Category export requires a Google category resource code on the canonical row.',
      sortOrder: index,
    });
  });
}

// ---------------------------------------------------------------------------
// Service areas
// ---------------------------------------------------------------------------

interface ServiceAreaValue {
  readonly displayName: string;
  readonly areaType: string;
  readonly regionCode: string | null;
  readonly placeData: Record<string, unknown> | null;
}

function readServiceAreas(value: unknown): ReadonlyArray<ServiceAreaValue> {
  return Array.isArray(value) ? (value as ReadonlyArray<ServiceAreaValue>) : [];
}

function serviceAreaValue(value: unknown, slug: string): ServiceAreaValue | null {
  return (
    readServiceAreas(value).find((entry) => slugifyDisplay(entry.displayName) === slug) ?? null
  );
}

function canonicalizeServiceArea(value: unknown, slug: string): unknown {
  const area = serviceAreaValue(value, slug);
  if (!area) return null;
  return {
    displayName: area.displayName.trim().toLowerCase(),
    areaType: area.areaType,
    regionCode: area.regionCode,
    placeData: area.placeData ?? null,
  };
}

export function buildServiceAreaFields({
  coreSnapshot,
  gbpSnapshot,
}: {
  readonly coreSnapshot: unknown;
  readonly gbpSnapshot: unknown;
}): ReadonlyArray<DualSyncFieldConfig> {
  const slugs = new Set<string>();
  const sampleByslug = new Map<string, ServiceAreaValue>();
  for (const a of [...readServiceAreas(coreSnapshot), ...readServiceAreas(gbpSnapshot)]) {
    if (!a || typeof a.displayName !== 'string') continue;
    const slug = slugifyDisplay(a.displayName);
    if (!slug) continue;
    if (!slugs.has(slug)) {
      slugs.add(slug);
      sampleByslug.set(slug, a);
    }
  }
  return [...slugs].sort().map((slug, index) => {
    const sample = sampleByslug.get(slug)!;
    return withFieldPolicy({
      fieldKey: `businessContext.serviceAreas.${slug}`,
      sectionKey: 'businessContext.serviceAreas',
      kind: 'businessContext.serviceArea',
      label: sample.displayName,
      helpText: 'Service area. Export requires a region or place payload.',
      corePath: `businessContext.serviceAreas.${slug}`,
      gbpPath: `businessContext.serviceAreas.${slug}`,
      importable: true,
      exportable: true,
      normalizeCoreValue: (value: unknown) => serviceAreaValue(value, slug),
      normalizeGbpValue: (value: unknown) => serviceAreaValue(value, slug),
      canonicalizeCoreValue: (value: unknown) => canonicalizeServiceArea(value, slug),
      canonicalizeGbpValue: (value: unknown) => canonicalizeServiceArea(value, slug),
      conflictPolicy: 'manual',
      deletePolicy: 'manual',
      googleUpdateMask: 'serviceArea',
      exportBlockedReason:
        'Service-area export requires a region or place payload on the canonical row.',
      sortOrder: index,
    });
  });
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

interface AttributeValue {
  readonly attributeKey: string;
  readonly attributeName: string | null;
  readonly attributeId: string | null;
  readonly valueType: string;
  readonly boolValue: boolean | null;
  readonly textValue: string | null;
  readonly uriValue: string | null;
  readonly uriValues: ReadonlyArray<string>;
  readonly enumValues: ReadonlyArray<string>;
  readonly unsetEnumValues: ReadonlyArray<string>;
}

function readAttributes(value: unknown): ReadonlyArray<AttributeValue> {
  return Array.isArray(value) ? (value as ReadonlyArray<AttributeValue>) : [];
}

function attributeValue(value: unknown, attributeKey: string): AttributeValue | null {
  return readAttributes(value).find((entry) => entry?.attributeKey === attributeKey) ?? null;
}

function canonicalizeAttribute(value: unknown, attributeKey: string): unknown {
  const attribute = attributeValue(value, attributeKey);
  if (!attribute) return null;
  return {
    attributeKey: attribute.attributeKey,
    valueType: attribute.valueType,
    boolValue: attribute.boolValue,
    textValue: attribute.textValue,
    uriValue: attribute.uriValue,
    uriValues: canonicalizeStringArray(attribute.uriValues),
    enumValues: canonicalizeStringArray(attribute.enumValues),
    unsetEnumValues: canonicalizeStringArray(attribute.unsetEnumValues),
  };
}

export function buildAttributeFields({
  coreSnapshot,
  gbpSnapshot,
}: {
  readonly coreSnapshot: unknown;
  readonly gbpSnapshot: unknown;
}): ReadonlyArray<DualSyncFieldConfig> {
  const keys = new Set<string>();
  const sampleByKey = new Map<string, AttributeValue>();
  for (const a of [...readAttributes(coreSnapshot), ...readAttributes(gbpSnapshot)]) {
    if (!a || typeof a.attributeKey !== 'string') continue;
    if (!keys.has(a.attributeKey)) {
      keys.add(a.attributeKey);
      sampleByKey.set(a.attributeKey, a);
    }
  }
  return [...keys].sort().map((attributeKey, index) => {
    const sample = sampleByKey.get(attributeKey)!;
    return withFieldPolicy({
      fieldKey: `businessContext.attributes.${attributeKey}`,
      sectionKey: 'businessContext.attributes',
      kind: 'businessContext.attribute',
      label: sample.attributeName?.trim() || attributeKey,
      helpText: 'Google business attribute. Export requires a writable value of the correct type.',
      corePath: `businessContext.attributes.${attributeKey}`,
      gbpPath: `businessContext.attributes.${attributeKey}`,
      importable: true,
      exportable: true,
      normalizeCoreValue: (value: unknown) => attributeValue(value, attributeKey),
      normalizeGbpValue: (value: unknown) => attributeValue(value, attributeKey),
      canonicalizeCoreValue: (value: unknown) => canonicalizeAttribute(value, attributeKey),
      canonicalizeGbpValue: (value: unknown) => canonicalizeAttribute(value, attributeKey),
      conflictPolicy: 'manual',
      deletePolicy: 'manual',
      googleUpdateMask: 'attributes',
      requiresGoogleCapability: 'attributeId',
      exportBlockedReason:
        'Attribute export requires a resolved Google attribute resource name and writable value.',
      sortOrder: index,
    });
  });
}

// ---------------------------------------------------------------------------
// Service items
// ---------------------------------------------------------------------------

interface ServiceItemValue {
  readonly itemKey: string;
  readonly itemType: string | null;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly payload: Record<string, unknown> | null;
}

function readServiceItems(value: unknown): ReadonlyArray<ServiceItemValue> {
  return Array.isArray(value) ? (value as ReadonlyArray<ServiceItemValue>) : [];
}

function serviceItemValue(value: unknown, itemKey: string): ServiceItemValue | null {
  return readServiceItems(value).find((entry) => entry?.itemKey === itemKey) ?? null;
}

function canonicalizeServiceItem(value: unknown, itemKey: string): unknown {
  const item = serviceItemValue(value, itemKey);
  if (!item) return null;
  return {
    itemKey: item.itemKey,
    itemType: item.itemType,
    displayName: item.displayName?.trim().toLowerCase() ?? null,
    description: item.description?.trim().toLowerCase() ?? null,
    payload: item.payload ?? null,
  };
}

export function buildServiceItemFields({
  coreSnapshot,
  gbpSnapshot,
}: {
  readonly coreSnapshot: unknown;
  readonly gbpSnapshot: unknown;
}): ReadonlyArray<DualSyncFieldConfig> {
  const keys = new Set<string>();
  const sampleByKey = new Map<string, ServiceItemValue>();
  for (const s of [...readServiceItems(coreSnapshot), ...readServiceItems(gbpSnapshot)]) {
    if (!s || typeof s.itemKey !== 'string') continue;
    if (!keys.has(s.itemKey)) {
      keys.add(s.itemKey);
      sampleByKey.set(s.itemKey, s);
    }
  }
  return [...keys].sort().map((itemKey, index) => {
    const sample = sampleByKey.get(itemKey)!;
    return withFieldPolicy({
      fieldKey: `businessContext.serviceItems.${itemKey}`,
      sectionKey: 'businessContext.serviceItems',
      kind: 'businessContext.serviceItem',
      label: sample.displayName?.trim() || itemKey,
      helpText:
        'Google business service item. Export requires the original Google service-item payload.',
      corePath: `businessContext.serviceItems.${itemKey}`,
      gbpPath: `businessContext.serviceItems.${itemKey}`,
      importable: true,
      exportable: true,
      normalizeCoreValue: (value: unknown) => serviceItemValue(value, itemKey),
      normalizeGbpValue: (value: unknown) => serviceItemValue(value, itemKey),
      canonicalizeCoreValue: (value: unknown) => canonicalizeServiceItem(value, itemKey),
      canonicalizeGbpValue: (value: unknown) => canonicalizeServiceItem(value, itemKey),
      conflictPolicy: 'manual',
      deletePolicy: 'manual',
      googleUpdateMask: 'serviceItems',
      exportBlockedReason:
        'Service-item export requires the original Google service-item payload on the canonical row.',
      sortOrder: index,
    });
  });
}
