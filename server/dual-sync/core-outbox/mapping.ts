import type { CoreOutboxEntry } from './types';

const WEEKLY_HOURS_KEYS = Array.from(
  { length: 7 },
  (_, dayOfWeek) => `operatingHours.weekly.${dayOfWeek}`,
);

const PROFILE_COLUMN_KEYS = new Map<string, string>([
  ['name', 'profile.name'],
  ['contact_phone', 'profile.contactPhone'],
  ['address', 'profile.address'],
  ['google_map_url', 'profile.googleMapUrl'],
  ['google_review_url', 'profile.googleReviewUrl'],
]);

const TABLE_FIELD_KEYS = {
  restaurant_business_details: ['profile.businessDescription'],
  restaurant_addresses: ['profile.address'],
  restaurant_phone_numbers: ['profile.contactPhone'],
  restaurant_links: ['profile.googleMapUrl', 'profile.googleReviewUrl'],
  restaurant_categories: ['businessContext.categories.*'],
  restaurant_service_areas: ['businessContext.serviceAreas.*'],
  restaurant_hours: [...WEEKLY_HOURS_KEYS, 'servicePeriods.*'],
  restaurant_attributes: ['businessContext.attributes.*'],
  restaurant_service_items: ['businessContext.serviceItems.*'],
  restaurants: [],
  restaurant_operating_hours: [],
  restaurant_service_periods: [],
} as const satisfies Record<CoreOutboxEntry['sourceTable'], readonly string[]>;

export function fieldKeysForCoreOutboxEntry(entry: CoreOutboxEntry): readonly string[] {
  if (entry.sourceTable === 'restaurants') {
    return entry.changedColumns
      .flatMap((column) => {
        const fieldKey = PROFILE_COLUMN_KEYS.get(column);
        return fieldKey === undefined ? [] : [fieldKey];
      })
      .sort();
  }
  if (entry.sourceTable === 'restaurant_operating_hours') {
    return entry.changedColumns
      .flatMap((column) => {
        const match = /^weekly_([0-6])$/.exec(column);
        return match?.[1] === undefined ? [] : [`operatingHours.weekly.${match[1]}`];
      })
      .sort();
  }
  if (entry.sourceTable === 'restaurant_service_periods') {
    return entry.changedColumns.includes('service_periods') ? ['servicePeriods.*'] : [];
  }
  return TABLE_FIELD_KEYS[entry.sourceTable];
}

export function expandOutboxFieldKeys(
  requestedKeys: readonly string[],
  registryKeys: readonly string[],
): readonly string[] {
  const selected = new Set<string>();
  for (const requestedKey of requestedKeys) {
    if (requestedKey.endsWith('.*')) {
      const prefix = requestedKey.slice(0, -1);
      for (const registryKey of registryKeys) {
        if (registryKey.startsWith(prefix)) selected.add(registryKey);
      }
    } else if (registryKeys.includes(requestedKey)) {
      selected.add(requestedKey);
    }
  }
  return [...selected].sort();
}
