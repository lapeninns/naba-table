import type { ProfileVerificationField } from './core-sync';

export type ProfileProjectionCleanupTarget = {
  table: 'restaurant_addresses' | 'restaurant_phone_numbers' | 'restaurant_links';
  filters: Record<string, string | boolean>;
  anyOf?: Record<string, string | boolean>;
};

export function profileProjectionCleanupTargets(
  fields: ProfileVerificationField[] | undefined,
): ProfileProjectionCleanupTarget[] {
  const selected = new Set(fields ?? []);
  const targets: ProfileProjectionCleanupTarget[] = [];

  if (selected.has('contactPhone')) {
    targets.push({
      table: 'restaurant_phone_numbers',
      filters: {
        source: 'nabatable',
        managed_by: 'nabatable',
      },
      anyOf: {
        phone_kind: 'primary',
        is_primary: true,
      },
    });
  }

  if (selected.has('address')) {
    targets.push({
      table: 'restaurant_addresses',
      filters: {
        source: 'nabatable',
        managed_by: 'nabatable',
      },
      anyOf: {
        address_type: 'storefront',
        is_primary: true,
      },
    });
  }

  if (selected.has('googleMapUrl')) {
    targets.push({
      table: 'restaurant_links',
      filters: {
        source: 'nabatable',
        managed_by: 'nabatable',
        link_type: 'google_map',
        link_status: 'current',
      },
    });
  }

  if (selected.has('googleReviewUrl')) {
    targets.push({
      table: 'restaurant_links',
      filters: {
        source: 'nabatable',
        managed_by: 'nabatable',
        link_type: 'google_review',
        link_status: 'current',
      },
    });
  }

  return targets;
}

export function serializeOrFilters(filters: Record<string, string | boolean>): string {
  return Object.entries(filters)
    .map(([key, value]) => `${key}.eq.${String(value)}`)
    .join(',');
}
