import type { CoreSyncDirection } from '@/services/ops/restaurants';

export type ProfileComparableFieldKey =
  | 'name'
  | 'businessDescription'
  | 'contactPhone'
  | 'address'
  | 'googleMapUrl'
  | 'googleReviewUrl';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparablePhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/[^\d+]/g, '');
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparableUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${normalizedPath}${parsed.search}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function compareProfileFieldValue(
  field: ProfileComparableFieldKey,
  currentValue: string | null | undefined,
  providerValue: string | null | undefined,
): boolean {
  switch (field) {
    case 'contactPhone': {
      const currentPhone = normalizeComparablePhone(currentValue);
      const googlePhone = normalizeComparablePhone(providerValue);
      return Boolean(currentPhone) && currentPhone === googlePhone;
    }
    case 'googleMapUrl':
    case 'googleReviewUrl': {
      const currentUrl = normalizeComparableUrl(currentValue);
      const googleUrl = normalizeComparableUrl(providerValue);
      return Boolean(currentUrl) && currentUrl === googleUrl;
    }
    case 'name':
    case 'businessDescription':
    case 'address': {
      const currentText = normalizeComparableText(currentValue);
      const googleText = normalizeComparableText(providerValue);
      return Boolean(currentText) && currentText === googleText;
    }
  }
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function latestTimestamp(
  firstValue: string | null | undefined,
  secondValue: string | null | undefined,
): string | null {
  const firstTime = toTimestamp(firstValue);
  const secondTime = toTimestamp(secondValue);

  if (firstTime === null && secondTime === null) {
    return null;
  }
  if (firstTime === null) {
    return secondValue ?? null;
  }
  if (secondTime === null) {
    return firstValue ?? null;
  }

  return secondTime > firstTime ? (secondValue ?? null) : (firstValue ?? null);
}

export function recommendedDirection(params: {
  coreUpdatedAt: string | null | undefined;
  providerUpdatedAt: string | null | undefined;
  canPull: boolean;
  canPush: boolean;
}): CoreSyncDirection | null {
  if (!params.canPull && !params.canPush) {
    return null;
  }
  if (params.canPull && !params.canPush) {
    return 'pull_from_gbp';
  }
  if (!params.canPull && params.canPush) {
    return 'push_to_gbp';
  }

  const coreTime = toTimestamp(params.coreUpdatedAt);
  const providerTime = toTimestamp(params.providerUpdatedAt);

  if (coreTime !== null && providerTime !== null) {
    return coreTime > providerTime ? 'push_to_gbp' : 'pull_from_gbp';
  }
  if (providerTime !== null) {
    return 'pull_from_gbp';
  }
  if (coreTime !== null) {
    return 'push_to_gbp';
  }

  return 'pull_from_gbp';
}
