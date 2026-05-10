'use client';

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

export type ProfileFieldVerification = {
  status: CoreVerificationStatus;
  canPull: boolean;
  canPush: boolean;
  providerValue: string | null;
  googleManaged: boolean;
} & ComparisonTooltipDetails;

export type ComparisonTooltipDetails = {
  tooltipTitle: string;
  tooltipLines: string[];
  tooltipFooter: string | null;
};

type ProfileFieldTooltipInput = Pick<
  ProfileFieldVerification,
  'status' | 'canPull' | 'canPush' | 'providerValue' | 'googleManaged'
>;

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

function compareFieldValue(
  field:
    | 'name'
    | 'businessDescription'
    | 'contactPhone'
    | 'address'
    | 'googleMapUrl'
    | 'googleReviewUrl',
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

function latestTimestamp(
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

function recommendedDirection(params: {
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

function getProfileProviderValues(connection: GoogleBusinessProfileConnection) {
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

export function deriveProfileVerification(params: {
  profile: RestaurantProfile | null | undefined;
  connection: GoogleBusinessProfileConnection | null | undefined;
}): VerificationSummary & {
  fields: Record<
    | 'name'
    | 'businessDescription'
    | 'contactPhone'
    | 'address'
    | 'googleMapUrl'
    | 'googleReviewUrl',
    ProfileFieldVerification
  >;
} {
  if (!params.profile || !params.connection || params.connection.status !== 'linked') {
    return {
      status: 'unavailable',
      summary: 'Connect and sync Google Business Profile to verify core profile fields.',
      recommendedDirection: null,
      canPull: false,
      canPush: false,
      warnings: [],
      fields: {
        name: {
          status: 'unavailable',
          canPull: false,
          canPush: false,
          providerValue: null,
          googleManaged: false,
          tooltipTitle: 'Google Business Profile',
          tooltipLines: ['No GBP value is available for this field yet.'],
          tooltipFooter: null,
        },
        businessDescription: {
          status: 'unavailable',
          canPull: false,
          canPush: false,
          providerValue: null,
          googleManaged: false,
          tooltipTitle: 'Google Business Profile',
          tooltipLines: ['No GBP value is available for this field yet.'],
          tooltipFooter: null,
        },
        contactPhone: {
          status: 'unavailable',
          canPull: false,
          canPush: false,
          providerValue: null,
          googleManaged: false,
          tooltipTitle: 'Google Business Profile',
          tooltipLines: ['No GBP value is available for this field yet.'],
          tooltipFooter: null,
        },
        address: {
          status: 'unavailable',
          canPull: false,
          canPush: false,
          providerValue: null,
          googleManaged: false,
          tooltipTitle: 'Google Business Profile',
          tooltipLines: ['No GBP value is available for this field yet.'],
          tooltipFooter: null,
        },
        googleMapUrl: {
          status: 'unavailable',
          canPull: false,
          canPush: false,
          providerValue: null,
          googleManaged: true,
          tooltipTitle: 'Google Business Profile',
          tooltipLines: ['No GBP value is available for this field yet.'],
          tooltipFooter: null,
        },
        googleReviewUrl: {
          status: 'unavailable',
          canPull: false,
          canPush: false,
          providerValue: null,
          googleManaged: true,
          tooltipTitle: 'Google Business Profile',
          tooltipLines: ['No GBP value is available for this field yet.'],
          tooltipFooter: null,
        },
      },
    };
  }

  const providerValues = getProfileProviderValues(params.connection);
  const fields = {
    name: {
      status: compareFieldValue('name', params.profile.name, providerValues.name)
        ? 'verified'
        : providerValues.name
          ? 'drifted'
          : 'unavailable',
      canPull: Boolean(providerValues.name),
      canPush: Boolean(providerValues.name),
      providerValue: providerValues.name,
      googleManaged: false,
      ...buildProfileFieldTooltip('name', {
        status: compareFieldValue('name', params.profile.name, providerValues.name)
          ? 'verified'
          : providerValues.name
            ? 'drifted'
            : 'unavailable',
        canPull: Boolean(providerValues.name),
        canPush: Boolean(providerValues.name),
        providerValue: providerValues.name,
        googleManaged: false,
      }),
    },
    businessDescription: {
      status: compareFieldValue(
        'businessDescription',
        params.profile.businessDescription,
        providerValues.businessDescription,
      )
        ? 'verified'
        : providerValues.businessDescription || params.profile.businessDescription
          ? 'drifted'
          : 'unavailable',
      canPull: Boolean(providerValues.businessDescription),
      canPush: false,
      providerValue: providerValues.businessDescription,
      googleManaged: false,
      ...buildProfileFieldTooltip('description', {
        status: compareFieldValue(
          'businessDescription',
          params.profile.businessDescription,
          providerValues.businessDescription,
        )
          ? 'verified'
          : providerValues.businessDescription || params.profile.businessDescription
            ? 'drifted'
            : 'unavailable',
        canPull: Boolean(providerValues.businessDescription),
        canPush: false,
        providerValue: providerValues.businessDescription,
        googleManaged: false,
      }),
    },
    contactPhone: {
      status: compareFieldValue(
        'contactPhone',
        params.profile.contactPhone,
        providerValues.contactPhone,
      )
        ? 'verified'
        : providerValues.contactPhone || params.profile.contactPhone
          ? 'drifted'
          : 'unavailable',
      canPull: Boolean(providerValues.contactPhone),
      canPush: Boolean(params.profile.contactPhone),
      providerValue: providerValues.contactPhone,
      googleManaged: false,
      ...buildProfileFieldTooltip('phone', {
        status: compareFieldValue(
          'contactPhone',
          params.profile.contactPhone,
          providerValues.contactPhone,
        )
          ? 'verified'
          : providerValues.contactPhone || params.profile.contactPhone
            ? 'drifted'
            : 'unavailable',
        canPull: Boolean(providerValues.contactPhone),
        canPush: Boolean(params.profile.contactPhone),
        providerValue: providerValues.contactPhone,
        googleManaged: false,
      }),
    },
    address: {
      status: compareFieldValue('address', params.profile.address, providerValues.address)
        ? 'verified'
        : providerValues.address || params.profile.address
          ? 'drifted'
          : 'unavailable',
      canPull: Boolean(providerValues.address),
      canPush: false,
      providerValue: providerValues.address,
      googleManaged: false,
      ...buildProfileFieldTooltip('address', {
        status: compareFieldValue('address', params.profile.address, providerValues.address)
          ? 'verified'
          : providerValues.address || params.profile.address
            ? 'drifted'
            : 'unavailable',
        canPull: Boolean(providerValues.address),
        canPush: false,
        providerValue: providerValues.address,
        googleManaged: false,
      }),
    },
    googleMapUrl: {
      status: compareFieldValue(
        'googleMapUrl',
        params.profile.googleMapUrl,
        providerValues.googleMapUrl,
      )
        ? 'verified'
        : providerValues.googleMapUrl || params.profile.googleMapUrl
          ? 'drifted'
          : 'unavailable',
      canPull: Boolean(providerValues.googleMapUrl),
      canPush: false,
      providerValue: providerValues.googleMapUrl,
      googleManaged: true,
      ...buildProfileFieldTooltip('Maps URL', {
        status: compareFieldValue(
          'googleMapUrl',
          params.profile.googleMapUrl,
          providerValues.googleMapUrl,
        )
          ? 'verified'
          : providerValues.googleMapUrl || params.profile.googleMapUrl
            ? 'drifted'
            : 'unavailable',
        canPull: Boolean(providerValues.googleMapUrl),
        canPush: false,
        providerValue: providerValues.googleMapUrl,
        googleManaged: true,
      }),
    },
    googleReviewUrl: {
      status: compareFieldValue(
        'googleReviewUrl',
        params.profile.googleReviewUrl,
        providerValues.googleReviewUrl,
      )
        ? 'verified'
        : providerValues.googleReviewUrl || params.profile.googleReviewUrl
          ? 'drifted'
          : 'unavailable',
      canPull: Boolean(providerValues.googleReviewUrl),
      canPush: false,
      providerValue: providerValues.googleReviewUrl,
      googleManaged: true,
      ...buildProfileFieldTooltip('review URL', {
        status: compareFieldValue(
          'googleReviewUrl',
          params.profile.googleReviewUrl,
          providerValues.googleReviewUrl,
        )
          ? 'verified'
          : providerValues.googleReviewUrl || params.profile.googleReviewUrl
            ? 'drifted'
            : 'unavailable',
        canPull: Boolean(providerValues.googleReviewUrl),
        canPush: false,
        providerValue: providerValues.googleReviewUrl,
        googleManaged: true,
      }),
    },
  } satisfies Record<
    | 'name'
    | 'businessDescription'
    | 'contactPhone'
    | 'address'
    | 'googleMapUrl'
    | 'googleReviewUrl',
    ProfileFieldVerification
  >;

  const comparableFields = Object.values(fields).filter((field) => field.status !== 'unavailable');
  const driftedCount = comparableFields.filter((field) => field.status === 'drifted').length;
  const status =
    comparableFields.length === 0 ? 'unavailable' : driftedCount === 0 ? 'verified' : 'drifted';
  const canPull = Object.values(fields).some(
    (field) => field.canPull && field.status !== 'verified',
  );
  const canPush = Object.values(fields).some(
    (field) => field.canPush && field.status !== 'verified',
  );

  return {
    status,
    summary:
      status === 'verified'
        ? 'Core restaurant profile fields currently match Google Business Profile.'
        : status === 'drifted'
          ? `${driftedCount} profile field${driftedCount === 1 ? '' : 's'} differ from Google Business Profile.`
          : 'Google Business Profile does not currently expose matching profile data for this section.',
    recommendedDirection: recommendedDirection({
      coreUpdatedAt: params.profile.updatedAt,
      providerUpdatedAt: latestTimestamp(
        params.connection.lastPullAt,
        params.connection.lastPushAt,
      ),
      canPull,
      canPush,
    }),
    canPull,
    canPush,
    warnings: Object.values(fields).some(
      (field) => field.googleManaged && field.status === 'drifted',
    )
      ? [
          'Google Maps and Google Review links are Google-owned and can only be pulled into Nabatable.',
          ...(providerValues.address || params.profile.address
            ? [
                'Address verification compares Nabatable’s flat address string with GBP, but address export stays disabled until Nabatable stores structured postal address fields.',
              ]
            : []),
        ]
      : providerValues.address || params.profile.address
        ? [
            'Address verification compares Nabatable’s flat address string with GBP, but address export stays disabled until Nabatable stores structured postal address fields.',
          ]
        : [],
    fields,
  };
}
