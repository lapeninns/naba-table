import type { CanonicalSyncRows } from './businessInfoCanonicalRows';
import type { GoogleBusinessProfileBusinessInfoReadRows } from './businessInfoReadModel';

type ProviderRows = Omit<
  GoogleBusinessProfileBusinessInfoReadRows,
  'fieldSyncStatuses' | 'coreOperatingHours' | 'coreServicePeriods'
>;

// These identities exist only in the response model; provider projections are never persisted.
export function projectSnapshotRows(
  rows: CanonicalSyncRows,
  snapshotId: string,
  at: string,
): ProviderRows {
  const base = (kind: string, index = 0) => ({
    id: `${snapshotId}:${kind}:${index}`,
    created_at: at,
    updated_at: at,
    source: 'gbp',
    managed_by: 'gbp',
    source_record_id: null,
    last_synced_at: at,
    change_origin: null,
    change_reason: null,
    changed_by_user_id: null,
    changed_via: null,
    last_manual_override_at: null,
    display_order: index,
    is_primary: false,
  });
  return {
    details: rows.details
      ? {
          ...base('details'),
          business_name: null,
          business_status: null,
          can_reopen: null,
          description: null,
          is_service_area_business: false,
          language_code: null,
          opening_date: null,
          ...rows.details,
        }
      : null,
    addresses: rows.addresses.map((row, i) => ({
      ...base('address', i),
      address_type: 'storefront',
      address_lines: [],
      administrative_area: null,
      country_code: null,
      formatted_address: null,
      language_code: null,
      latitude: null,
      longitude: null,
      latlng_json: null,
      locality: null,
      organization: null,
      postal_code: null,
      recipients: [],
      region_code: null,
      sorting_code: null,
      sublocality: null,
      ...row,
    })),
    phoneNumbers: rows.phoneNumbers.map((row, i) => ({
      ...base('phone', i),
      ...row,
    })),
    links: rows.links.map((row, i) => ({
      ...base('link', i),
      label: null,
      link_status: 'current',
      ...row,
    })),
    categories: rows.categories.map((row, i) => ({
      ...base('category', i),
      category_code: null,
      more_hours_types_json: [],
      ...row,
    })),
    serviceAreas: rows.serviceAreas.map((row, i) => ({
      ...base('area', i),
      area_type: 'place',
      google_place_id: null,
      google_place_resource_name: null,
      place_data_json: null,
      region_code: null,
      ...row,
    })),
    hours: rows.hours.map((row, i) => ({
      ...base('hours', i),
      close_day: null,
      close_time: null,
      end_date: null,
      is_closed: false,
      open_day: null,
      open_time: null,
      period_code: null,
      period_label: null,
      start_date: null,
      ...row,
    })),
    attributes: rows.attributes.map((row, i) => ({
      ...base('attribute', i),
      attribute_definition_id: null,
      attribute_id: null,
      attribute_name: null,
      attribute_group: null,
      bool_value: null,
      display_name: null,
      display_text_negative: null,
      display_text_standalone: null,
      display_text: null,
      display_value_json: null,
      enum_values: [],
      raw_enum_values_json: null,
      raw_value_json: null,
      text_value: null,
      unset_enum_values: [],
      uri_value: null,
      uri_values: [],
      value_metadata_json: [],
      ...row,
    })),
    serviceItems: rows.serviceItems.map((row, i) => ({
      ...base('service', i),
      description: null,
      display_name: null,
      item_type: null,
      payload_json: null,
      ...row,
    })),
  };
}
