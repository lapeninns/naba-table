/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Google-side snapshot reader. Reuses the legacy
 * `readGoogleBusinessProfileBusinessInfo` reader and reduces its output
 * to the `DualSyncCanonicalSnapshot` shape.
 *
 * Day-of-week mapping mirrors the legacy convention (`SUNDAY = 0` ...
 * `SATURDAY = 6`).
 */

import { readGoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';

import type {
  DualSyncBusinessContextSectionValues,
  DualSyncCanonicalSnapshot,
  DualSyncOperatingHoursDay,
  DualSyncOperatingHoursSectionValue,
  DualSyncProfileSectionValue,
  DualSyncServicePeriod,
  DualSyncServicePeriodsSectionValue,
} from './types';
import type { GoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface ReadGoogleSnapshotInput {
  readonly client: DbClient;
  readonly restaurantId: string;
}

export async function readGoogleSnapshot({
  client,
  restaurantId,
}: ReadGoogleSnapshotInput): Promise<DualSyncCanonicalSnapshot> {
  const info = await readGoogleBusinessProfileBusinessInfo(restaurantId, client);
  return {
    profile: extractProfile(info),
    operatingHours: extractOperatingHours(info),
    servicePeriods: extractServicePeriods(info),
    businessContext: extractBusinessContext(info),
  };
}

function pickPrimaryAddress(info: GoogleBusinessProfileBusinessInfo): string | null {
  const addresses = info.addresses ?? [];
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  if (!primary) return null;
  if (primary.formattedAddress) return primary.formattedAddress;
  const parts = [
    primary.addressLines?.join(', ') ?? '',
    primary.locality ?? '',
    primary.administrativeArea ?? '',
    primary.postalCode ?? '',
    primary.countryCode ?? '',
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
}

function pickPrimaryStorefrontAddress(
  info: GoogleBusinessProfileBusinessInfo,
): DualSyncProfileSectionValue['storefrontAddress'] {
  const addresses = info.addresses ?? [];
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  if (!primary) return null;
  return {
    addressLines: [...(primary.addressLines ?? [])],
    locality: primary.locality ?? null,
    administrativeArea: primary.administrativeArea ?? null,
    postalCode: primary.postalCode ?? null,
    regionCode: primary.regionCode ?? primary.countryCode ?? null,
    languageCode: primary.languageCode ?? null,
    sublocality: primary.sublocality ?? null,
    organization: primary.organization ?? null,
    recipients: [...(primary.recipients ?? [])],
  };
}

function pickPrimaryPhone(info: GoogleBusinessProfileBusinessInfo): string | null {
  const phones = info.phoneNumbers ?? [];
  const primary = phones.find((p) => p.isPrimary) ?? phones[0];
  return primary?.phoneNumber ?? null;
}

function normalizeProviderToken(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function pickLink(
  info: GoogleBusinessProfileBusinessInfo,
  linkTypes: ReadonlyArray<string>,
): string | null {
  const links = info.links ?? [];
  const normalizedTypes = new Set(linkTypes.map(normalizeProviderToken));
  const match =
    links.find(
      (l) => normalizedTypes.has(normalizeProviderToken(l.linkType)) && l.isPrimary,
    ) ??
    links.find((l) => normalizedTypes.has(normalizeProviderToken(l.linkType)));
  return match?.url ?? null;
}

function extractProfile(
  info: GoogleBusinessProfileBusinessInfo,
): DualSyncProfileSectionValue {
  return {
    name: info.details?.businessName ?? null,
    businessDescription: info.details?.description ?? null,
    contactPhone: pickPrimaryPhone(info),
    address: pickPrimaryAddress(info),
    storefrontAddress: pickPrimaryStorefrontAddress(info),
    googleMapUrl: pickLink(info, ['google_map', 'GOOGLE_MAPS', 'PLACE_PAGE']),
    googleReviewUrl: pickLink(info, ['google_review', 'NEW_REVIEW', 'REVIEW']),
  };
}

function extractOperatingHours(
  info: GoogleBusinessProfileBusinessInfo,
): DualSyncOperatingHoursSectionValue {
  const weekly: DualSyncOperatingHoursDay[] = info.coreNormalization.operatingHours.weekly.map(
    (entry) => ({
      dayOfWeek: entry.dayOfWeek,
      opensAt: entry.opensAt,
      closesAt: entry.closesAt,
      isClosed: entry.isClosed,
    }),
  );
  return { weekly };
}

function extractServicePeriods(
  info: GoogleBusinessProfileBusinessInfo,
): DualSyncServicePeriodsSectionValue {
  const periods: DualSyncServicePeriod[] = info.coreNormalization.servicePeriods.periods
    .map((entry) => ({
      stableKey: [
        entry.dayOfWeek === null || entry.dayOfWeek === undefined
          ? 'any'
          : String(entry.dayOfWeek),
        entry.startTime,
        entry.endTime,
        entry.bookingOption,
        entry.name.trim().toLowerCase(),
      ].join('|'),
      name: entry.name,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      bookingOption: entry.bookingOption,
    }))
    .sort((left, right) => {
      const leftDay = left.dayOfWeek ?? -1;
      const rightDay = right.dayOfWeek ?? -1;
      if (leftDay !== rightDay) return leftDay - rightDay;
      if (left.startTime !== right.startTime) {
        return left.startTime < right.startTime ? -1 : 1;
      }
      return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
    });
  return { periods };
}

function extractBusinessContext(
  info: GoogleBusinessProfileBusinessInfo,
): DualSyncBusinessContextSectionValues {
  return {
    categories: [...(info.categories ?? [])]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((c) => ({
        displayName: c.displayName,
        categoryCode: c.categoryCode,
        moreHoursTypes: c.moreHoursTypes,
        isPrimary: c.isPrimary,
      })),
    serviceAreas: [...(info.serviceAreas ?? [])]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((s) => ({
        displayName: s.displayName,
        areaType: s.areaType,
        regionCode: s.regionCode,
        placeData: s.placeData,
      })),
    attributes: [...(info.attributes ?? [])]
      .sort((a, b) => a.attributeKey.localeCompare(b.attributeKey))
      .map((a) => ({
        attributeKey: a.attributeKey,
        attributeName: a.attributeName,
        attributeId: a.attributeId,
        valueType: a.valueType,
        boolValue: a.boolValue,
        textValue: a.textValue,
        uriValue: a.uriValue,
        uriValues: [...a.uriValues].sort(),
        enumValues: [...a.enumValues].sort(),
        unsetEnumValues: [...a.unsetEnumValues].sort(),
      })),
    serviceItems: [...(info.serviceItems ?? [])]
      .sort((a, b) => a.itemKey.localeCompare(b.itemKey))
      .map((s) => ({
        itemKey: s.itemKey,
        itemType: s.itemType,
        displayName: s.displayName,
        description: s.description,
        payload: s.payload,
      })),
  };
}
