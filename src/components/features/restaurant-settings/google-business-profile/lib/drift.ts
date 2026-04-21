import { opsHref } from '@/lib/url/opsHref';

import { formatGbpDate, formatGbpDay, formatOperatingWindow, formatServiceWindow } from './formatters';

import type { deriveProfileVerification } from '../googleBusinessProfileVerification';
import type {
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileCoreMatchStatus,
  GoogleBusinessProfileProfileField,
  RestaurantProfile,
} from '@/services/ops/restaurants';

export type DriftRowStatus = 'verified' | 'drift' | 'partial' | 'unavailable';

export type DriftRowGroup = 'profile' | 'hours' | 'overrides' | 'service';

export type DriftRow = {
  id: string;
  group: DriftRowGroup;
  label: string;
  googleValue: string;
  nabatableValue: string;
  status: DriftRowStatus;
  editHref: string | null;
};

export type DriftGroupSummary = {
  id: DriftRowGroup;
  title: string;
  rows: DriftRow[];
  editHref: string | null;
};

export type DriftReport = {
  groups: DriftGroupSummary[];
  totals: {
    drift: number;
    partial: number;
    verified: number;
  };
  warnings: string[];
  hasAnyData: boolean;
};

const PROFILE_LABELS: Record<GoogleBusinessProfileProfileField, string> = {
  name: 'Business name',
  contactPhone: 'Phone',
  address: 'Address',
  googleMapUrl: 'Google Maps URL',
  googleReviewUrl: 'Google review URL',
};

