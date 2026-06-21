import { isGbpComparableSection } from './field-key-meta';

import type { DualSyncSectionKey } from '@/server/dual-sync';

export interface DualSyncFieldCompareResult {
  readonly matches: boolean;
  readonly localCanonical: unknown;
  readonly gbpCanonical: unknown;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canonicalizeText(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.replace(/\s+/g, ' ').toLowerCase();
}

function canonicalizePhone(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const comparable = normalized.replace(/[^\d+]/g, '');
  return comparable.length > 0 ? comparable : null;
}

function extractGoogleStableUrlId(parsed: URL): string | null {
  const host = parsed.host.toLowerCase();
  const pathSegments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'maps.app.goo.gl' && pathSegments.length > 0) {
    return `goo:${pathSegments[0].toLowerCase()}`;
  }
  if (host === 'goo.gl' && pathSegments[0] === 'maps' && pathSegments[1]) {
    return `goo:${pathSegments[1].toLowerCase()}`;
  }
  if (host === 'g.page' && pathSegments.length > 0) {
    return `gpage:${pathSegments[0].toLowerCase()}`;
  }

  const cid = parsed.searchParams.get('cid');
  if (cid) return `cid:${cid}`;
  const placeId = parsed.searchParams.get('placeid') ?? parsed.searchParams.get('place_id') ?? null;
  if (placeId) return `placeid:${placeId}`;

  if (
    (host === 'www.google.com' || host === 'google.com' || host === 'maps.google.com') &&
    pathSegments[0] === 'maps' &&
    pathSegments[1] === 'place'
  ) {
    const placeIdLike = pathSegments
      .slice(2)
      .find((segment) => /^(0x[0-9a-f]+:0x[0-9a-f]+|Ch[A-Za-z0-9_-]{15,})$/.test(segment));
    if (placeIdLike) return `placeid:${placeIdLike.toLowerCase()}`;
  }

  return null;
}

