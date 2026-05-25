import { buildPayloadHash } from './businessInfoNormalization';

import type { Database } from '@/types/supabase';

const GBP_SOURCE = 'gbp';

export type ProviderRowTable =
  | 'restaurant_addresses'
  | 'restaurant_phone_numbers'
  | 'restaurant_links'
  | 'restaurant_categories'
  | 'restaurant_service_areas'
  | 'restaurant_hours'
  | 'restaurant_attributes'
  | 'restaurant_service_items';

export type CanonicalSyncRowsForFieldStatuses = {
  details: Database['public']['Tables']['restaurant_business_details']['Insert'] | null;
  addresses: Array<Database['public']['Tables']['restaurant_addresses']['Insert']>;
  phoneNumbers: Array<Database['public']['Tables']['restaurant_phone_numbers']['Insert']>;
  links: Array<Database['public']['Tables']['restaurant_links']['Insert']>;
  categories: Array<Database['public']['Tables']['restaurant_categories']['Insert']>;
  serviceAreas: Array<Database['public']['Tables']['restaurant_service_areas']['Insert']>;
  hours: Array<Database['public']['Tables']['restaurant_hours']['Insert']>;
  attributes: Array<Database['public']['Tables']['restaurant_attributes']['Insert']>;
  serviceItems: Array<Database['public']['Tables']['restaurant_service_items']['Insert']>;
};

export type FieldSyncStatusInsert =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Insert'];

export function buildFieldStatusLookupKey(
  entityTable: string,
  entityKey: string,
  fieldKey: string,
): string {
  return `${entityTable}::${entityKey}::${fieldKey}`;
}

export function buildEntityKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined ? 'null' : String(part)))
    .join(':');
}

export function getDetailsEntityKey() {
  return 'details';
}

export function getAddressEntityKey(input: { addressType: string; displayOrder: number }) {
  return buildEntityKey(['address', input.addressType, input.displayOrder]);
}

export function getPhoneEntityKey(input: { phoneKind: string; displayOrder: number }) {
  return buildEntityKey(['phone', input.phoneKind, input.displayOrder]);
}

export function getLinkEntityKey(input: { linkType: string; displayOrder: number }) {
  return buildEntityKey(['link', input.linkType, input.displayOrder]);
}

export function getCategoryEntityKey(input: { displayOrder: number }) {
  return buildEntityKey(['category', input.displayOrder]);
}

export function getServiceAreaEntityKey(input: { displayOrder: number }) {
  return buildEntityKey(['service_area', input.displayOrder]);
}

export function getHoursEntityKey(input: { hoursType: string; displayOrder: number }) {
  return buildEntityKey(['hours', input.hoursType, input.displayOrder]);
}

export function getAttributeEntityKey(input: { attributeKey: string }) {
  return buildEntityKey(['attribute', input.attributeKey]);
}

export function getServiceItemEntityKey(input: { itemKey: string }) {
  return buildEntityKey(['service_item', input.itemKey]);
}

export function buildFieldSyncStatus(params: {
  restaurantId: string;
  entityTable: string;
  entityKey: string;
  fieldKey: string;
  providerRecordId: string | null;
  value: unknown;
  syncedAt: string;
}): FieldSyncStatusInsert {
  const normalizedValue = params.value ?? null;

  return {
    restaurant_id: params.restaurantId,
    provider: GBP_SOURCE,
    entity_table: params.entityTable,
    entity_key: params.entityKey,
    field_key: params.fieldKey,
    provider_record_id: params.providerRecordId,
    sync_status: 'synced',
    is_verified: true,
    verified_at: params.syncedAt,
    verified_by: 'gbp_sync',
    last_provider_value_json: normalizedValue as FieldSyncStatusInsert['last_provider_value_json'],
    last_canonical_value_json:
      normalizedValue as FieldSyncStatusInsert['last_canonical_value_json'],
    value_hash: buildPayloadHash(normalizedValue),
    last_synced_at: params.syncedAt,
    last_checked_at: params.syncedAt,
  };
}

