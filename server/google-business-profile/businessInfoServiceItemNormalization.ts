import { buildPayloadHash, normalizeText } from './businessInfoNormalizationCore';

import type { GoogleBusinessProfileLocationProfile } from './client';

export function shouldSyncLocationServiceItems(
  location: GoogleBusinessProfileLocationProfile,
): boolean {
  if (location.__nabatableOptionalFetchStatus?.serviceItems === 'unavailable') {
    return false;
  }

  return (
    location.__nabatableOptionalFetchStatus?.serviceItems === 'fetched' ||
    Object.prototype.hasOwnProperty.call(location, 'serviceItems')
  );
}

export function pickServiceItemDisplayName(item: Record<string, unknown>): string | null {
  const directCandidates = [item.displayName, item.name, item.serviceName, item.label, item.title];

  for (const candidate of directCandidates) {
    const normalized = normalizeText(typeof candidate === 'string' ? candidate : null);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function pickServiceItemType(item: Record<string, unknown>): string | null {
  const candidates = [item.type, item.serviceType, item.category, item.kind];

  for (const candidate of candidates) {
    const normalized = normalizeText(typeof candidate === 'string' ? candidate : null);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function pickServiceItemDescription(item: Record<string, unknown>): string | null {
  const candidates = [item.description, item.shortDescription, item.summary];

  for (const candidate of candidates) {
    const normalized = normalizeText(typeof candidate === 'string' ? candidate : null);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function deriveServiceItemKey(item: Record<string, unknown>, index: number): string {
  const candidates = [item.structuredServiceItemId, item.serviceItemId, item.itemId, item.name];

  for (const candidate of candidates) {
    const normalized = normalizeText(typeof candidate === 'string' ? candidate : null);
    if (normalized) {
      return normalized;
    }
  }

  return `service_item_${index}_${buildPayloadHash(item).slice(0, 16)}`;
}
