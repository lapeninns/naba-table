import type {
  GoogleBusinessProfileBusinessDetailsStatus,
  GoogleBusinessProfileFieldDiff,
} from './serviceBusinessDetailsStatusTypes';
import type { GoogleBusinessProfileConnectionState } from './serviceConnectionStateTypes';

export function mapBusinessDetailsConnectionStatus(
  status: GoogleBusinessProfileConnectionState['status'],
): GoogleBusinessProfileBusinessDetailsStatus['connection']['status'] {
  switch (status) {
    case 'pending_auth':
      return 'pending_auth';
    case 'authorized':
    case 'linked':
      return 'connected';
    case 'reauth_required':
      return 'needs_reauth';
    case 'sync_error':
      return 'sync_failed';
    case 'unlinked':
    default:
      return 'not_connected';
  }
}

export function normalizeComparableText(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function buildFieldDiff(params: {
  field: GoogleBusinessProfileFieldDiff['field'];
  label: string;
  localValue: string | null;
  googleValue: string | null;
}): GoogleBusinessProfileFieldDiff {
  const localComparable = normalizeComparableText(params.localValue);
  const googleComparable = normalizeComparableText(params.googleValue);

  if (!localComparable && !googleComparable) {
    return {
      ...params,
      status: 'unavailable',
      suggestion: null,
    };
  }

  if (!googleComparable) {
    return {
      ...params,
      status: 'missing_google',
      suggestion: null,
    };
  }

  if (!localComparable) {
    return {
      ...params,
      status: 'missing_local',
      suggestion: params.googleValue,
    };
  }

  if (localComparable === googleComparable) {
    return {
      ...params,
      status: 'matches',
      suggestion: null,
    };
  }

  return {
    ...params,
    status: 'different',
    suggestion: params.googleValue,
  };
}

export function getPrimaryBusinessInfoValues(state: GoogleBusinessProfileConnectionState) {
  const primaryAddress =
    state.businessInfo.addresses.find((address) => address.isPrimary) ??
    state.businessInfo.addresses[0] ??
    null;
  const primaryPhone =
    state.businessInfo.phoneNumbers.find((phone) => phone.isPrimary) ??
    state.businessInfo.phoneNumbers[0] ??
    null;
  const primaryCategory =
    state.businessInfo.categories.find((category) => category.isPrimary) ??
    state.businessInfo.categories[0] ??
    null;
  const websiteLink = state.businessInfo.links.find((link) => link.linkType === 'website');
  const mapsLink = state.businessInfo.links.find((link) => link.linkType === 'google_map');
  const reviewLink = state.businessInfo.links.find((link) => link.linkType === 'google_review');

  return {
    address: primaryAddress?.formattedAddress ?? null,
    phone: primaryPhone?.phoneNumber ?? null,
    primaryCategory: primaryCategory?.displayName ?? null,
    websiteUri: websiteLink?.url ?? null,
    mapsUri: mapsLink?.url ?? null,
    newReviewUri: reviewLink?.url ?? null,
  };
}

export function buildSelectedLocation(
  state: GoogleBusinessProfileConnectionState,
): GoogleBusinessProfileBusinessDetailsStatus['selectedLocation'] {
  if (!state.externalLocationId && !state.externalLocationName) {
    return null;
  }

  const values = getPrimaryBusinessInfoValues(state);
  return {
    accountId: state.externalAccountId,
    accountName: state.externalAccountName,
    locationId: state.externalLocationId,
    locationName: state.externalLocationName,
    title: state.externalLocationTitle,
    address: values.address,
    phone: values.phone,
    websiteUri: values.websiteUri,
    primaryCategory: values.primaryCategory,
    placeId: state.externalPlaceId,
    mapsUri: values.mapsUri,
    newReviewUri: values.newReviewUri,
  };
}