function displayText(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function statusFromProfile(status: 'verified' | 'drifted' | 'partial' | 'unavailable'): DriftRowStatus {
  switch (status) {
    case 'verified':
      return 'verified';
    case 'drifted':
      return 'drift';
    case 'partial':
      return 'partial';
    case 'unavailable':
    default:
      return 'unavailable';
  }
}

function statusFromMatches(value: boolean | null): DriftRowStatus {
  if (value === null) return 'unavailable';
  return value ? 'verified' : 'drift';
}

function buildProfileRows(
  profile: RestaurantProfile | null | undefined,
  verification: ReturnType<typeof deriveProfileVerification>,
): DriftRow[] {
  const currentValues: Record<GoogleBusinessProfileProfileField, string | null> = {
    name: profile?.name ?? null,
    contactPhone: profile?.contactPhone ?? null,
    address: profile?.address ?? null,
    googleMapUrl: profile?.googleMapUrl ?? null,
    googleReviewUrl: profile?.googleReviewUrl ?? null,
  };

  return (Object.keys(PROFILE_LABELS) as GoogleBusinessProfileProfileField[]).map((field) => {
    const entry = verification.fields[field];
    return {
      id: `profile-${field}`,
      group: 'profile' as const,
      label: PROFILE_LABELS[field],
      googleValue: displayText(entry.providerValue, 'Not provided by Google'),
      nabatableValue: displayText(currentValues[field], 'Not set in Nabatable'),
      status: statusFromProfile(entry.status),
      editHref: opsHref('/settings/restaurant/profile'),
    };
  });
}

function buildHoursRows(
  normalization: GoogleBusinessProfileConnection['businessInfo']['coreNormalization']['operatingHours'],
  nabatableByDay: Map<
    number,
    { opensAt: string | null; closesAt: string | null; isClosed: boolean }
  > | null,
): DriftRow[] {
  const editHref = opsHref('/settings/restaurant/operating-hours');
  return normalization.weekly.map((row) => {
    const nabatableRow = nabatableByDay?.get(row.dayOfWeek) ?? null;
    return {
      id: `hours-${row.dayOfWeek}`,
      group: 'hours' as const,
      label: formatGbpDay(row.dayOfWeek) ?? `Day ${row.dayOfWeek}`,
      googleValue: formatOperatingWindow(row),
      nabatableValue: nabatableRow ? formatOperatingWindow(nabatableRow) : '—',
      status: statusFromMatches(row.matchesCore),
      editHref,
    };
  });
}

function buildOverrideRows(
  normalization: GoogleBusinessProfileConnection['businessInfo']['coreNormalization']['operatingHours'],
): DriftRow[] {
  const editHref = opsHref('/settings/restaurant/operating-hours');
  return normalization.overrides.map((row) => ({
    id: `override-${row.effectiveDate}`,
    group: 'overrides' as const,
    label: formatGbpDate(row.effectiveDate) ?? row.effectiveDate,
    googleValue: formatOperatingWindow(row),
    nabatableValue: '—',
    status: statusFromMatches(row.matchesCore),
    editHref,
  }));
}

function buildServiceRows(
  normalization: GoogleBusinessProfileConnection['businessInfo']['coreNormalization']['servicePeriods'],
): DriftRow[] {
  const editHref = opsHref('/settings/restaurant/service-periods');
  return normalization.periods.map((period) => {
    const label = `${formatGbpDay(period.dayOfWeek ?? 0) ?? 'Day'} · ${period.bookingOption === 'lunch' ? 'Lunch' : 'Dinner'}`;
    return {
      id: `service-${period.bookingOption}-${period.dayOfWeek ?? 'all'}-${period.startTime}`,
      group: 'service' as const,
      label,
      googleValue: formatServiceWindow(period) ?? '—',
      nabatableValue: '—',
      status: statusFromMatches(period.matchesCore),
      editHref,
    };
  });
}

export function buildDriftReport(params: {
  profile: RestaurantProfile | null | undefined;
  connection: GoogleBusinessProfileConnection;
  verification: ReturnType<typeof deriveProfileVerification>;
}): DriftReport {
  const { profile, connection, verification } = params;
  const hoursNormalization = connection.businessInfo.coreNormalization.operatingHours;
  const serviceNormalization = connection.businessInfo.coreNormalization.servicePeriods;

  const profileRows = buildProfileRows(profile, verification);
  const hoursRows = buildHoursRows(hoursNormalization, null);
  const overrideRows = buildOverrideRows(hoursNormalization);
  const serviceRows = buildServiceRows(serviceNormalization);

  const groups: DriftGroupSummary[] = [
    {
      id: 'profile',
      title: 'Profile',
      rows: profileRows,
      editHref: opsHref('/settings/restaurant/profile'),
    },
    {
      id: 'hours',
      title: 'Operating hours',
      rows: hoursRows,
      editHref: opsHref('/settings/restaurant/operating-hours'),
    },
  ];

  if (overrideRows.length > 0) {
    groups.push({
      id: 'overrides',
      title: 'Special-date overrides',
      rows: overrideRows,
      editHref: opsHref('/settings/restaurant/operating-hours'),
    });
  }

  groups.push({
    id: 'service',
    title: 'Service periods',
    rows: serviceRows,
    editHref: opsHref('/settings/restaurant/service-periods'),
  });

  const allRows = groups.flatMap((group) => group.rows);
  const totals = allRows.reduce(
    (acc, row) => {
      if (row.status === 'drift') acc.drift += 1;
      else if (row.status === 'partial') acc.partial += 1;
      else if (row.status === 'verified') acc.verified += 1;
      return acc;
    },
    { drift: 0, partial: 0, verified: 0 },
  );

  const warnings = [
    ...verification.warnings,
    ...hoursNormalization.warnings,
    ...serviceNormalization.warnings,
    ...connection.businessInfo.coreNormalization.bookingHours.warnings,
  ];

  const hasAnyData =
    hoursRows.length > 0 ||
    overrideRows.length > 0 ||
    serviceRows.length > 0 ||
    profileRows.some((row) => row.status !== 'unavailable');

  return {
    groups,
    totals,
    warnings,
    hasAnyData,
  };
}

export function overallStatus(totals: DriftReport['totals']): GoogleBusinessProfileCoreMatchStatus {
  if (totals.drift > 0) return 'drifted';
  if (totals.partial > 0) return 'partial';
  if (totals.verified > 0) return 'matched';
  return 'unavailable';
}
