import type { GoogleBusinessProfileBusinessInfo } from './business-info';
import type { GoogleBusinessProfileLocationProfile } from './client';
import type { RestaurantDetails, UpdateRestaurantDetailsInput } from '@/server/restaurants/details';
import type {
  OperatingHoursSnapshot,
  UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';
import type { ServicePeriod, UpdateServicePeriod } from '@/server/restaurants/servicePeriods';

const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

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

export type OperatingHoursSyncSelection = {
  weeklyDays?: number[];
  overrideDates?: string[];
};

export type ServicePeriodsSyncSelection = {
  dayOfWeeks?: number[];
};

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

function pickLatestTimestamp(
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

function pickRecommendedDirection(params: {
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

function resolveCoreStatusFromNormalization(
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

function toGoogleTimeOfDay(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const [hoursToken, minutesToken] = value.slice(0, 5).split(':');
  const hours = Number.parseInt(hoursToken ?? '', 10);
  const minutes = Number.parseInt(minutesToken ?? '', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return undefined;
  }

  return {
    hours,
    minutes,
  };
}

function toGoogleDate(value: string) {
  const [yearToken, monthToken, dayToken] = value.split('-');
  const year = Number.parseInt(yearToken ?? '', 10);
  const month = Number.parseInt(monthToken ?? '', 10);
  const day = Number.parseInt(dayToken ?? '', 10);

  return {
    year,
    month,
    day,
  };
}

function googleDayNameToIndex(value: string | null | undefined): number | null {
  const normalized = normalizeComparableText(value)?.toUpperCase() ?? null;
  if (!normalized) {
    return null;
  }

  const index = DAY_NAMES.indexOf(normalized as (typeof DAY_NAMES)[number]);
  return index >= 0 ? index : null;
}

function formatGoogleDate(
  value: { year?: number; month?: number; day?: number } | null | undefined,
) {
  if (!value) {
    return null;
  }

  const year = Number.isInteger(value.year) ? value.year : null;
  const month = Number.isInteger(value.month) ? value.month : null;
  const day = Number.isInteger(value.day) ? value.day : null;

  if (!year || !month || !day) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeNumericSelection(requested: number[] | undefined, available: number[]): number[] {
  const availableSet = new Set(available);
  const source = requested && requested.length > 0 ? requested : available;
  return [...new Set(source.filter((value) => availableSet.has(value)))].sort(
    (left, right) => left - right,
  );
}

function normalizeDateSelection(requested: string[] | undefined, available: string[]): string[] {
  const availableSet = new Set(available);
  const source = requested && requested.length > 0 ? requested : available;
  return [...new Set(source.filter((value) => availableSet.has(value)))].sort();
}

function ensureSelectionNotEmpty(selected: Array<number | string>, label: string) {
  if (selected.length === 0) {
    throw new Error(`Select at least one ${label} item to sync with Google Business Profile.`);
  }
}

function buildRegularHoursPeriod(dayOfWeek: number, opensAt: string, closesAt: string) {
  const openTime = toGoogleTimeOfDay(opensAt);
  const closeTime = toGoogleTimeOfDay(closesAt);

  if (!openTime || !closeTime) {
    throw new Error(
      'Selected operating-hours rows must include valid open and close times before pushing to Google Business Profile.',
    );
  }

  return {
    openDay: DAY_NAMES[dayOfWeek] ?? 'MONDAY',
    closeDay: DAY_NAMES[dayOfWeek] ?? 'MONDAY',
    openTime,
    closeTime,
  };
}

function buildSpecialHoursPeriod(params: {
  effectiveDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}) {
  const base = {
    startDate: toGoogleDate(params.effectiveDate),
    endDate: toGoogleDate(params.effectiveDate),
  };

  if (params.isClosed) {
    return {
      ...base,
      closed: true,
    };
  }

  const openTime = toGoogleTimeOfDay(params.opensAt);
  const closeTime = toGoogleTimeOfDay(params.closesAt);
  if (!openTime || !closeTime) {
    throw new Error(
      'Selected holiday overrides must include valid open and close times before pushing to Google Business Profile.',
    );
  }

  return {
    ...base,
    openTime,
    closeTime,
    closed: false,
  };
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
  const googleMapLink =
    params.businessInfo.links.find((link) => link.linkType === 'google_map') ?? null;
  const googleReviewLink =
    params.businessInfo.links.find((link) => link.linkType === 'google_review') ?? null;

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
      status: compareFieldValue(
        'googleReviewUrl',
        params.profile.googleReviewUrl,
        googleReviewLink?.url,
      )
        ? 'verified'
        : googleReviewLink?.url || params.profile.googleReviewUrl
          ? 'drifted'
          : 'unavailable',
      currentValue: params.profile.googleReviewUrl,
      providerValue: googleReviewLink?.url ?? null,
      canPull: Boolean(googleReviewLink?.url),
      canPush: false,
      googleManaged: true,
    },
    {
      field: 'googleMapUrl',
      label: 'Google Maps URL',
      status: compareFieldValue('googleMapUrl', params.profile.googleMapUrl, googleMapLink?.url)
        ? 'verified'
        : googleMapLink?.url || params.profile.googleMapUrl
          ? 'drifted'
          : 'unavailable',
      currentValue: params.profile.googleMapUrl,
      providerValue: googleMapLink?.url ?? null,
      canPull: Boolean(googleMapLink?.url),
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

export function buildOperatingHoursVerificationSummary(params: {
  snapshot: OperatingHoursSnapshot;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
}): CoreSectionVerification {
  const normalization = params.businessInfo.coreNormalization.operatingHours;
  const status = resolveCoreStatusFromNormalization(normalization.matchStatus);

  return {
    status,
    summary: normalization.summary,
    recommendedDirection: pickRecommendedDirection({
      coreUpdatedAt: params.snapshot.updatedAt,
      providerUpdatedAt: pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt),
      canPull: normalization.source !== 'unavailable',
      canPush: true,
    }),
    canPull: normalization.source !== 'unavailable',
    canPush: true,
    coreUpdatedAt: params.snapshot.updatedAt,
    providerUpdatedAt: pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt),
    lastPulledAt: params.lastPulledAt,
    lastPushedAt: params.lastPushedAt,
    warnings: normalization.warnings,
  };
}

export function buildServicePeriodsVerificationSummary(params: {
  periodsUpdatedAt: string | null;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  canPush: boolean;
}): CoreSectionVerification {
  const normalization = params.businessInfo.coreNormalization.servicePeriods;
  const status = resolveCoreStatusFromNormalization(normalization.matchStatus);

  return {
    status,
    summary: normalization.summary,
    recommendedDirection: pickRecommendedDirection({
      coreUpdatedAt: params.periodsUpdatedAt,
      providerUpdatedAt: pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt),
      canPull: normalization.source !== 'unavailable',
      canPush: params.canPush,
    }),
    canPull: normalization.source !== 'unavailable',
    canPush: params.canPush,
    coreUpdatedAt: params.periodsUpdatedAt,
    providerUpdatedAt: pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt),
    lastPulledAt: params.lastPulledAt,
    lastPushedAt: params.lastPushedAt,
    warnings: normalization.warnings,
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
  const googleMapLink =
    params.businessInfo.links.find((link) => link.linkType === 'google_map') ?? null;
  const googleReviewLink =
    params.businessInfo.links.find((link) => link.linkType === 'google_review') ?? null;

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
    ...(requestedFields.has('googleMapUrl') ? { googleMapUrl: googleMapLink?.url ?? null } : {}),
    ...(requestedFields.has('googleReviewUrl')
      ? { googleReviewUrl: googleReviewLink?.url ?? null }
      : {}),
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

export function buildPullOperatingHoursPayload(params: {
  currentSnapshot: OperatingHoursSnapshot;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  selection?: OperatingHoursSyncSelection;
}): UpdateOperatingHoursPayload {
  const normalized = params.businessInfo.coreNormalization.operatingHours;
  const availableOverrideDates = [
    ...new Set([
      ...params.currentSnapshot.overrides.map((row) => row.effectiveDate),
      ...normalized.overrides.map((row) => row.effectiveDate),
    ]),
  ].sort();
  const selectedWeeklyDays = normalizeNumericSelection(
    params.selection?.weeklyDays,
    params.currentSnapshot.weekly.map((row) => row.dayOfWeek),
  );
  const selectedOverrideDates = normalizeDateSelection(
    params.selection?.overrideDates,
    availableOverrideDates,
  );
  ensureSelectionNotEmpty([...selectedWeeklyDays, ...selectedOverrideDates], 'operating-hours');

  const currentOverridesByDate = new Map(
    params.currentSnapshot.overrides.map((row) => [row.effectiveDate, row]),
  );
  const selectedWeeklyDaySet = new Set(selectedWeeklyDays);
  const selectedOverrideDateSet = new Set(selectedOverrideDates);
  const providerOverridesByDate = new Map(
    normalized.overrides.map((row) => [row.effectiveDate, row]),
  );

  const weekly = params.currentSnapshot.weekly.map((currentRow) => {
    if (!selectedWeeklyDaySet.has(currentRow.dayOfWeek)) {
      return currentRow;
    }

    const providerRow = normalized.weekly.find((row) => row.dayOfWeek === currentRow.dayOfWeek);
    if (!providerRow) {
      return currentRow;
    }

    return {
      dayOfWeek: providerRow.dayOfWeek,
      opensAt: providerRow.isClosed ? null : providerRow.opensAt,
      closesAt: providerRow.isClosed ? null : providerRow.closesAt,
      isClosed: providerRow.isClosed,
      notes: currentRow.notes ?? null,
      reservationIntervalMinutes: currentRow.reservationIntervalMinutes ?? null,
      reservationSlotTimes: currentRow.reservationSlotTimes ?? null,
    };
  });

  const overrides: UpdateOperatingHoursPayload['overrides'] = params.currentSnapshot.overrides
    .filter((row) => !selectedOverrideDateSet.has(row.effectiveDate))
    .map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      effectiveDate: row.effectiveDate,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      isClosed: row.isClosed,
      notes: row.notes ?? null,
      reservationIntervalMinutes: row.reservationIntervalMinutes ?? null,
      reservationSlotTimes: row.reservationSlotTimes ?? null,
    }));

  for (const effectiveDate of selectedOverrideDates) {
    const providerRow = providerOverridesByDate.get(effectiveDate);
    if (!providerRow) {
      continue;
    }

    const current = currentOverridesByDate.get(effectiveDate);
    overrides.push({
      ...(current?.id ? { id: current.id } : {}),
      effectiveDate: providerRow.effectiveDate,
      opensAt: providerRow.isClosed ? null : providerRow.opensAt,
      closesAt: providerRow.isClosed ? null : providerRow.closesAt,
      isClosed: providerRow.isClosed,
      notes: current?.notes ?? null,
      reservationIntervalMinutes: current?.reservationIntervalMinutes ?? null,
      reservationSlotTimes: current?.reservationSlotTimes ?? null,
    });
  }

  return {
    weekly,
    overrides: overrides.sort((left, right) =>
      left.effectiveDate.localeCompare(right.effectiveDate),
    ),
  };
}

export function buildPushOperatingHoursLocationPatch(params: {
  snapshot: OperatingHoursSnapshot;
  location: GoogleBusinessProfileLocationProfile;
  selection?: OperatingHoursSyncSelection;
}): {
  payload: Record<string, unknown>;
  updateMask: string[];
} {
  const availableOverrideDates = [
    ...new Set([
      ...params.snapshot.overrides.map((row) => row.effectiveDate),
      ...(params.location.specialHours?.specialHourPeriods ?? [])
        .map((row) => formatGoogleDate(row.startDate))
        .filter((value): value is string => Boolean(value)),
    ]),
  ].sort();
  const selectedWeeklyDays = normalizeNumericSelection(
    params.selection?.weeklyDays,
    params.snapshot.weekly.map((row) => row.dayOfWeek),
  );
  const selectedOverrideDates = normalizeDateSelection(
    params.selection?.overrideDates,
    availableOverrideDates,
  );
  ensureSelectionNotEmpty([...selectedWeeklyDays, ...selectedOverrideDates], 'operating-hours');

  const selectedWeeklyDaySet = new Set(selectedWeeklyDays);
  const selectedOverrideDateSet = new Set(selectedOverrideDates);
  const preservedRegularPeriods = (params.location.regularHours?.periods ?? []).filter((period) => {
    const openDay = googleDayNameToIndex(period.openDay);
    const closeDay = googleDayNameToIndex(period.closeDay);
    return !(
      (openDay !== null && selectedWeeklyDaySet.has(openDay)) ||
      (closeDay !== null && selectedWeeklyDaySet.has(closeDay))
    );
  });
  const replacementRegularPeriods = params.snapshot.weekly
    .filter((row) => selectedWeeklyDaySet.has(row.dayOfWeek))
    .filter((row) => !row.isClosed)
    .map((row) => buildRegularHoursPeriod(row.dayOfWeek, row.opensAt ?? '', row.closesAt ?? ''));

  const preservedSpecialHourPeriods = (
    params.location.specialHours?.specialHourPeriods ?? []
  ).filter((row) => {
    const effectiveDate = formatGoogleDate(row.startDate) ?? formatGoogleDate(row.endDate);
    return !effectiveDate || !selectedOverrideDateSet.has(effectiveDate);
  });
  const replacementSpecialHourPeriods = params.snapshot.overrides
    .filter((row) => selectedOverrideDateSet.has(row.effectiveDate))
    .map((row) =>
      buildSpecialHoursPeriod({
        effectiveDate: row.effectiveDate,
        opensAt: row.opensAt,
        closesAt: row.closesAt,
        isClosed: row.isClosed,
      }),
    );

  const payload: Record<string, unknown> = {};
  const updateMask: string[] = [];

  if (selectedWeeklyDaySet.size > 0) {
    payload.regularHours = {
      periods: [...preservedRegularPeriods, ...replacementRegularPeriods],
    };
    updateMask.push('regularHours');
  }

  if (selectedOverrideDateSet.size > 0) {
    payload.specialHours = {
      specialHourPeriods: [...preservedSpecialHourPeriods, ...replacementSpecialHourPeriods],
    };
    updateMask.push('specialHours');
  }

  return {
    payload,
    updateMask,
  };
}

export function buildPullServicePeriodsPayload(params: {
  currentPeriods: ServicePeriod[];
  businessInfo: GoogleBusinessProfileBusinessInfo;
  selection?: ServicePeriodsSyncSelection;
}): UpdateServicePeriod[] {
  const normalizedPeriods = params.businessInfo.coreNormalization.servicePeriods.periods;
  const selectedDayOfWeeks = normalizeNumericSelection(params.selection?.dayOfWeeks, [
    ...new Set(
      params.currentPeriods
        .map((period) => period.dayOfWeek)
        .concat(normalizedPeriods.map((period) => period.dayOfWeek))
        .filter((value): value is number => value !== null),
    ),
  ]);
  ensureSelectionNotEmpty(selectedDayOfWeeks, 'service-period');
  const selectedDaySet = new Set(selectedDayOfWeeks);
  const preserved = params.currentPeriods.filter((period) => {
    const option = period.bookingOption.trim().toLowerCase();
    if (option !== 'lunch' && option !== 'dinner') {
      return true;
    }

    return period.dayOfWeek === null || !selectedDaySet.has(period.dayOfWeek);
  });

  return [
    ...preserved,
    ...normalizedPeriods
      .filter((period) => period.dayOfWeek !== null && selectedDaySet.has(period.dayOfWeek))
      .map<UpdateServicePeriod>((period) => ({
        name: period.name,
        dayOfWeek: period.dayOfWeek,
        startTime: period.startTime,
        endTime: period.endTime,
        bookingOption: period.bookingOption,
      })),
  ];
}

function isKitchenHoursType(hoursTypeId: string | null | undefined): boolean {
  return Boolean(hoursTypeId && normalizeComparableText(hoursTypeId)?.includes('kitchen'));
}

export function canPushServicePeriodsToGoogle(
  location: GoogleBusinessProfileLocationProfile,
): boolean {
  return (
    (location.moreHours ?? []).some((entry) => isKitchenHoursType(entry.hoursTypeId)) ||
    Boolean(
      location.categories?.primaryCategory?.moreHoursTypes?.some((type) =>
        isKitchenHoursType(type.hoursTypeId ?? type.localizedDisplayName ?? type.displayName),
      ),
    )
  );
}

function resolveKitchenHoursTypeId(location: GoogleBusinessProfileLocationProfile): string | null {
  const existing = (location.moreHours ?? []).find((entry) =>
    isKitchenHoursType(entry.hoursTypeId),
  );
  if (existing?.hoursTypeId) {
    return existing.hoursTypeId;
  }

  const categoryType = location.categories?.primaryCategory?.moreHoursTypes?.find((type) =>
    isKitchenHoursType(type.hoursTypeId ?? type.localizedDisplayName ?? type.displayName),
  );

  return categoryType?.hoursTypeId ?? null;
}

export function buildPushServicePeriodsLocationPatch(params: {
  periods: ServicePeriod[];
  location: GoogleBusinessProfileLocationProfile;
  selection?: ServicePeriodsSyncSelection;
}): { payload: Record<string, unknown>; updateMask: string[] } | null {
  const kitchenHoursTypeId = resolveKitchenHoursTypeId(params.location);
  if (!kitchenHoursTypeId) {
    return null;
  }

  const selectedDayOfWeeks = normalizeNumericSelection(params.selection?.dayOfWeeks, [
    ...new Set(
      params.periods
        .map((period) => period.dayOfWeek)
        .concat(
          (params.location.moreHours ?? [])
            .filter((entry) => isKitchenHoursType(entry.hoursTypeId))
            .flatMap((entry) =>
              (entry.periods ?? []).map((period) => googleDayNameToIndex(period.openDay)),
            )
            .filter((value): value is number => value !== null),
        )
        .filter((value): value is number => value !== null),
    ),
  ]);
  ensureSelectionNotEmpty(selectedDayOfWeeks, 'service-period');
  const selectedDaySet = new Set(selectedDayOfWeeks);

  const kitchenPeriods = params.periods
    .filter((period) => {
      const option = period.bookingOption.trim().toLowerCase();
      return (
        (option === 'lunch' || option === 'dinner') &&
        period.dayOfWeek !== null &&
        selectedDaySet.has(period.dayOfWeek)
      );
    })
    .sort((left, right) => {
      const dayOrder = (left.dayOfWeek ?? 99) - (right.dayOfWeek ?? 99);
      if (dayOrder !== 0) {
        return dayOrder;
      }
      return left.startTime.localeCompare(right.startTime);
    })
    .map((period) =>
      buildRegularHoursPeriod(period.dayOfWeek ?? 0, period.startTime, period.endTime),
    );

  const preservedMoreHours = (params.location.moreHours ?? []).filter(
    (entry) => !isKitchenHoursType(entry.hoursTypeId),
  );
  const preservedKitchenPeriods = (params.location.moreHours ?? [])
    .filter((entry) => isKitchenHoursType(entry.hoursTypeId))
    .flatMap((entry) => entry.periods ?? [])
    .filter((period) => {
      const openDay = googleDayNameToIndex(period.openDay);
      const closeDay = googleDayNameToIndex(period.closeDay);
      return !(
        (openDay !== null && selectedDaySet.has(openDay)) ||
        (closeDay !== null && selectedDaySet.has(closeDay))
      );
    });

  return {
    payload: {
      moreHours: [
        ...preservedMoreHours,
        {
          hoursTypeId: kitchenHoursTypeId,
          periods: [...preservedKitchenPeriods, ...kitchenPeriods],
        },
      ],
    },
    updateMask: ['moreHours'],
  };
}