export function buildFieldSyncStatuses(input: {
  restaurantId: string;
  rows: CanonicalSyncRowsForFieldStatuses;
  syncedAt: string;
  syncServiceItems?: boolean;
}): FieldSyncStatusInsert[] {
  const statuses: FieldSyncStatusInsert[] = [];
  const pushStatus = (params: {
    entityTable: string;
    entityKey: string;
    fieldKey: string;
    providerRecordId: string | null;
    value: unknown;
  }) => {
    statuses.push(
      buildFieldSyncStatus({
        restaurantId: input.restaurantId,
        syncedAt: input.syncedAt,
        ...params,
      }),
    );
  };

  if (input.rows.details) {
    const details = input.rows.details;
    const entityKey = getDetailsEntityKey();
    pushStatus({
      entityTable: 'restaurant_business_details',
      entityKey,
      fieldKey: 'business_name',
      providerRecordId: details.source_record_id ?? null,
      value: details.business_name,
    });
    pushStatus({
      entityTable: 'restaurant_business_details',
      entityKey,
      fieldKey: 'description',
      providerRecordId: details.source_record_id ?? null,
      value: details.description,
    });
    pushStatus({
      entityTable: 'restaurant_business_details',
      entityKey,
      fieldKey: 'language_code',
      providerRecordId: details.source_record_id ?? null,
      value: details.language_code,
    });
    pushStatus({
      entityTable: 'restaurant_business_details',
      entityKey,
      fieldKey: 'opening_date',
      providerRecordId: details.source_record_id ?? null,
      value: details.opening_date,
    });
    pushStatus({
      entityTable: 'restaurant_business_details',
      entityKey,
      fieldKey: 'business_status',
      providerRecordId: details.source_record_id ?? null,
      value: details.business_status,
    });
    pushStatus({
      entityTable: 'restaurant_business_details',
      entityKey,
      fieldKey: 'is_service_area_business',
      providerRecordId: details.source_record_id ?? null,
      value: details.is_service_area_business,
    });
    pushStatus({
      entityTable: 'restaurant_business_details',
      entityKey,
      fieldKey: 'can_reopen',
      providerRecordId: details.source_record_id ?? null,
      value: details.can_reopen,
    });
  }

  input.rows.addresses.forEach((row) => {
    const entityKey = getAddressEntityKey({
      addressType: row.address_type ?? 'unknown',
      displayOrder: row.display_order ?? 0,
    });
    const providerRecordId = row.source_record_id ?? null;

    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'formatted_address',
      providerRecordId,
      value: row.formatted_address,
    });
    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'address_lines',
      providerRecordId,
      value: row.address_lines,
    });
    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'locality',
      providerRecordId,
      value: row.locality,
    });
    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'administrative_area',
      providerRecordId,
      value: row.administrative_area,
    });
    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'postal_code',
      providerRecordId,
      value: row.postal_code,
    });
    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'region_code',
      providerRecordId,
      value: row.region_code,
    });
    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'country_code',
      providerRecordId,
      value: row.country_code,
    });
    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'latitude',
      providerRecordId,
      value: row.latitude,
    });
    pushStatus({
      entityTable: 'restaurant_addresses',
      entityKey,
      fieldKey: 'longitude',
      providerRecordId,
      value: row.longitude,
    });
  });

  input.rows.phoneNumbers.forEach((row) => {
    const entityKey = getPhoneEntityKey({
      phoneKind: row.phone_kind ?? 'unknown',
      displayOrder: row.display_order ?? 0,
    });
    const providerRecordId = row.source_record_id ?? null;
    pushStatus({
      entityTable: 'restaurant_phone_numbers',
      entityKey,
      fieldKey: 'phone_number',
      providerRecordId,
      value: row.phone_number,
    });
  });

  input.rows.links.forEach((row) => {
    const entityKey = getLinkEntityKey({
      linkType: row.link_type ?? 'unknown',
      displayOrder: row.display_order ?? 0,
    });
    const providerRecordId = row.source_record_id ?? null;
    pushStatus({
      entityTable: 'restaurant_links',
      entityKey,
      fieldKey: 'url',
      providerRecordId,
      value: row.url,
    });
    pushStatus({
      entityTable: 'restaurant_links',
      entityKey,
      fieldKey: 'label',
      providerRecordId,
      value: row.label,
    });
  });

  input.rows.categories.forEach((row) => {
    const entityKey = getCategoryEntityKey({
      displayOrder: row.display_order ?? 0,
    });
    const providerRecordId = row.source_record_id ?? null;
    pushStatus({
      entityTable: 'restaurant_categories',
      entityKey,
      fieldKey: 'display_name',
      providerRecordId,
      value: row.display_name,
    });
    pushStatus({
      entityTable: 'restaurant_categories',
      entityKey,
      fieldKey: 'category_code',
      providerRecordId,
      value: row.category_code,
    });
    pushStatus({
      entityTable: 'restaurant_categories',
      entityKey,
      fieldKey: 'more_hours_types_json',
      providerRecordId,
      value: row.more_hours_types_json,
    });
  });

  input.rows.serviceAreas.forEach((row) => {
    const entityKey = getServiceAreaEntityKey({
      displayOrder: row.display_order ?? 0,
    });
    const providerRecordId = row.source_record_id ?? null;
    pushStatus({
      entityTable: 'restaurant_service_areas',
      entityKey,
      fieldKey: 'display_name',
      providerRecordId,
      value: row.display_name,
    });
    pushStatus({
      entityTable: 'restaurant_service_areas',
      entityKey,
      fieldKey: 'area_type',
      providerRecordId,
      value: row.area_type,
    });
    pushStatus({
      entityTable: 'restaurant_service_areas',
      entityKey,
      fieldKey: 'region_code',
      providerRecordId,
      value: row.region_code,
    });
    pushStatus({
      entityTable: 'restaurant_service_areas',
      entityKey,
      fieldKey: 'place_data_json',
      providerRecordId,
      value: row.place_data_json,
    });
  });

  input.rows.hours.forEach((row) => {
    const entityKey = getHoursEntityKey({
      hoursType: row.hours_type ?? 'unknown',
      displayOrder: row.display_order ?? 0,
    });
    const providerRecordId = row.source_record_id ?? null;
    const fieldValues: Record<string, unknown> = {
      period_code: row.period_code,
      period_label: row.period_label,
      open_day: row.open_day,
      close_day: row.close_day,
      start_date: row.start_date,
      end_date: row.end_date,
      open_time: row.open_time,
      close_time: row.close_time,
      is_closed: row.is_closed,
    };

    for (const [fieldKey, value] of Object.entries(fieldValues)) {
      pushStatus({
        entityTable: 'restaurant_hours',
        entityKey,
        fieldKey,
        providerRecordId,
        value,
      });
    }
  });

  input.rows.attributes.forEach((row) => {
    const entityKey = getAttributeEntityKey({
      attributeKey: row.attribute_key ?? 'unknown',
    });
    const providerRecordId = row.source_record_id ?? null;
    const fieldValues: Record<string, unknown> = {
      attribute_name: row.attribute_name,
      attribute_id: row.attribute_id,
      display_name: row.display_name,
      display_text: row.display_text,
      display_text_standalone: row.display_text_standalone,
      display_text_negative: row.display_text_negative,
      value_type: row.value_type,
      bool_value: row.bool_value,
      text_value: row.text_value,
      uri_value: row.uri_value,
      uri_values: row.uri_values,
      enum_values: row.enum_values,
      unset_enum_values: row.unset_enum_values,
      value_metadata_json: row.value_metadata_json,
      raw_value_json: row.raw_value_json,
      raw_enum_values_json: row.raw_enum_values_json,
      display_value_json: row.display_value_json,
    };

    for (const [fieldKey, value] of Object.entries(fieldValues)) {
      pushStatus({
        entityTable: 'restaurant_attributes',
        entityKey,
        fieldKey,
        providerRecordId,
        value,
      });
    }
  });

  if (input.syncServiceItems !== false) {
    input.rows.serviceItems.forEach((row) => {
      const entityKey = getServiceItemEntityKey({
        itemKey: row.item_key ?? 'unknown',
      });
      const providerRecordId = row.source_record_id ?? null;
      const fieldValues: Record<string, unknown> = {
        item_type: row.item_type,
        display_name: row.display_name,
        description: row.description,
        payload_json: row.payload_json,
      };

      for (const [fieldKey, value] of Object.entries(fieldValues)) {
        pushStatus({
          entityTable: 'restaurant_service_items',
          entityKey,
          fieldKey,
          providerRecordId,
          value,
        });
      }
    });
  }

  return statuses;
}
