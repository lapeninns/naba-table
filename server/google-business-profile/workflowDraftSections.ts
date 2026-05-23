import { normalizeBusinessContextRowsForComparison } from './workflowBusinessContextComparison';
import { summarizeSection } from './workflowDraftState';
import { hashJson, isEqualValue, toJson } from './workflowSerialization';

import type { GoogleBusinessProfileBusinessInfo } from './business-info';
import type { CoreSyncDirection } from './core-sync';
import type {
  GoogleBusinessProfileDraftItem,
  GoogleBusinessProfileDraftSection,
  GoogleBusinessProfileDraftSectionKey,
} from './workflow';
import type { RestaurantBusinessContextSnapshot } from '@/server/restaurants/businessContext';
import type { RestaurantDetails } from '@/server/restaurants/details';
import type { OperatingHoursSnapshot } from '@/server/restaurants/operatingHours';
import type { ServicePeriod } from '@/server/restaurants/servicePeriods';

export type GoogleBusinessProfileWorkflowCoreSnapshots = {
  profile: RestaurantDetails;
  operatingHours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriod[];
  businessContext: RestaurantBusinessContextSnapshot;
};

type DraftItemInput = Omit<
  GoogleBusinessProfileDraftItem,
  | 'status'
  | 'selected'
  | 'normalizedNabatableValue'
  | 'normalizedGoogleValue'
  | 'nabatableValueHash'
  | 'googleValueHash'
  | 'capabilities'
  | 'blockedReasons'
> & {
  comparisonCurrentValue?: unknown;
  comparisonProposedValue?: unknown;
  defaultSelected?: boolean;
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function makeItem(input: DraftItemInput): GoogleBusinessProfileDraftItem {
  const { comparisonCurrentValue, comparisonProposedValue, defaultSelected, ...item } = input;
  const normalizedNabatableValue =
    comparisonCurrentValue === undefined ? item.currentValue : comparisonCurrentValue;
  const normalizedGoogleValue =
    comparisonProposedValue === undefined ? item.providerValue : comparisonProposedValue;
  const changed = !isEqualValue(normalizedNabatableValue, normalizedGoogleValue);
  const blockedReasons = [
    ...(!item.canPublishToNabatable
      ? [`${item.label} cannot be imported from Google automatically.`]
      : []),
    ...(!item.canPushToGoogle ? [`${item.label} cannot be exported to Google automatically.`] : []),
  ];

  return {
    ...item,
    status: changed ? 'ready' : 'unchanged',
    selected: changed && (defaultSelected ?? item.canPublishToNabatable),
    normalizedNabatableValue: toJson(normalizedNabatableValue),
    normalizedGoogleValue: toJson(normalizedGoogleValue),
    nabatableValueHash: hashJson(normalizedNabatableValue),
    googleValueHash: hashJson(normalizedGoogleValue),
    capabilities: {
      canImportFromGoogle: item.canPublishToNabatable,
      canExportToGoogle: item.canPushToGoogle,
      canIgnore: true,
    },
    blockedReasons,
  };
}

function primaryPhone(businessInfo: GoogleBusinessProfileBusinessInfo): string | null {
  return (
    businessInfo.phoneNumbers.find((row) => row.isPrimary)?.phoneNumber ??
    businessInfo.phoneNumbers[0]?.phoneNumber ??
    null
  );
}

function primaryAddress(businessInfo: GoogleBusinessProfileBusinessInfo): string | null {
  return (
    businessInfo.addresses.find((row) => row.isPrimary)?.formattedAddress ??
    businessInfo.addresses[0]?.formattedAddress ??
    null
  );
}

function primaryLink(
  businessInfo: GoogleBusinessProfileBusinessInfo,
  linkType: string,
): string | null {
  return (
    businessInfo.links.find((row) => row.linkType === linkType && row.isPrimary)?.url ??
    businessInfo.links.find((row) => row.linkType === linkType)?.url ??
    null
  );
}

export function buildProfileSection(
  core: GoogleBusinessProfileWorkflowCoreSnapshots,
  businessInfo: GoogleBusinessProfileBusinessInfo,
  externalLocationTitle: string | null,
): GoogleBusinessProfileDraftSection {
  const providerName = normalizeText(externalLocationTitle ?? businessInfo.details?.businessName);
  const providerPhone = primaryPhone(businessInfo);
  const providerAddress = primaryAddress(businessInfo);
  const providerGoogleMapUrl = primaryLink(businessInfo, 'google_map');
  const providerGoogleReviewUrl = primaryLink(businessInfo, 'google_review');
  const items: GoogleBusinessProfileDraftItem[] = [
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.name',
      label: 'Business name',
      currentValue: core.profile.name,
      providerValue: providerName,
      proposedValue: providerName ?? core.profile.name,
      direction: 'pull_from_gbp' as CoreSyncDirection,
      canPublishToNabatable: Boolean(providerName),
      canPushToGoogle: Boolean(core.profile.name?.trim()),
      warnings: [],
    }),
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.contactPhone',
      label: 'Primary phone',
      currentValue: core.profile.contactPhone,
      providerValue: providerPhone,
      proposedValue: providerPhone,
      direction: 'pull_from_gbp' as CoreSyncDirection,
      canPublishToNabatable: true,
      canPushToGoogle: Boolean(core.profile.contactPhone?.trim()),
      defaultSelected: Boolean(providerPhone),
      warnings: [],
    }),
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.address',
      label: 'Address',
      currentValue: core.profile.address,
      providerValue: providerAddress,
      proposedValue: providerAddress,
      direction: 'pull_from_gbp' as CoreSyncDirection,
      canPublishToNabatable: true,
      canPushToGoogle: false,
      defaultSelected: Boolean(providerAddress),
      warnings: ['Address updates to Google are not available here yet.'],
    }),
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.googleMapUrl',
      label: 'Google Maps URL',
      currentValue: core.profile.googleMapUrl,
      providerValue: providerGoogleMapUrl,
      proposedValue: providerGoogleMapUrl,
      direction: 'pull_from_gbp' as CoreSyncDirection,
      canPublishToNabatable: true,
      canPushToGoogle: false,
      defaultSelected: Boolean(providerGoogleMapUrl),
      warnings: ['Google links can be copied into Nabatable but are not sent back to Google.'],
    }),
    makeItem({
      sectionKey: 'profile',
      fieldKey: 'profile.googleReviewUrl',
      label: 'Google review URL',
      currentValue: core.profile.googleReviewUrl,
      providerValue: providerGoogleReviewUrl,
      proposedValue: providerGoogleReviewUrl,
      direction: 'pull_from_gbp' as CoreSyncDirection,
      canPublishToNabatable: true,
      canPushToGoogle: false,
      defaultSelected: Boolean(providerGoogleReviewUrl),
      warnings: ['Google links can be copied into Nabatable but are not sent back to Google.'],
    }),
  ];

  return summarizeSection('profile', 'Profile, contact and links', items);
}

