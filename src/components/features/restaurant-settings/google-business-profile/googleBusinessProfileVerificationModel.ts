import {
  compareProfileFieldValue,
  type ProfileComparableFieldKey,
} from './googleBusinessProfileVerificationComparators';

import type {
  CoreSyncDirection,
  GoogleBusinessProfileConnection,
  RestaurantProfile,
} from '@/services/ops/restaurants';

export type CoreVerificationStatus = 'verified' | 'drifted' | 'partial' | 'unavailable';

export type VerificationSummary = {
  status: CoreVerificationStatus;
  summary: string;
  recommendedDirection: CoreSyncDirection | null;
  canPull: boolean;
  canPush: boolean;
  warnings: string[];
};

export type ComparisonTooltipDetails = {
  tooltipTitle: string;
  tooltipLines: string[];
  tooltipFooter: string | null;
};

export type ProfileFieldVerification = {
  status: CoreVerificationStatus;
  canPull: boolean;
  canPush: boolean;
  providerValue: string | null;
  googleManaged: boolean;
} & ComparisonTooltipDetails;

export type ProfileVerificationFieldKey = ProfileComparableFieldKey;

export type ProfileProviderValues = Record<ProfileVerificationFieldKey, string | null>;

export type ProfileVerificationFields = Record<
  ProfileVerificationFieldKey,
  ProfileFieldVerification
>;

type ProfileFieldTooltipInput = Pick<
  ProfileFieldVerification,
  'status' | 'canPull' | 'canPush' | 'providerValue' | 'googleManaged'
>;

function buildImportTooltipFooter(status: CoreVerificationStatus): string | null {
  if (status === 'drifted' || status === 'partial') {
    return 'Use "Sync from GBP" in this section to import the fetched Google Business Profile value into Nabatable.';
  }

  if (status === 'verified') {
    return 'This Nabatable value currently matches the last fetched Google Business Profile value.';
  }

  return null;
}

function buildProfileFieldTooltip(
  fieldLabel: string,
  field: ProfileFieldTooltipInput,
): ComparisonTooltipDetails {
  const tooltipLines = field.providerValue
    ? [`GBP ${fieldLabel}: ${field.providerValue}`]
    : [`GBP ${fieldLabel}: not set`];

  const tooltipFooter = field.googleManaged
    ? field.providerValue
      ? 'Google owns this field, so Nabatable can import it but does not push changes back.'
      : 'Google owns this field. Pulling from GBP will only populate it when Google provides a value.'
    : buildImportTooltipFooter(field.status);

  return {
    tooltipTitle: 'Google Business Profile',
    tooltipLines,
    tooltipFooter,
  };
}

function resolveProfileFieldStatus(params: {
  field: ProfileVerificationFieldKey;
  currentValue: string | null | undefined;
  providerValue: string | null | undefined;
  driftOnCurrentValue: boolean;
}): CoreVerificationStatus {
  if (compareProfileFieldValue(params.field, params.currentValue, params.providerValue)) {
    return 'verified';
  }

  if (params.providerValue || (params.driftOnCurrentValue && params.currentValue)) {
    return 'drifted';
  }

  return 'unavailable';
}

function buildProfileFieldVerification(params: {
  field: ProfileVerificationFieldKey;
  fieldLabel: string;
  currentValue: string | null | undefined;
  providerValue: string | null;
  canPush: boolean;
  googleManaged: boolean;
  driftOnCurrentValue: boolean;
}): ProfileFieldVerification {
  const status = resolveProfileFieldStatus(params);
  const baseField = {
    status,
    canPull: Boolean(params.providerValue),
    canPush: params.canPush,
    providerValue: params.providerValue,
    googleManaged: params.googleManaged,
  };

  return {
    ...baseField,
    ...buildProfileFieldTooltip(params.fieldLabel, baseField),
  };
}

function buildUnavailableProfileField(googleManaged: boolean): ProfileFieldVerification {
  return {
    status: 'unavailable',
    canPull: false,
    canPush: false,
    providerValue: null,
    googleManaged,
    tooltipTitle: 'Google Business Profile',
    tooltipLines: ['No GBP value is available for this field yet.'],
    tooltipFooter: null,
  };
}

