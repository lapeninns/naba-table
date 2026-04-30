/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Nabatable-side snapshot reader. Composes the existing canonical readers
 * (details, operating hours, service periods, business context) into the
 * `DualSyncCanonicalSnapshot` shape consumed by the registry, capability
 * resolver, and field-state computer.
 *
 * No semantic logic lives here beyond shape adaptation. Every reader is
 * already battle-tested by the legacy and V2 stacks.
 */

import { getRestaurantBusinessContext } from '@/server/restaurants/businessContext';
import { getRestaurantDetails } from '@/server/restaurants/details';
import { getOperatingHours } from '@/server/restaurants/operatingHours';
import { getServicePeriods } from '@/server/restaurants/servicePeriods';

import type {
  DualSyncBusinessContextSectionValues,
  DualSyncCanonicalSnapshot,
  DualSyncOperatingHoursSectionValue,
  DualSyncProfileSectionValue,
  DualSyncServicePeriodsSectionValue,
} from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface ReadNabatableSnapshotInput {
  readonly client: DbClient;
  readonly restaurantId: string;
}

export async function readNabatableSnapshot({
  client,
  restaurantId,
}: ReadNabatableSnapshotInput): Promise<DualSyncCanonicalSnapshot> {
  const [details, hours, periods, context] = await Promise.all([
    getRestaurantDetails(restaurantId, client),
    getOperatingHours(restaurantId, client),
    getServicePeriods(restaurantId, client),
    getRestaurantBusinessContext(restaurantId, client),
  ]);

  return {
    profile: extractProfile(details),
    operatingHours: extractOperatingHours(hours),
    servicePeriods: extractServicePeriods(periods),
    businessContext: extractBusinessContext(context.core),
  };
}

function extractProfile(
  details: Awaited<ReturnType<typeof getRestaurantDetails>>,
): DualSyncProfileSectionValue {
  return {
    name: details.name ?? null,
    businessDescription: details.businessDescription ?? null,
    contactPhone: details.contactPhone ?? null,
    address: details.address ?? null,
    storefrontAddress: null,
    googleMapUrl: details.googleMapUrl ?? null,
    googleReviewUrl: details.googleReviewUrl ?? null,
  };
}

function extractOperatingHours(
  hours: Awaited<ReturnType<typeof getOperatingHours>>,
): DualSyncOperatingHoursSectionValue {
  const weekly = [...hours.weekly]
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
    .map((day) => ({
      dayOfWeek: day.dayOfWeek,
      opensAt: day.opensAt,
      closesAt: day.closesAt,
      isClosed: day.isClosed,
    }));
  return { weekly };
}

function extractServicePeriods(
  periods: Awaited<ReturnType<typeof getServicePeriods>>,
): DualSyncServicePeriodsSectionValue {
  const sorted = [...periods].sort((left, right) => {
    const leftDay = left.dayOfWeek ?? -1;
    const rightDay = right.dayOfWeek ?? -1;
    if (leftDay !== rightDay) return leftDay - rightDay;
    if (left.startTime !== right.startTime) {
      return left.startTime < right.startTime ? -1 : 1;
    }
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
  });
  return {
    periods: sorted.map((period) => ({
      stableKey: stableServicePeriodKey(period),
      name: period.name,
      dayOfWeek: period.dayOfWeek,
      startTime: period.startTime,
      endTime: period.endTime,
      bookingOption: period.bookingOption,
    })),
  };
}

function stableServicePeriodKey(period: {
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: string;
  name: string;
}): string {
  return [
    period.dayOfWeek === null ? 'any' : String(period.dayOfWeek),
    period.startTime,
    period.endTime,
    period.bookingOption,
    period.name.trim().toLowerCase(),
  ].join('|');
}

function extractBusinessContext(
  core: Awaited<ReturnType<typeof getRestaurantBusinessContext>>['core'],
): DualSyncBusinessContextSectionValues {
  return {
    categories: [...core.categories]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((c) => ({
        displayName: c.displayName,
        categoryCode: c.categoryCode,
        moreHoursTypes: c.moreHoursTypes,
        isPrimary: c.isPrimary,
      })),
    serviceAreas: [...core.serviceAreas]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((s) => ({
        displayName: s.displayName,
        areaType: s.areaType,
        regionCode: s.regionCode,
        placeData: s.placeData,
      })),
    attributes: [...core.attributes]
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
    serviceItems: [...core.serviceItems]
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