function formatHoursValue(value: {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}) {
  return value.isClosed ? 'Closed' : `${value.opensAt ?? 'Not set'}-${value.closesAt ?? 'Not set'}`;
}

export function buildOperatingHoursSection(
  core: GoogleBusinessProfileWorkflowCoreSnapshots,
  businessInfo: GoogleBusinessProfileBusinessInfo,
): GoogleBusinessProfileDraftSection {
  const normalized = businessInfo.coreNormalization.operatingHours;
  const providerWeekly = new Map(normalized.weekly.map((row) => [row.dayOfWeek, row]));
  const providerOverrides = new Map(normalized.overrides.map((row) => [row.effectiveDate, row]));
  const overrideDates = [
    ...new Set([
      ...core.operatingHours.overrides.map((row) => row.effectiveDate),
      ...normalized.overrides.map((row) => row.effectiveDate),
    ]),
  ].sort();

  const items: GoogleBusinessProfileDraftItem[] = [
    ...core.operatingHours.weekly.map((row) => {
      const provider = providerWeekly.get(row.dayOfWeek);
      return makeItem({
        sectionKey: 'operatingHours',
        fieldKey: `operatingHours.weekly.${row.dayOfWeek}`,
        label: `Weekly day ${row.dayOfWeek}`,
        currentValue: formatHoursValue(row),
        providerValue: provider ? formatHoursValue(provider) : null,
        proposedValue: provider ? formatHoursValue(provider) : formatHoursValue(row),
        comparisonProposedValue: provider ? formatHoursValue(provider) : null,
        direction: 'pull_from_gbp' as CoreSyncDirection,
        canPublishToNabatable: Boolean(provider),
        canPushToGoogle: true,
        warnings: normalized.warnings,
      });
    }),
    ...overrideDates.map((effectiveDate) => {
      const current = core.operatingHours.overrides.find(
        (row) => row.effectiveDate === effectiveDate,
      );
      const provider = providerOverrides.get(effectiveDate);
      return makeItem({
        sectionKey: 'operatingHours',
        fieldKey: `operatingHours.override.${effectiveDate}`,
        label: `Special hours ${effectiveDate}`,
        currentValue: current ? formatHoursValue(current) : null,
        providerValue: provider ? formatHoursValue(provider) : null,
        proposedValue: provider
          ? formatHoursValue(provider)
          : current
            ? formatHoursValue(current)
            : null,
        comparisonProposedValue: provider ? formatHoursValue(provider) : null,
        direction: 'pull_from_gbp' as CoreSyncDirection,
        canPublishToNabatable: Boolean(provider || current),
        canPushToGoogle: true,
        defaultSelected: Boolean(provider),
        warnings: normalized.warnings,
      });
    }),
  ];

  return summarizeSection('operatingHours', 'Operating hours and special hours', items);
}