export function getProfileProviderValues(
  connection: GoogleBusinessProfileConnection,
): ProfileProviderValues {
  const primaryAddress =
    connection.businessInfo.addresses.find((address) => address.isPrimary) ??
    connection.businessInfo.addresses[0];
  const primaryPhone =
    connection.businessInfo.phoneNumbers.find((phone) => phone.isPrimary) ??
    connection.businessInfo.phoneNumbers[0];
  const googleMapLink = connection.businessInfo.links.find(
    (link) => link.linkType === 'google_map',
  );
  const googleReviewLink = connection.businessInfo.links.find(
    (link) => link.linkType === 'google_review',
  );

  return {
    name: connection.externalLocationTitle ?? connection.externalLocationName ?? null,
    businessDescription: connection.businessInfo.details?.description ?? null,
    contactPhone: primaryPhone?.phoneNumber ?? null,
    address: primaryAddress?.formattedAddress ?? null,
    googleMapUrl: googleMapLink?.url ?? null,
    googleReviewUrl: googleReviewLink?.url ?? null,
  };
}

export function getUnavailableProfileFields(): ProfileVerificationFields {
  return {
    name: buildUnavailableProfileField(false),
    businessDescription: buildUnavailableProfileField(false),
    contactPhone: buildUnavailableProfileField(false),
    address: buildUnavailableProfileField(false),
    googleMapUrl: buildUnavailableProfileField(true),
    googleReviewUrl: buildUnavailableProfileField(true),
  };
}

export function buildProfileVerificationFields(
  profile: RestaurantProfile,
  providerValues: ProfileProviderValues,
): ProfileVerificationFields {
  return {
    name: buildProfileFieldVerification({
      field: 'name',
      fieldLabel: 'name',
      currentValue: profile.name,
      providerValue: providerValues.name,
      canPush: Boolean(providerValues.name),
      googleManaged: false,
      driftOnCurrentValue: false,
    }),
    businessDescription: buildProfileFieldVerification({
      field: 'businessDescription',
      fieldLabel: 'description',
      currentValue: profile.businessDescription,
      providerValue: providerValues.businessDescription,
      canPush: false,
      googleManaged: false,
      driftOnCurrentValue: true,
    }),
    contactPhone: buildProfileFieldVerification({
      field: 'contactPhone',
      fieldLabel: 'phone',
      currentValue: profile.contactPhone,
      providerValue: providerValues.contactPhone,
      canPush: Boolean(profile.contactPhone),
      googleManaged: false,
      driftOnCurrentValue: true,
    }),
    address: buildProfileFieldVerification({
      field: 'address',
      fieldLabel: 'address',
      currentValue: profile.address,
      providerValue: providerValues.address,
      canPush: false,
      googleManaged: false,
      driftOnCurrentValue: true,
    }),
    googleMapUrl: buildProfileFieldVerification({
      field: 'googleMapUrl',
      fieldLabel: 'Maps URL',
      currentValue: profile.googleMapUrl,
      providerValue: providerValues.googleMapUrl,
      canPush: false,
      googleManaged: true,
      driftOnCurrentValue: true,
    }),
    googleReviewUrl: buildProfileFieldVerification({
      field: 'googleReviewUrl',
      fieldLabel: 'review URL',
      currentValue: profile.googleReviewUrl,
      providerValue: providerValues.googleReviewUrl,
      canPush: false,
      googleManaged: true,
      driftOnCurrentValue: true,
    }),
  };
}

export function getProfileVerificationWarnings(
  fields: ProfileVerificationFields,
  providerValues: ProfileProviderValues,
  profile: RestaurantProfile,
): string[] {
  const hasGoogleManagedDrift = Object.values(fields).some(
    (field) => field.googleManaged && field.status === 'drifted',
  );
  const hasAddressValue = Boolean(providerValues.address || profile.address);
  const addressWarning =
    'Address verification compares Nabatable’s flat address string with GBP, but address export stays disabled until Nabatable stores structured postal address fields.';

  if (hasGoogleManagedDrift) {
    return [
      'Google Maps and Google Review links are Google-owned and can only be pulled into Nabatable.',
      ...(hasAddressValue ? [addressWarning] : []),
    ];
  }

  return hasAddressValue ? [addressWarning] : [];
}
