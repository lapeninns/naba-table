'use client';

import type {
  CoreSyncDirection,
  GoogleBusinessProfileConnection,
  OperatingHoursSnapshot,
  RestaurantProfile,
  ServicePeriodRow,
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

export type OperatingHoursRowComparison = {
  status: Exclude<CoreVerificationStatus, 'partial'> | 'unavailable';
} & ComparisonTooltipDetails;

export type ServicePeriodDayComparison = {
  status: CoreVerificationStatus;
} & ComparisonTooltipDetails;

type OperatingHoursComparableRow = {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

type ComparableMealWindow = {
  startTime: string;
  endTime: string;
};

type ServicePeriodComparableDay = {
  dayOfWeek: number;
  lunch: ComparableMealWindow | null;
  dinner: ComparableMealWindow | null;
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

function normalizeComparableTime(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

function formatWindow(start: string | null | undefined, end: string | null | undefined): string {
  const normalizedStart = normalizeComparableTime(start);
  const normalizedEnd = normalizeComparableTime(end);

  if (!normalizedStart || !normalizedEnd) {
    return 'Not set';
  }

  return `${normalizedStart} – ${normalizedEnd}`;
}

function formatOperatingHoursSource(
  source: GoogleBusinessProfileConnection['businessInfo']['coreNormalization']['operatingHours']['source'],
): string {
  switch (source) {
    case 'public':
      return 'GBP storefront hours';
    case 'kitchen':
      return 'GBP kitchen hours';
    case 'unavailable':
    default:
      return 'Google Business Profile';
  }
}

function compareOperatingHoursRows(
  current: OperatingHoursComparableRow,
  provider: OperatingHoursComparableRow,
): boolean {
  return (
    normalizeComparableTime(current.opensAt) === normalizeComparableTime(provider.opensAt) &&
    normalizeComparableTime(current.closesAt) === normalizeComparableTime(provider.closesAt) &&
    current.isClosed === provider.isClosed
  );
}

function compareMealWindow(
  current: ComparableMealWindow | null,
  provider: ComparableMealWindow | null,
): boolean {
  if (!current && !provider) {
    return true;
  }
  if (!current || !provider) {
    return false;
  }

  return (
    normalizeComparableTime(current.startTime) === normalizeComparableTime(provider.startTime) &&
    normalizeComparableTime(current.endTime) === normalizeComparableTime(provider.endTime)
  );
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

function detectMealLabel(label: string | null | undefined): 'lunch' | 'dinner' | null {
  const normalized = normalizeComparableText(label);
  if (!normalized) {
    return null;
  }
  if (normalized.includes('lunch')) {
    return 'lunch';
  }
  if (normalized.includes('dinner')) {
    return 'dinner';
  }
  return null;
}

function isKitchenLabel(label: string | null | undefined): boolean {
  const normalized = normalizeComparableText(label);
  return Boolean(normalized && normalized.includes('kitchen'));
}

function inferKitchenSplitWindow(row: {
  openDay: number | null;
  openTime: string | null;
  closeTime: string | null;
}): {
  lunch: ComparableMealWindow;
  dinner: ComparableMealWindow;
} | null {
  if (row.openDay === null) {
    return null;
  }

  const startTime = normalizeComparableTime(row.openTime);
  const endTime = normalizeComparableTime(row.closeTime);
  if (!startTime || !endTime) {
    return null;
  }

  if (startTime >= '17:00' || endTime <= '17:00') {
    return null;
  }

  return {
    lunch: {
      startTime,
      endTime: '17:00',
    },
    dinner: {
      startTime: '17:00',
      endTime,
    },
  };
}

function inferServicePeriodsByDay(connection: GoogleBusinessProfileConnection): Map<
  number,
  {
    lunch: ComparableMealWindow | null;
    dinner: ComparableMealWindow | null;
    partialReason: string | null;
    sourceLines: string[];
  }
> {
  const result = new Map<
    number,
    {
      lunch: ComparableMealWindow | null;
      dinner: ComparableMealWindow | null;
      partialReason: string | null;
      sourceLines: string[];
    }
  >();

  if (connection.status !== 'linked') {
    return result;
  }

  const serviceRows = connection.businessInfo.hours
    .filter((row) => row.hoursType === 'service')
    .filter(
      (row) =>
        row.startDate === null &&
        row.endDate === null &&
        row.openDay !== null &&
        row.closeDay !== null &&
        row.openDay === row.closeDay,
    );

  for (let day = 0; day < 7; day += 1) {
    const dayRows = serviceRows
      .filter((row) => row.openDay === day)
      .sort((left, right) => {
        const leftOpen = normalizeComparableTime(left.openTime) ?? '99:99';
        const rightOpen = normalizeComparableTime(right.openTime) ?? '99:99';
        return leftOpen.localeCompare(rightOpen);
      });

    const explicitLunch = dayRows.filter((row) => detectMealLabel(row.periodLabel) === 'lunch');
    const explicitDinner = dayRows.filter((row) => detectMealLabel(row.periodLabel) === 'dinner');
    const kitchenRows = dayRows.filter((row) => isKitchenLabel(row.periodLabel));
    const sourceLines = dayRows.map((row) => {
      const label = row.periodLabel ? row.periodLabel : 'Service';
      return `${label}: ${formatWindow(row.openTime, row.closeTime)}`;
    });

    const toWindow = (rows: typeof dayRows): ComparableMealWindow | null => {
      if (rows.length === 0) {
        return null;
      }
      const startTimes = rows
        .map((row) => normalizeComparableTime(row.openTime))
        .filter((value): value is string => Boolean(value));
      const endTimes = rows
        .map((row) => normalizeComparableTime(row.closeTime))
        .filter((value): value is string => Boolean(value));

      if (startTimes.length === 0 || endTimes.length === 0) {
        return null;
      }

      return {
        startTime: [...startTimes].sort()[0]!,
        endTime: [...endTimes].sort().at(-1)!,
      };
    };

    let lunch = toWindow(explicitLunch);
    let dinner = toWindow(explicitDinner);
    let partialReason: string | null = null;

    if (!lunch && !dinner && kitchenRows.length > 0) {
      if (kitchenRows.length === 2) {
        lunch = toWindow([kitchenRows[0]!]);
        dinner = toWindow([kitchenRows[1]!]);
      } else if (kitchenRows.length === 1) {
        const inferred = inferKitchenSplitWindow(kitchenRows[0]!);
        if (inferred) {
          lunch = inferred.lunch;
          dinner = inferred.dinner;
          sourceLines.push('Inferred split at 17:00 from a single whole-day kitchen window.');
        } else {
          partialReason =
            'GBP exposes a single kitchen window on this day, so lunch and dinner cannot be inferred safely.';
        }
      } else {
        partialReason = `GBP exposes ${kitchenRows.length} kitchen windows on this day, so lunch and dinner cannot be inferred safely.`;
      }
    }

    result.set(day, {
      lunch,
      dinner,
      partialReason,
      sourceLines,
    });
  }

  return result;
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

function normalizationStatusToCoreStatus(
  status: 'matched' | 'drifted' | 'partial' | 'unavailable',
) {
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

export function deriveOperatingHoursVerification(params: {
  snapshot: OperatingHoursSnapshot | null | undefined;
  connection: GoogleBusinessProfileConnection | null | undefined;
}): VerificationSummary {
  if (!params.snapshot || !params.connection || params.connection.status !== 'linked') {
    return {
      status: 'unavailable',
      summary: 'Connect and sync Google Business Profile to verify operating hours.',
      recommendedDirection: null,
      canPull: false,
      canPush: false,
      warnings: [],
    };
  }

  const normalization = params.connection.businessInfo.coreNormalization.operatingHours;
  return {
    status: normalizationStatusToCoreStatus(normalization.matchStatus),
    summary: normalization.summary,
    recommendedDirection: recommendedDirection({
      coreUpdatedAt: params.snapshot.updatedAt,
      providerUpdatedAt: latestTimestamp(
        params.connection.lastPullAt,
        params.connection.lastPushAt,
      ),
      canPull: normalization.source !== 'unavailable',
      canPush: true,
    }),
    canPull: normalization.source !== 'unavailable',
    canPush: true,
    warnings: normalization.warnings,
  };
}

export function deriveServicePeriodsVerification(params: {
  periods: ServicePeriodRow[] | null | undefined;
  connection: GoogleBusinessProfileConnection | null | undefined;
}): VerificationSummary {
  if (!params.periods || !params.connection || params.connection.status !== 'linked') {
    return {
      status: 'unavailable',
      summary: 'Connect and sync Google Business Profile to verify service periods.',
      recommendedDirection: null,
      canPull: false,
      canPush: false,
      warnings: [],
    };
  }

  const normalization = params.connection.businessInfo.coreNormalization.servicePeriods;
  const periodsUpdatedAt =
    params.periods
      .map((period) => period.updatedAt ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const canPush = params.connection.businessInfo.hours.some((row) => row.hoursType === 'service');

  return {
    status: normalizationStatusToCoreStatus(normalization.matchStatus),
    summary: normalization.summary,
    recommendedDirection: recommendedDirection({
      coreUpdatedAt: periodsUpdatedAt,
      providerUpdatedAt: latestTimestamp(
        params.connection.lastPullAt,
        params.connection.lastPushAt,
      ),
      canPull: normalization.source !== 'unavailable',
      canPush,
    }),
    canPull: normalization.source !== 'unavailable',
    canPush,
    warnings: normalization.warnings,
  };
}

export function deriveOperatingHoursRowComparisons(params: {
  weekly: Array<{
    dayOfWeek: number;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
  }>;
  overrides: Array<{
    effectiveDate: string;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
  }>;
  connection: GoogleBusinessProfileConnection | null | undefined;
}): {
  weeklyByDay: Record<number, OperatingHoursRowComparison>;
  overridesByDate: Record<string, OperatingHoursRowComparison>;
} {
  const weeklyByDay = {} as Record<number, OperatingHoursRowComparison>;
  const overridesByDate = {} as Record<string, OperatingHoursRowComparison>;

  if (!params.connection || params.connection.status !== 'linked') {
    return { weeklyByDay, overridesByDate };
  }

  const normalization = params.connection.businessInfo.coreNormalization.operatingHours;
  if (normalization.source === 'unavailable') {
    return { weeklyByDay, overridesByDate };
  }

  const sourceLabel = formatOperatingHoursSource(normalization.source);
  const providerWeeklyByDay = new Map(
    normalization.weekly.map((row) => [row.dayOfWeek, row] as const),
  );
  const providerOverridesByDate = new Map(
    normalization.overrides.map((row) => [row.effectiveDate, row] as const),
  );

  for (const row of params.weekly) {
    const provider = providerWeeklyByDay.get(row.dayOfWeek);
    if (!provider) {
      continue;
    }

    const providerComparable: OperatingHoursComparableRow = {
      opensAt: provider.opensAt,
      closesAt: provider.closesAt,
      isClosed: provider.isClosed,
    };
    const status = compareOperatingHoursRows(row, providerComparable) ? 'verified' : 'drifted';

    weeklyByDay[row.dayOfWeek] = {
      status,
      tooltipTitle: 'Google Business Profile',
      tooltipLines: provider.isClosed
        ? [`${sourceLabel} mark this day closed.`]
        : [`${sourceLabel}: ${formatWindow(provider.opensAt, provider.closesAt)}`],
      tooltipFooter: buildImportTooltipFooter(status),
    };
  }

  for (const row of params.overrides) {
    const provider = providerOverridesByDate.get(row.effectiveDate);
    if (!provider) {
      overridesByDate[row.effectiveDate] = {
        status: 'drifted',
        tooltipTitle: 'Google Business Profile',
        tooltipLines: ['GBP has no special-hours override for this date.'],
        tooltipFooter: buildImportTooltipFooter('drifted'),
      };
      continue;
    }

    const providerComparable: OperatingHoursComparableRow = {
      opensAt: provider.opensAt,
      closesAt: provider.closesAt,
      isClosed: provider.isClosed,
    };
    const status = compareOperatingHoursRows(row, providerComparable) ? 'verified' : 'drifted';

    overridesByDate[row.effectiveDate] = {
      status,
      tooltipTitle: 'Google Business Profile',
      tooltipLines: provider.isClosed
        ? ['GBP special hours mark this date closed.']
        : [`GBP special hours: ${formatWindow(provider.opensAt, provider.closesAt)}`],
      tooltipFooter: buildImportTooltipFooter(status),
    };
  }

  return { weeklyByDay, overridesByDate };
}

export function deriveServicePeriodDayComparisons(params: {
  days: Array<{
    dayOfWeek: number;
    lunch: { enabled: boolean; startTime: string; endTime: string };
    dinner: { enabled: boolean; startTime: string; endTime: string };
  }>;
  connection: GoogleBusinessProfileConnection | null | undefined;
}): Record<number, ServicePeriodDayComparison> {
  const dayComparisons = {} as Record<number, ServicePeriodDayComparison>;

  if (!params.connection || params.connection.status !== 'linked') {
    return dayComparisons;
  }

  const providerByDay = inferServicePeriodsByDay(params.connection);

  for (const day of params.days) {
    const provider = providerByDay.get(day.dayOfWeek);
    if (!provider || provider.sourceLines.length === 0) {
      continue;
    }

    const currentDay: ServicePeriodComparableDay = {
      dayOfWeek: day.dayOfWeek,
      lunch:
        day.lunch.enabled && day.lunch.startTime && day.lunch.endTime
          ? {
              startTime: day.lunch.startTime,
              endTime: day.lunch.endTime,
            }
          : null,
      dinner:
        day.dinner.enabled && day.dinner.startTime && day.dinner.endTime
          ? {
              startTime: day.dinner.startTime,
              endTime: day.dinner.endTime,
            }
          : null,
    };

    if (provider.partialReason) {
      dayComparisons[day.dayOfWeek] = {
        status: 'partial',
        tooltipTitle: 'Google Business Profile',
        tooltipLines: [...provider.sourceLines, provider.partialReason],
        tooltipFooter: buildImportTooltipFooter('partial'),
      };
      continue;
    }

    const status =
      compareMealWindow(currentDay.lunch, provider.lunch) &&
      compareMealWindow(currentDay.dinner, provider.dinner)
        ? 'verified'
        : 'drifted';

    dayComparisons[day.dayOfWeek] = {
      status,
      tooltipTitle: 'Google Business Profile',
      tooltipLines: [
        `GBP lunch: ${provider.lunch ? formatWindow(provider.lunch.startTime, provider.lunch.endTime) : 'Not set'}`,
        `GBP dinner: ${provider.dinner ? formatWindow(provider.dinner.startTime, provider.dinner.endTime) : 'Not set'}`,
      ],
      tooltipFooter: buildImportTooltipFooter(status),
    };
  }

  return dayComparisons;
}