export function buildServicePeriodsSection(
  core: GoogleBusinessProfileWorkflowCoreSnapshots,
  businessInfo: GoogleBusinessProfileBusinessInfo,
  canPushToGoogle: boolean,
): GoogleBusinessProfileDraftSection {
  const normalized = businessInfo.coreNormalization.servicePeriods;
  const syncableServicePeriodOptions = new Set(['lunch', 'dinner']);
  const servicePeriodKey = (period: {
    dayOfWeek: number | null;
    bookingOption: string;
  }): string | null => {
    if (period.dayOfWeek === null) {
      return null;
    }
    const option = period.bookingOption.trim().toLowerCase();
    if (!syncableServicePeriodOptions.has(option)) {
      return null;
    }
    return `${period.dayOfWeek}:${option}`;
  };
  const formatServicePeriodValue = (period: { name: string; startTime: string; endTime: string }) =>
    `${period.name} ${period.startTime}-${period.endTime}`;
  const coreByDay = new Map(
    core.servicePeriods
      .map((row) => [servicePeriodKey(row), row] as const)
      .filter((entry): entry is [string, (typeof core.servicePeriods)[number]] =>
        Boolean(entry[0]),
      ),
  );
  const providerByDay = new Map(
    normalized.periods
      .map((row) => [servicePeriodKey(row), row] as const)
      .filter((entry): entry is [string, (typeof normalized.periods)[number]] => Boolean(entry[0])),
  );

  const servicePeriodKeys = [...new Set([...coreByDay.keys(), ...providerByDay.keys()])].sort(
    (left, right) => {
      const [leftDay, leftOption] = left.split(':');
      const [rightDay, rightOption] = right.split(':');
      const dayOrder = Number(leftDay) - Number(rightDay);
      return dayOrder === 0 ? leftOption.localeCompare(rightOption) : dayOrder;
    },
  );

  const items = servicePeriodKeys.map((key) => {
    const current = coreByDay.get(key);
    const provider = providerByDay.get(key);
    const [dayPart, option] = key.split(':');
    const providerValue = provider ? formatServicePeriodValue(provider) : null;
    const currentValue = current ? formatServicePeriodValue(current) : null;
    return makeItem({
      sectionKey: 'servicePeriods',
      fieldKey: `servicePeriods.${dayPart}.${option}`,
      label: `${option} day ${dayPart}`,
      currentValue,
      providerValue,
      proposedValue: providerValue ?? currentValue,
      comparisonProposedValue: providerValue,
      direction: 'pull_from_gbp' as CoreSyncDirection,
      canPublishToNabatable: true,
      canPushToGoogle,
      defaultSelected: Boolean(provider),
      warnings: normalized.warnings,
    });
  });

  const section = summarizeSection('servicePeriods', 'Service periods', items);
  if (!canPushToGoogle) {
    section.blockedReasons.push(
      'Google service-period updates are not available for this location.',
    );
  }
  return section;
}

export function buildBusinessContextSection<T>(
  sectionKey: GoogleBusinessProfileDraftSectionKey,
  label: string,
  coreRows: T[],
  providerRows: T[],
  canPushToGoogle: boolean,
  options: {
    canPublishToNabatable?: boolean;
    warnings?: string[];
  } = {},
): GoogleBusinessProfileDraftSection {
  const canPublishToNabatable =
    options.canPublishToNabatable ?? (providerRows.length > 0 || coreRows.length > 0);
  const item = makeItem({
    sectionKey,
    fieldKey: sectionKey,
    label,
    currentValue: toJson(coreRows),
    providerValue: toJson(providerRows),
    proposedValue: toJson(providerRows),
    comparisonCurrentValue: normalizeBusinessContextRowsForComparison(sectionKey, coreRows),
    comparisonProposedValue: normalizeBusinessContextRowsForComparison(sectionKey, providerRows),
    direction: 'pull_from_gbp' as CoreSyncDirection,
    canPublishToNabatable,
    canPushToGoogle,
    defaultSelected: providerRows.length > 0,
    warnings: options.warnings ?? [],
  });

  return summarizeSection(sectionKey, label, [item]);
}

export function buildDraftSections(input: {
  core: GoogleBusinessProfileWorkflowCoreSnapshots;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  externalLocationTitle: string | null;
  canPushServicePeriods: boolean;
}): GoogleBusinessProfileDraftSection[] {
  return [
    buildProfileSection(input.core, input.businessInfo, input.externalLocationTitle),
    buildOperatingHoursSection(input.core, input.businessInfo),
    buildServicePeriodsSection(input.core, input.businessInfo, input.canPushServicePeriods),
    buildBusinessContextSection(
      'businessContext.categories',
      'Categories',
      input.core.businessContext.core.categories,
      input.core.businessContext.providerSnapshot.categories,
      false,
    ),
    buildBusinessContextSection(
      'businessContext.serviceAreas',
      'Service areas',
      input.core.businessContext.core.serviceAreas,
      input.core.businessContext.providerSnapshot.serviceAreas,
      false,
    ),
    buildBusinessContextSection(
      'businessContext.attributes',
      'Attributes',
      input.core.businessContext.core.attributes,
      input.core.businessContext.providerSnapshot.attributes,
      false,
    ),
    buildBusinessContextSection(
      'businessContext.serviceItems',
      'Service items',
      input.core.businessContext.core.serviceItems,
      input.core.businessContext.providerSnapshot.serviceItems,
      false,
    ),
  ];
}