function canonicalizeUrl(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    const stableId = extractGoogleStableUrlId(parsed);
    if (stableId) return stableId;
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${normalizedPath}${parsed.search}`;
  } catch {
    return normalized.toLowerCase();
  }
}

function canonicalizeStringArray(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry): entry is string => entry.length > 0)
    .sort();
}

function canonicalizeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

function canonicalizeHours(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const record = value as {
    readonly opensAt?: unknown;
    readonly closesAt?: unknown;
    readonly isClosed?: unknown;
  };
  return {
    opensAt: typeof record.opensAt === 'string' ? record.opensAt : null,
    closesAt: typeof record.closesAt === 'string' ? record.closesAt : null,
    isClosed: Boolean(record.isClosed),
  };
}

function canonicalizeServicePeriod(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const record = value as {
    readonly name?: unknown;
    readonly dayOfWeek?: unknown;
    readonly startTime?: unknown;
    readonly endTime?: unknown;
    readonly bookingOption?: unknown;
  };
  return {
    name: canonicalizeText(record.name) ?? '',
    dayOfWeek: typeof record.dayOfWeek === 'number' ? record.dayOfWeek : null,
    startTime: typeof record.startTime === 'string' ? record.startTime : null,
    endTime: typeof record.endTime === 'string' ? record.endTime : null,
    bookingOption: typeof record.bookingOption === 'string' ? record.bookingOption : null,
  };
}

function canonicalizeCategory(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const record = value as {
    readonly displayName?: unknown;
    readonly categoryCode?: unknown;
    readonly isPrimary?: unknown;
  };
  return {
    displayName: canonicalizeText(record.displayName),
    categoryCode: typeof record.categoryCode === 'string' ? record.categoryCode : null,
    isPrimary: Boolean(record.isPrimary),
  };
}

function canonicalizeServiceArea(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const record = value as {
    readonly displayName?: unknown;
    readonly areaType?: unknown;
    readonly regionCode?: unknown;
    readonly placeData?: unknown;
  };
  return {
    displayName: canonicalizeText(record.displayName),
    areaType: typeof record.areaType === 'string' ? record.areaType : null,
    regionCode: typeof record.regionCode === 'string' ? record.regionCode : null,
    placeData: record.placeData ?? null,
  };
}

function canonicalizeAttribute(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const record = value as {
    readonly attributeKey?: unknown;
    readonly valueType?: unknown;
    readonly boolValue?: unknown;
    readonly textValue?: unknown;
    readonly uriValue?: unknown;
    readonly uriValues?: unknown;
    readonly enumValues?: unknown;
    readonly unsetEnumValues?: unknown;
  };
  return {
    attributeKey: typeof record.attributeKey === 'string' ? record.attributeKey : null,
    valueType: typeof record.valueType === 'string' ? record.valueType : null,
    boolValue: typeof record.boolValue === 'boolean' ? record.boolValue : null,
    textValue: typeof record.textValue === 'string' ? record.textValue : null,
    uriValue: typeof record.uriValue === 'string' ? record.uriValue : null,
    uriValues: canonicalizeStringArray(record.uriValues),
    enumValues: canonicalizeStringArray(record.enumValues),
    unsetEnumValues: canonicalizeStringArray(record.unsetEnumValues),
  };
}

function canonicalizeServiceItem(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const record = value as {
    readonly itemKey?: unknown;
    readonly itemType?: unknown;
    readonly displayName?: unknown;
    readonly description?: unknown;
    readonly payload?: unknown;
  };
  return {
    itemKey: typeof record.itemKey === 'string' ? record.itemKey : null,
    itemType: typeof record.itemType === 'string' ? record.itemType : null,
    displayName: canonicalizeText(record.displayName),
    description: canonicalizeText(record.description),
    payload: record.payload ?? null,
  };
}

function canonicalizeFoodMenuItem(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  const item = value as {
    readonly stableKey?: unknown;
    readonly itemName?: unknown;
    readonly sectionLabel?: unknown;
    readonly description?: unknown;
    readonly basePrice?: unknown;
    readonly currency?: unknown;
    readonly spiceLevel?: unknown;
    readonly preparationMethod?: unknown;
    readonly portionSize?: unknown;
    readonly keyIngredients?: unknown;
    readonly imageUrl?: unknown;
    readonly caloriesKcal?: unknown;
    readonly proteinG?: unknown;
    readonly fatG?: unknown;
    readonly saturatedFatG?: unknown;
    readonly carbsG?: unknown;
    readonly sugarG?: unknown;
    readonly fiberG?: unknown;
    readonly sodiumMg?: unknown;
    readonly servesNum?: unknown;
    readonly dietaryTags?: unknown;
    readonly allergensContains?: unknown;
  };
  return {
    stableKey: typeof item.stableKey === 'string' ? item.stableKey : null,
    itemName: canonicalizeText(item.itemName),
    sectionLabel: canonicalizeText(item.sectionLabel),
    description: canonicalizeText(item.description),
    basePrice: canonicalizeNumber(item.basePrice),
    currency: typeof item.currency === 'string' ? item.currency.trim().toUpperCase() : null,
    spiceLevel: canonicalizeText(item.spiceLevel),
    preparationMethod: canonicalizeText(item.preparationMethod),
    portionSize: canonicalizeText(item.portionSize),
    keyIngredients: canonicalizeStringArray(item.keyIngredients),
    imageUrl: canonicalizeText(item.imageUrl),
    caloriesKcal: canonicalizeNumber(item.caloriesKcal),
    proteinG: canonicalizeNumber(item.proteinG),
    fatG: canonicalizeNumber(item.fatG),
    saturatedFatG: canonicalizeNumber(item.saturatedFatG),
    carbsG: canonicalizeNumber(item.carbsG),
    sugarG: canonicalizeNumber(item.sugarG),
    fiberG: canonicalizeNumber(item.fiberG),
    sodiumMg: canonicalizeNumber(item.sodiumMg),
    servesNum: canonicalizeNumber(item.servesNum),
    dietaryTags: canonicalizeStringArray(item.dietaryTags),
    allergensContains: canonicalizeStringArray(item.allergensContains),
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}

export function canonicalizeDualSyncFieldValue(fieldKey: string, value: unknown): unknown {
  switch (fieldKey) {
    case 'profile.name':
    case 'profile.address':
      return canonicalizeText(value);
    case 'profile.businessDescription':
      return normalizeString(value);
    case 'profile.contactPhone':
      return canonicalizePhone(value);
    case 'profile.googleMapUrl':
    case 'profile.googleReviewUrl':
      return canonicalizeUrl(value);
    default:
      break;
  }

  if (fieldKey.startsWith('operatingHours.weekly.')) return canonicalizeHours(value);
  if (fieldKey.startsWith('servicePeriods.')) return canonicalizeServicePeriod(value);
  if (fieldKey.startsWith('businessContext.categories.')) return canonicalizeCategory(value);
  if (fieldKey.startsWith('businessContext.serviceAreas.')) return canonicalizeServiceArea(value);
  if (fieldKey.startsWith('businessContext.attributes.')) return canonicalizeAttribute(value);
  if (fieldKey.startsWith('businessContext.serviceItems.')) return canonicalizeServiceItem(value);
  if (fieldKey.startsWith('foodMenus.items.')) return canonicalizeFoodMenuItem(value);
  return value ?? null;
}

export function compareCanonical(
  fieldKey: string,
  localValue: unknown,
  gbpValue: unknown,
): DualSyncFieldCompareResult {
  const localCanonical = canonicalizeDualSyncFieldValue(fieldKey, localValue);
  const gbpCanonical = canonicalizeDualSyncFieldValue(fieldKey, gbpValue);
  return {
    matches: stableSerialize(localCanonical) === stableSerialize(gbpCanonical),
    localCanonical,
    gbpCanonical,
  };
}

export function valuesMatch(fieldKey: string, localValue: unknown, gbpValue: unknown): boolean {
  return compareCanonical(fieldKey, localValue, gbpValue).matches;
}

export { isGbpComparableSection };
export type { DualSyncSectionKey };
