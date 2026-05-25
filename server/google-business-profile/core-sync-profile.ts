import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';

import { normalizeComparableText } from './core-sync-time';

import type { GoogleBusinessProfileBusinessInfo } from './business-info';
import type { GoogleBusinessProfileLocationProfile } from './client';
import type { RestaurantDetails, UpdateRestaurantDetailsInput } from '@/server/restaurants/details';

export type CoreSyncDirection = 'pull_from_gbp' | 'push_to_gbp';

export type CoreVerificationStatus = 'verified' | 'drifted' | 'partial' | 'unavailable';

export type ProfileVerificationField =
  | 'name'
  | 'contactPhone'
  | 'address'
  | 'googleMapUrl'
  | 'googleReviewUrl';

export type CoreFieldVerification = {
  field: ProfileVerificationField;
  label: string;
  status: CoreVerificationStatus;
  currentValue: string | null;
  providerValue: string | null;
  canPull: boolean;
  canPush: boolean;
  googleManaged: boolean;
};

export type CoreSectionVerification = {
  status: CoreVerificationStatus;
  summary: string;
  recommendedDirection: CoreSyncDirection | null;
  canPull: boolean;
  canPush: boolean;
  coreUpdatedAt: string | null;
  providerUpdatedAt: string | null;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  warnings: string[];
};

export type ProfileVerificationSummary = CoreSectionVerification & {
  fields: CoreFieldVerification[];
};

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

function compareFieldValue(
  field: ProfileVerificationField,
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
    case 'address': {
      const currentText = normalizeComparableText(currentValue);
      const googleText = normalizeComparableText(providerValue);
      return Boolean(currentText) && currentText === googleText;
    }
    default:
      return false;
  }
}

function normalizeIsoTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function pickLatestTimestamp(
  firstValue: string | null | undefined,
  secondValue: string | null | undefined,
): string | null {
  const firstTime = normalizeIsoTimestamp(firstValue);
  const secondTime = normalizeIsoTimestamp(secondValue);

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

export function pickRecommendedDirection(params: {
  coreUpdatedAt: string | null;
  providerUpdatedAt: string | null;
  canPull: boolean;
  canPush: boolean;
}): CoreSyncDirection | null {
  if (!params.canPull && !params.canPush) {
    return null;
  }
  if (params.canPull && !params.canPush) {
    return 'pull_from_gbp';
  }
  if (params.canPush && !params.canPull) {
    return 'push_to_gbp';
  }

  const coreTime = normalizeIsoTimestamp(params.coreUpdatedAt);
  const providerTime = normalizeIsoTimestamp(params.providerUpdatedAt);

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

function resolveProfileSectionStatus(fields: CoreFieldVerification[]): CoreVerificationStatus {
  const comparable = fields.filter(
    (field) => field.providerValue !== null || field.currentValue !== null,
  );

  if (comparable.length === 0) {
    return 'unavailable';
  }

  if (comparable.every((field) => field.status === 'verified')) {
    return 'verified';
  }

  return 'drifted';
}

export function resolveCoreStatusFromNormalization(
  status: GoogleBusinessProfileBusinessInfo['coreNormalization']['operatingHours']['matchStatus'],
): CoreVerificationStatus {
  switch (status) {
    case 'matched':
      return 'verified';
    case 'drifted':
      return 'drifted';
    case 'partial':
      return 'partial';
    case 'unavailable':
    default:
      return 'unavailable';
  }
}

function getPrimaryAddress(
  businessInfo: GoogleBusinessProfileBusinessInfo,
): GoogleBusinessProfileBusinessInfo['addresses'][number] | null {
  return (
    businessInfo.addresses.find((address) => address.isPrimary) ?? businessInfo.addresses[0] ?? null
  );
}

function getPrimaryPhone(
  businessInfo: GoogleBusinessProfileBusinessInfo,
): GoogleBusinessProfileBusinessInfo['phoneNumbers'][number] | null {
  return (
    businessInfo.phoneNumbers.find((phoneNumber) => phoneNumber.isPrimary) ??
    businessInfo.phoneNumbers[0] ??
    null
  );
}

export function buildProfileVerificationSummary(params: {
  profile: RestaurantDetails;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  externalLocationTitle: string | null;
}): ProfileVerificationSummary {
  const primaryAddress = getPrimaryAddress(params.businessInfo);
  const primaryPhone = getPrimaryPhone(params.businessInfo);
  const googleMapUrl = safeGoogleMapsUrl(
    params.businessInfo.links.find((link) => link.linkType === 'google_map')?.url,
  );
  const googleReviewUrl = safeGoogleReviewUrl(
    params.businessInfo.links.find((link) => link.linkType === 'google_review')?.url,
  );

  const fields: CoreFieldVerification[] = [
    {
      field: 'name',
      label: 'Business name',
      status: compareFieldValue('name', params.profile.name, params.externalLocationTitle)
        ? 'verified'
        : params.externalLocationTitle
          ? 'drifted'
          : 'unavailable',
      currentValue: params.profile.name,
      providerValue: params.externalLocationTitle,
      canPull: Boolean(params.externalLocationTitle),
      canPush: Boolean(params.externalLocationTitle),
      googleManaged: false,
    },
    {
      field: 'contactPhone',
      label: 'Phone number',
      status: compareFieldValue(
        'contactPhone',
        params.profile.contactPhone,
        primaryPhone?.phoneNumber,
      )
        ? 'verified'
        : primaryPhone?.phoneNumber || params.profile.contactPhone
          ? 'drifted'
          : 'unavailable',
      currentValue: params.profile.contactPhone,
      providerValue: primaryPhone?.phoneNumber ?? null,
      canPull: Boolean(primaryPhone?.phoneNumber),
      canPush: Boolean(params.profile.contactPhone),
      googleManaged: false,
    },
    {
      field: 'address',
      label: 'Address',
      status: compareFieldValue('address', params.profile.address, primaryAddress?.formattedAddress)
        ? 'verified'
        : primaryAddress?.formattedAddress || params.profile.address
          ? 'drifted'
          : 'unavailable',
      currentValue: params.profile.address,
      providerValue: primaryAddress?.formattedAddress ?? null,
      canPull: Boolean(primaryAddress?.formattedAddress),
      canPush: false,
      googleManaged: false,
    },
    {
      field: 'googleReviewUrl',
      label: 'Google review URL',
      status: compareFieldValue('googleReviewUrl', params.profile.googleReviewUrl, googleReviewUrl)
        ? 'verified'
        : googleReviewUrl || params.profile.googleReviewUrl
          ? 'drifted'
          : 'unavailable',
      currentValue: params.profile.googleReviewUrl,
      providerValue: googleReviewUrl,
      canPull: Boolean(googleReviewUrl),
      canPush: false,
      googleManaged: true,
    },
    {
      field: 'googleMapUrl',
      label: 'Google Maps URL',
      status: compareFieldValue('googleMapUrl', params.profile.googleMapUrl, googleMapUrl)
        ? 'verified'
        : googleMapUrl || params.profile.googleMapUrl
          ? 'drifted'
          : 'unavailable',
      currentValue: params.profile.googleMapUrl,
      providerValue: googleMapUrl,
      canPull: Boolean(googleMapUrl),
      canPush: false,
      googleManaged: true,
    },
  ];

  const status = resolveProfileSectionStatus(fields);
  const comparableFields = fields.filter((field) => field.status !== 'unavailable');
  const driftedCount = comparableFields.filter((field) => field.status === 'drifted').length;
  const providerUpdatedAt = pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt);
  const canPull = fields.some((field) => field.canPull && field.status !== 'verified');
  const canPush = fields.some((field) => field.canPush && field.status !== 'verified');
  const warnings: string[] = [];

  if (fields.some((field) => field.googleManaged && field.status === 'drifted')) {
    warnings.push(
      'Google Maps and Google Review links are Google-owned and can only be pulled into Nabatable.',
    );
  }
  if (primaryAddress?.formattedAddress || params.profile.address) {
    warnings.push(
      'Address verification compares Nabatable’s flat address string with GBP, but address export stays disabled until Nabatable stores structured postal address fields.',
    );
  }

  const summary =
    status === 'verified'
      ? 'Core restaurant profile fields currently match Google Business Profile.'
      : status === 'drifted'
        ? `${driftedCount} profile field${driftedCount === 1 ? '' : 's'} differ from Google Business Profile.`
        : 'Google Business Profile data is not available for profile verification yet.';

  return {
    status,
    summary,
    recommendedDirection: pickRecommendedDirection({
      coreUpdatedAt: params.profile.updatedAt,
      providerUpdatedAt,
      canPull,
      canPush,
    }),
    canPull,
    canPush,
    coreUpdatedAt: params.profile.updatedAt,
    providerUpdatedAt,
    lastPulledAt: params.lastPulledAt,
    lastPushedAt: params.lastPushedAt,
    warnings,
    fields,
  };
}

export function buildPullProfilePatch(params: {
  businessInfo: GoogleBusinessProfileBusinessInfo;
  externalLocationTitle: string | null;
  fields?: ProfileVerificationField[];
}): Partial<UpdateRestaurantDetailsInput> {
  const requestedFields = new Set<ProfileVerificationField>(
    params.fields && params.fields.length > 0
      ? params.fields
      : ['name', 'contactPhone', 'address', 'googleMapUrl', 'googleReviewUrl'],
  );
  const primaryAddress = getPrimaryAddress(params.businessInfo);
  const primaryPhone = getPrimaryPhone(params.businessInfo);
  const googleMapUrl = safeGoogleMapsUrl(
    params.businessInfo.links.find((link) => link.linkType === 'google_map')?.url,
  );
  const googleReviewUrl = safeGoogleReviewUrl(
    params.businessInfo.links.find((link) => link.linkType === 'google_review')?.url,
  );

  return {
    ...(requestedFields.has('name') && params.externalLocationTitle
      ? { name: params.externalLocationTitle }
      : {}),
    ...(requestedFields.has('contactPhone')
      ? { contactPhone: primaryPhone?.phoneNumber ?? null }
      : {}),
    ...(requestedFields.has('address')
      ? { address: primaryAddress?.formattedAddress ?? null }
      : {}),
    ...(requestedFields.has('googleMapUrl') ? { googleMapUrl } : {}),
    ...(requestedFields.has('googleReviewUrl') ? { googleReviewUrl } : {}),
  };
}

export function buildPushProfileLocationPatch(params: {
  profile: RestaurantDetails;
  location: GoogleBusinessProfileLocationProfile;
  fields?: ProfileVerificationField[];
}): { payload: Record<string, unknown>; updateMask: string[] } {
  const requestedFields = new Set<ProfileVerificationField>(
    params.fields && params.fields.length > 0 ? params.fields : ['name', 'contactPhone'],
  );
  const payload: Record<string, unknown> = {};
  const updateMask: string[] = [];
  const unsupportedSelections: string[] = [];
  const invalidSelections: string[] = [];

  if (requestedFields.has('name') && params.profile.name?.trim()) {
    payload.title = params.profile.name.trim();
    updateMask.push('title');
  } else if (requestedFields.has('name')) {
    invalidSelections.push('business name');
  }

  if (requestedFields.has('contactPhone') && params.profile.contactPhone?.trim()) {
    payload.phoneNumbers = {
      primaryPhone: params.profile.contactPhone.trim(),
      additionalPhones: params.location.phoneNumbers?.additionalPhones ?? [],
    };
    updateMask.push('phoneNumbers');
  } else if (requestedFields.has('contactPhone')) {
    invalidSelections.push('phone number');
  }

  if (requestedFields.has('address')) {
    unsupportedSelections.push('address');
  }

  if (unsupportedSelections.length > 0) {
    throw new Error(
      `Selected GBP export fields are not safely pushable from Nabatable yet: ${unsupportedSelections.join(', ')}.`,
    );
  }

  if (invalidSelections.length > 0) {
    throw new Error(
      `Selected GBP export fields are missing Nabatable values: ${invalidSelections.join(', ')}.`,
    );
  }

  return {
    payload,
    updateMask,
  };
}
