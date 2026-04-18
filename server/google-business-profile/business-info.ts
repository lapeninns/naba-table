import { createHash } from 'node:crypto';

import {
  buildGoogleBusinessProfileCoreNormalization,
  type GoogleBusinessProfileCoreNormalization,
} from './core-normalization';

import type {
  GoogleBusinessProfileAttributesResponse,
  GoogleBusinessProfileLocationProfile,
} from './client';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type ExternalProfileRow = Database['public']['Tables']['restaurant_external_profiles']['Row'];

const GBP_SOURCE = 'gbp';
const GBP_MANAGED_BY = 'gbp';

const DAY_NUMBERS: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

type RestaurantBusinessDetailsRow =
  Database['public']['Tables']['restaurant_business_details']['Row'];
type RestaurantAddressRow = Database['public']['Tables']['restaurant_addresses']['Row'];
type RestaurantPhoneNumberRow = Database['public']['Tables']['restaurant_phone_numbers']['Row'];
type RestaurantLinkRow = Database['public']['Tables']['restaurant_links']['Row'];
type RestaurantCategoryRow = Database['public']['Tables']['restaurant_categories']['Row'];
type RestaurantServiceAreaRow = Database['public']['Tables']['restaurant_service_areas']['Row'];
type RestaurantHourRow = Database['public']['Tables']['restaurant_hours']['Row'];
type RestaurantAttributeRow = Database['public']['Tables']['restaurant_attributes']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];
type RestaurantOperatingHoursRow =
  Database['public']['Tables']['restaurant_operating_hours']['Row'];
type RestaurantServicePeriodRow = Database['public']['Tables']['restaurant_service_periods']['Row'];
type ProviderRowTable =
  | 'restaurant_addresses'
  | 'restaurant_phone_numbers'
  | 'restaurant_links'
  | 'restaurant_categories'
  | 'restaurant_service_areas'
  | 'restaurant_hours'
  | 'restaurant_attributes';
type ProviderRowMutationBuilder<TTable extends ProviderRowTable> = {
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
    };
  };
  insert: (
    rows: Database['public']['Tables'][TTable]['Insert'][],
  ) => PromiseLike<{ error: unknown }>;
};

export type GoogleBusinessProfileFieldVerification = {
  provider: string;
  syncStatus: string;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  lastSyncedAt: string | null;
  lastCheckedAt: string | null;
};

export type GoogleBusinessProfileBusinessInfo = {
  details: {
    description: string | null;
    openingDate: string | null;
    businessStatus: string | null;
    isServiceAreaBusiness: boolean;
    source: string;
    managedBy: string;
    lastSyncedAt: string | null;
    verification?: {
      description: GoogleBusinessProfileFieldVerification | null;
      openingDate: GoogleBusinessProfileFieldVerification | null;
      businessStatus: GoogleBusinessProfileFieldVerification | null;
      isServiceAreaBusiness: GoogleBusinessProfileFieldVerification | null;
    };
  } | null;
  addresses: Array<{
    id: string;
    addressType: string;
    formattedAddress: string | null;
    addressLines: string[];
    locality: string | null;
    administrativeArea: string | null;
    postalCode: string | null;
    regionCode: string | null;
    countryCode: string | null;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  phoneNumbers: Array<{
    id: string;
    phoneKind: string;
    phoneNumber: string;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  links: Array<{
    id: string;
    linkType: string;
    linkStatus: string;
    label: string | null;
    url: string;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  categories: Array<{
    id: string;
    displayName: string;
    categoryCode: string | null;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  serviceAreas: Array<{
    id: string;
    displayName: string;
    areaType: string;
    regionCode: string | null;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  hours: Array<{
    id: string;
    hoursType: string;
    periodLabel: string | null;
    openDay: number | null;
    closeDay: number | null;
    startDate: string | null;
    endDate: string | null;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  attributes: Array<{
    id: string;
    attributeGroup: string | null;
    attributeKey: string;
    displayName: string | null;
    displayText: string | null;
    valueType: string;
    boolValue: boolean | null;
    textValue: string | null;
    uriValue: string | null;
    enumValues: string[];
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  coreNormalization: GoogleBusinessProfileCoreNormalization;
};

type CanonicalSyncRows = {
  details: Database['public']['Tables']['restaurant_business_details']['Insert'] | null;
  addresses: Array<Database['public']['Tables']['restaurant_addresses']['Insert']>;
  phoneNumbers: Array<Database['public']['Tables']['restaurant_phone_numbers']['Insert']>;
  links: Array<Database['public']['Tables']['restaurant_links']['Insert']>;
  categories: Array<Database['public']['Tables']['restaurant_categories']['Insert']>;
  serviceAreas: Array<Database['public']['Tables']['restaurant_service_areas']['Insert']>;
  hours: Array<Database['public']['Tables']['restaurant_hours']['Insert']>;
  attributes: Array<Database['public']['Tables']['restaurant_attributes']['Insert']>;
};

type FieldSyncStatusInsert =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Insert'];

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: string[] | null | undefined): string[] {
  return (value ?? [])
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));
}

function humanizeIdentifier(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return normalized
    .split(/[._/\s-]+/)
    .map((segment) =>
      segment.length > 0
        ? `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`
        : '',
    )
    .filter(Boolean)
    .join(' ');
}

function normalizeBusinessStatus(value: string | null | undefined): string | null {
  const normalized = normalizeText(value)?.toUpperCase() ?? null;
  switch (normalized) {
    case 'OPEN':
      return 'open';
    case 'CLOSED_PERMANENTLY':
      return 'closed_permanently';
    case 'CLOSED_TEMPORARILY':
      return 'closed_temporarily';
    default:
      return null;
  }
}

function googleDayToNumber(day: string | null | undefined): number | null {
  const normalized = normalizeText(day)?.toUpperCase() ?? null;
  if (!normalized) {
    return null;
  }
  return normalized in DAY_NUMBERS ? DAY_NUMBERS[normalized]! : null;
}

function normalizeGoogleTime(
  value:
    | string
    | {
        hours?: number;
        minutes?: number;
      }
    | null
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
      return null;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  if (!Number.isInteger(value.hours)) {
    return null;
  }

  const hours = value.hours ?? 0;
  const minutes = Number.isInteger(value.minutes) ? (value.minutes ?? 0) : 0;
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeGoogleDate(
  value:
    | {
        year?: number;
        month?: number;
        day?: number;
      }
    | null
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (
    !Number.isInteger(value.year) ||
    !Number.isInteger(value.month) ||
    !Number.isInteger(value.day)
  ) {
    return null;
  }

  const year = value.year ?? 0;
  const month = value.month ?? 0;
  const day = value.day ?? 0;
  if (year <= 0 || month <= 0 || day <= 0) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildFormattedAddress(
  address: GoogleBusinessProfileLocationProfile['storefrontAddress'],
): string | null {
  if (!address) {
    return null;
  }

  const parts = [
    ...normalizeStringArray(address.addressLines),
    normalizeText(address.locality),
    normalizeText(address.administrativeArea),
    normalizeText(address.postalCode),
    normalizeText(address.regionCode),
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(', ') : null;
}

function buildPayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function isMissingFieldSyncStatusesTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : null;

  return (
    Boolean(message?.includes('restaurant_field_sync_statuses')) &&
    (code === '42P01' || code === 'PGRST205')
  );
}

function buildFieldStatusLookupKey(
  entityTable: string,
  entityKey: string,
  fieldKey: string,
): string {
  return `${entityTable}::${entityKey}::${fieldKey}`;
}

function buildEntityKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined ? 'null' : String(part)))
    .join(':');
}

function getDetailsEntityKey() {
  return 'details';
}

function getAddressEntityKey(input: { addressType: string; displayOrder: number }) {
  return buildEntityKey(['address', input.addressType, input.displayOrder]);
}

function getPhoneEntityKey(input: { phoneKind: string; displayOrder: number }) {
  return buildEntityKey(['phone', input.phoneKind, input.displayOrder]);
}

function getLinkEntityKey(input: { linkType: string; displayOrder: number }) {
  return buildEntityKey(['link', input.linkType, input.displayOrder]);
}

function getCategoryEntityKey(input: { displayOrder: number }) {
  return buildEntityKey(['category', input.displayOrder]);
}

function getServiceAreaEntityKey(input: { displayOrder: number }) {
  return buildEntityKey(['service_area', input.displayOrder]);
}

function getHoursEntityKey(input: { hoursType: string; displayOrder: number }) {
  return buildEntityKey(['hours', input.hoursType, input.displayOrder]);
}

function getAttributeEntityKey(input: { attributeKey: string }) {
  return buildEntityKey(['attribute', input.attributeKey]);
}

function buildFieldSyncStatus(params: {
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

function buildFieldSyncStatuses(input: {
  restaurantId: string;
  rows: CanonicalSyncRows;
  syncedAt: string;
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
      fieldKey: 'description',
      providerRecordId: details.source_record_id ?? null,
      value: details.description,
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
  });

  input.rows.hours.forEach((row) => {
    const entityKey = getHoursEntityKey({
      hoursType: row.hours_type ?? 'unknown',
      displayOrder: row.display_order ?? 0,
    });
    const providerRecordId = row.source_record_id ?? null;
    const fieldValues: Record<string, unknown> = {
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
      display_name: row.display_name,
      display_text: row.display_text,
      value_type: row.value_type,
      bool_value: row.bool_value,
      text_value: row.text_value,
      uri_value: row.uri_value,
      enum_values: row.enum_values,
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

  return statuses;
}

function extractLastSegment(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const segments = normalized.split('/');
  return segments.length > 0 ? normalizeText(segments[segments.length - 1]) : normalized;
}

function pickPlaceDisplayName(place: Record<string, unknown>): string | null {
  const directCandidates = [
    place.displayName,
    place.placeName,
    place.name,
    place.localizedName,
    place.address,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeText(typeof candidate === 'string' ? candidate : null);
    if (normalized) {
      return normalized;
    }
  }

  const nestedDisplayName = place.displayName;
  if (
    nestedDisplayName &&
    typeof nestedDisplayName === 'object' &&
    'text' in nestedDisplayName &&
    typeof nestedDisplayName.text === 'string'
  ) {
    return normalizeText(nestedDisplayName.text);
  }

  return null;
}

function deriveLinkTypeFromAttribute(attributeKey: string): string {
  const normalized = attributeKey.toLowerCase();
  if (normalized.includes('menu')) {
    return 'menu_or_services';
  }
  if (normalized.includes('reservation')) {
    return 'reservation';
  }
  if (normalized.includes('order')) {
    return 'order';
  }
  if (normalized.includes('service')) {
    return 'menu_or_services';
  }
  return 'other';
}

function normalizeServiceAreaType(value: string | null | undefined): string {
  const normalized = normalizeText(value)?.toLowerCase() ?? null;
  switch (normalized) {
    case 'region':
      return 'region';
    case 'postal_code':
    case 'postal_codes':
      return 'postal_code';
    case 'place':
      return 'place';
    default:
      return 'other';
  }
}

function normalizeAttributeValueType(value: string | null | undefined): string {
  const normalized = normalizeText(value)?.toUpperCase() ?? null;
  switch (normalized) {
    case 'BOOL':
    case 'BOOLEAN':
      return 'boolean';
    case 'URL':
    case 'URI':
      return 'uri';
    case 'ENUM':
      return 'enum';
    case 'REPEATED_ENUM':
    case 'MULTIENUM':
      return 'multienum';
    default:
      return 'text';
  }
}

function buildAttributeDisplayText(input: {
  displayName: string | null;
  boolValue: boolean | null;
  textValue: string | null;
  uriValue: string | null;
  enumValues: string[];
  positiveLabel: string | null;
  negativeLabel: string | null;
}): string | null {
  if (input.boolValue === true) {
    return input.positiveLabel ?? input.displayName;
  }

  if (input.boolValue === false) {
    return input.negativeLabel ?? input.displayName;
  }

  if (input.enumValues.length > 0) {
    return input.displayName
      ? `${input.displayName}: ${input.enumValues.join(', ')}`
      : input.enumValues.join(', ');
  }

  if (input.textValue) {
    return input.displayName ? `${input.displayName}: ${input.textValue}` : input.textValue;
  }

  if (input.uriValue) {
    return input.displayName ? `${input.displayName}: ${input.uriValue}` : input.uriValue;
  }

  return input.displayName;
}

function buildCanonicalRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  attributes: GoogleBusinessProfileAttributesResponse | null;
  syncedAt: string;
}): CanonicalSyncRows {
  const { restaurantId, location, attributes, syncedAt } = input;
  const sourceRecordId = normalizeText(location.name);

  const details =
    normalizeText(location.profile?.description) ||
    normalizeGoogleDate(location.openInfo?.openingDate) ||
    normalizeBusinessStatus(location.openInfo?.status) ||
    Boolean(location.serviceArea)
      ? {
          restaurant_id: restaurantId,
          description: normalizeText(location.profile?.description),
          opening_date: normalizeGoogleDate(location.openInfo?.openingDate),
          business_status: normalizeBusinessStatus(location.openInfo?.status),
          is_service_area_business: Boolean(location.serviceArea),
          source: GBP_SOURCE,
          source_record_id: sourceRecordId,
          managed_by: GBP_MANAGED_BY,
          last_synced_at: syncedAt,
        }
      : null;

  const addresses: CanonicalSyncRows['addresses'] = location.storefrontAddress
    ? [
        {
          restaurant_id: restaurantId,
          address_type: 'storefront',
          formatted_address: buildFormattedAddress(location.storefrontAddress),
          address_lines: location.storefrontAddress.addressLines ?? [],
          locality: normalizeText(location.storefrontAddress.locality),
          administrative_area: normalizeText(location.storefrontAddress.administrativeArea),
          postal_code: normalizeText(location.storefrontAddress.postalCode),
          region_code: normalizeText(location.storefrontAddress.regionCode),
          country_code: normalizeText(location.storefrontAddress.regionCode),
          language_code: normalizeText(location.storefrontAddress.languageCode),
          sublocality: normalizeText(location.storefrontAddress.sublocality),
          organization: normalizeText(location.storefrontAddress.organization),
          recipients: location.storefrontAddress.recipients ?? [],
          latlng_json:
            location.latlng &&
            typeof location.latlng.latitude === 'number' &&
            typeof location.latlng.longitude === 'number'
              ? location.latlng
              : null,
          is_primary: true,
          display_order: 0,
          source: GBP_SOURCE,
          source_record_id: sourceRecordId,
          managed_by: GBP_MANAGED_BY,
          last_synced_at: syncedAt,
        },
      ]
    : [];

  const phoneNumbers: CanonicalSyncRows['phoneNumbers'] = [];
  const primaryPhone = normalizeText(location.phoneNumbers?.primaryPhone);
  if (primaryPhone) {
    phoneNumbers.push({
      restaurant_id: restaurantId,
      phone_kind: 'primary',
      phone_number: primaryPhone,
      is_primary: true,
      display_order: 0,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  }

  normalizeStringArray(location.phoneNumbers?.additionalPhones).forEach((phoneNumber, index) => {
    phoneNumbers.push({
      restaurant_id: restaurantId,
      phone_kind: 'additional',
      phone_number: phoneNumber,
      is_primary: false,
      display_order: index + 1,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  });

  const links: CanonicalSyncRows['links'] = [];
  const websiteUri = normalizeText(location.websiteUri);
  if (websiteUri) {
    links.push({
      restaurant_id: restaurantId,
      link_type: 'website',
      link_status: 'current',
      label: 'Website',
      url: websiteUri,
      is_primary: true,
      display_order: 0,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  }

  const mapsUri = normalizeText(location.metadata?.mapsUri);
  if (mapsUri) {
    links.push({
      restaurant_id: restaurantId,
      link_type: 'google_map',
      link_status: 'current',
      label: 'Google Maps',
      url: mapsUri,
      is_primary: false,
      display_order: links.length,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  }

  const reviewUri = normalizeText(location.metadata?.newReviewUri);
  if (reviewUri) {
    links.push({
      restaurant_id: restaurantId,
      link_type: 'google_review',
      link_status: 'current',
      label: 'Google reviews',
      url: reviewUri,
      is_primary: false,
      display_order: links.length,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  }

  const categories: CanonicalSyncRows['categories'] = [];
  const primaryCategory = location.categories?.primaryCategory;
  const primaryCategoryName =
    normalizeText(primaryCategory?.displayName) ??
    humanizeIdentifier(extractLastSegment(primaryCategory?.name));
  if (primaryCategoryName) {
    categories.push({
      restaurant_id: restaurantId,
      display_name: primaryCategoryName,
      category_code: extractLastSegment(primaryCategory?.name),
      is_primary: true,
      display_order: 0,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  }

  (location.categories?.additionalCategories ?? []).forEach((category, index) => {
    const displayName =
      normalizeText(category.displayName) ?? humanizeIdentifier(extractLastSegment(category.name));
    if (!displayName) {
      return;
    }

    categories.push({
      restaurant_id: restaurantId,
      display_name: displayName,
      category_code: extractLastSegment(category.name),
      is_primary: false,
      display_order: index + 1,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  });

  const serviceAreas: CanonicalSyncRows['serviceAreas'] = [];
  const placeInfos = location.serviceArea?.places?.placeInfos ?? [];
  placeInfos.forEach((place, index) => {
    const placeDisplayName = pickPlaceDisplayName(place as Record<string, unknown>);
    if (!placeDisplayName) {
      return;
    }

    serviceAreas.push({
      restaurant_id: restaurantId,
      display_name: placeDisplayName,
      area_type: 'place',
      region_code: normalizeText(location.serviceArea?.regionCode),
      display_order: index,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  });

  if (serviceAreas.length === 0) {
    const regionCode = normalizeText(location.serviceArea?.regionCode);
    if (regionCode) {
      serviceAreas.push({
        restaurant_id: restaurantId,
        display_name: regionCode,
        area_type: normalizeServiceAreaType(location.serviceArea?.businessType) || 'region',
        region_code: regionCode,
        display_order: 0,
        source: GBP_SOURCE,
        source_record_id: sourceRecordId,
        managed_by: GBP_MANAGED_BY,
        last_synced_at: syncedAt,
      });
    }
  }

  const hours: CanonicalSyncRows['hours'] = [];
  (location.regularHours?.periods ?? []).forEach((period, index) => {
    hours.push({
      restaurant_id: restaurantId,
      hours_type: 'public',
      period_label: null,
      open_day: googleDayToNumber(period.openDay),
      close_day: googleDayToNumber(period.closeDay ?? period.openDay),
      start_date: null,
      end_date: null,
      open_time: normalizeGoogleTime(period.openTime),
      close_time: normalizeGoogleTime(period.closeTime),
      is_closed: false,
      display_order: index,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  });

  (location.specialHours?.specialHourPeriods ?? []).forEach((period, index) => {
    hours.push({
      restaurant_id: restaurantId,
      hours_type: 'special',
      period_label: null,
      open_day: null,
      close_day: null,
      start_date: normalizeGoogleDate(period.startDate),
      end_date: normalizeGoogleDate(period.endDate ?? period.startDate),
      open_time: period.closed === true ? null : normalizeGoogleTime(period.openTime),
      close_time: period.closed === true ? null : normalizeGoogleTime(period.closeTime),
      is_closed: period.closed === true,
      display_order: index,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });
  });

  (location.moreHours ?? []).forEach((entry, entryIndex) => {
    (entry.periods ?? []).forEach((period, periodIndex) => {
      hours.push({
        restaurant_id: restaurantId,
        hours_type: 'service',
        period_label: humanizeIdentifier(entry.hoursTypeId),
        open_day: googleDayToNumber(period.openDay),
        close_day: googleDayToNumber(period.closeDay ?? period.openDay),
        start_date: null,
        end_date: null,
        open_time: normalizeGoogleTime(period.openTime),
        close_time: normalizeGoogleTime(period.closeTime),
        is_closed: false,
        display_order: entryIndex * 100 + periodIndex,
        source: GBP_SOURCE,
        source_record_id: sourceRecordId,
        managed_by: GBP_MANAGED_BY,
        last_synced_at: syncedAt,
      });
    });
  });

  const attributeRows: CanonicalSyncRows['attributes'] = [];
  for (const [index, attribute] of (attributes?.attributes ?? []).entries()) {
    const attributeKey =
      extractLastSegment(attribute.attributeId) ??
      extractLastSegment(attribute.name) ??
      `attribute_${index}`;
    const displayName = normalizeText(attribute.displayName) ?? humanizeIdentifier(attributeKey);
    const enumValues = [
      ...normalizeStringArray(
        (attribute.repeatedEnumValue?.setValues ?? []).map(
          (value) => humanizeIdentifier(extractLastSegment(value)) ?? value,
        ),
      ),
      ...normalizeStringArray(
        (attribute.values ?? [])
          .map((value) => {
            if (typeof value?.displayName === 'string') {
              return value.displayName;
            }
            if (typeof value?.stringValue === 'string') {
              return value.stringValue;
            }
            if (value?.enumValue?.displayName) {
              return value.enumValue.displayName;
            }
            return null;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    ].filter((value, itemIndex, all) => all.indexOf(value) === itemIndex);

    const boolValue =
      typeof attribute.values?.[0]?.boolValue === 'boolean'
        ? attribute.values[0].boolValue
        : typeof attribute.valueMetadata?.[0]?.value === 'boolean'
          ? attribute.valueMetadata[0].value
          : null;
    const textValue =
      normalizeText(attribute.values?.[0]?.stringValue) ??
      normalizeText(attribute.values?.[0]?.displayName) ??
      null;
    const uriValue =
      normalizeText(attribute.uriValue) ?? normalizeText(attribute.uriValues?.[0]?.uri) ?? null;
    const valueType = normalizeAttributeValueType(attribute.valueType);
    const positiveLabel =
      normalizeText(attribute.displayStrings?.standaloneText) ??
      normalizeText(attribute.displayName);
    const negativeLabel = normalizeText(attribute.displayStrings?.negativeText);
    const displayText = buildAttributeDisplayText({
      displayName,
      boolValue,
      textValue: boolValue === null ? textValue : null,
      uriValue,
      enumValues,
      positiveLabel,
      negativeLabel,
    });

    attributeRows.push({
      restaurant_id: restaurantId,
      attribute_group: normalizeText(attribute.groupDisplayName),
      attribute_key: attributeKey,
      display_name: displayName,
      value_type: valueType,
      bool_value: boolValue,
      text_value: boolValue === null ? textValue : null,
      uri_value: uriValue,
      enum_values: enumValues,
      display_text: displayText,
      display_order: index,
      source: GBP_SOURCE,
      source_record_id:
        normalizeText(attribute.name) ?? normalizeText(attribute.attributeId) ?? sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
    });

    if (uriValue) {
      links.push({
        restaurant_id: restaurantId,
        link_type: deriveLinkTypeFromAttribute(attributeKey),
        link_status: 'current',
        label: displayName,
        url: uriValue,
        is_primary: false,
        display_order: links.length,
        source: GBP_SOURCE,
        source_record_id:
          normalizeText(attribute.name) ?? normalizeText(attribute.attributeId) ?? sourceRecordId,
        managed_by: GBP_MANAGED_BY,
        last_synced_at: syncedAt,
      });
    }
  }

  return {
    details,
    addresses,
    phoneNumbers,
    links,
    categories,
    serviceAreas,
    hours,
    attributes: attributeRows,
  };
}

async function upsertBusinessDetails(
  restaurantId: string,
  details: CanonicalSyncRows['details'],
  client: DbClient,
) {
  if (!details) {
    const { error } = await client
      .from('restaurant_business_details')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY);

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await client.from('restaurant_business_details').upsert(details, {
    onConflict: 'restaurant_id',
  });

  if (error) {
    throw error;
  }
}

async function replaceProviderRows<
  TTable extends ProviderRowTable,
>(
  table: TTable,
  restaurantId: string,
  rows: Database['public']['Tables'][TTable]['Insert'][],
  client: DbClient,
) {
  const tableMutation = client.from(table) as unknown as ProviderRowMutationBuilder<TTable>;
  const deleteQuery = tableMutation
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('source', GBP_SOURCE)
    .eq('managed_by', GBP_MANAGED_BY);
  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    if (isMissingFieldSyncStatusesTableError(deleteError)) {
      return;
    }
    throw deleteError;
  }

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await tableMutation.insert(rows);
  if (insertError) {
    if (isMissingFieldSyncStatusesTableError(insertError)) {
      return;
    }
    throw insertError;
  }
}

async function replaceProviderFieldSyncStatuses(
  restaurantId: string,
  rows: FieldSyncStatusInsert[],
  entityTables: string[],
  client: DbClient,
) {
  let deleteQuery = client
    .from('restaurant_field_sync_statuses')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('provider', GBP_SOURCE);

  if (entityTables.length > 0) {
    deleteQuery = deleteQuery.in('entity_table', entityTables);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    if (isMissingFieldSyncStatusesTableError(deleteError)) {
      return;
    }
    throw deleteError;
  }

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await client.from('restaurant_field_sync_statuses').insert(rows);

  if (insertError) {
    if (isMissingFieldSyncStatusesTableError(insertError)) {
      return;
    }
    throw insertError;
  }
}

function resolveFieldVerification(
  row: RestaurantFieldSyncStatusRow | null | undefined,
  currentValue: unknown,
): GoogleBusinessProfileFieldVerification | null {
  if (!row) {
    return null;
  }

  const isVerified =
    buildPayloadHash(row.last_provider_value_json ?? null) ===
    buildPayloadHash(currentValue ?? null);

  return {
    provider: row.provider,
    syncStatus: isVerified ? row.sync_status : 'drifted',
    isVerified,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    lastSyncedAt: row.last_synced_at,
    lastCheckedAt: row.last_checked_at,
  };
}

function combineFieldVerifications(
  items: Array<GoogleBusinessProfileFieldVerification | null>,
): GoogleBusinessProfileFieldVerification | null {
  const presentItems = items.filter((item): item is GoogleBusinessProfileFieldVerification =>
    Boolean(item),
  );
  if (presentItems.length === 0) {
    return null;
  }

  const drifted = presentItems.find((item) => item.syncStatus !== 'synced' || !item.isVerified);
  return drifted ?? presentItems[0] ?? null;
}

async function insertSnapshot(params: {
  externalProfileId: string;
  snapshotType: 'location' | 'attributes';
  payload: unknown;
  sourceRevision: string | null;
  client: DbClient;
}) {
  const { error } = await params.client.from('restaurant_external_profile_snapshots').insert({
    external_profile_id: params.externalProfileId,
    snapshot_type: params.snapshotType,
    source_revision: params.sourceRevision,
    payload:
      params.payload as Database['public']['Tables']['restaurant_external_profile_snapshots']['Insert']['payload'],
    payload_hash: buildPayloadHash(params.payload),
  });

  if (error) {
    throw error;
  }
}

export async function syncGoogleBusinessProfileCanonicalBusinessInfo(params: {
  restaurantId: string;
  externalProfile: ExternalProfileRow;
  location: GoogleBusinessProfileLocationProfile;
  attributes: GoogleBusinessProfileAttributesResponse | null;
  client: DbClient;
  syncedAt: string;
  syncAttributes: boolean;
}) {
  const rows = buildCanonicalRows({
    restaurantId: params.restaurantId,
    location: params.location,
    attributes: params.syncAttributes ? params.attributes : null,
    syncedAt: params.syncedAt,
  });
  const fieldSyncStatuses = buildFieldSyncStatuses({
    restaurantId: params.restaurantId,
    rows,
    syncedAt: params.syncedAt,
  });

  await insertSnapshot({
    externalProfileId: params.externalProfile.id,
    snapshotType: 'location',
    payload: params.location,
    sourceRevision: normalizeText(params.location.name),
    client: params.client,
  });

  if (params.syncAttributes && params.attributes) {
    await insertSnapshot({
      externalProfileId: params.externalProfile.id,
      snapshotType: 'attributes',
      payload: params.attributes,
      sourceRevision: normalizeText(params.attributes.name),
      client: params.client,
    });
  }

  await upsertBusinessDetails(params.restaurantId, rows.details, params.client);
  await replaceProviderRows(
    'restaurant_addresses',
    params.restaurantId,
    rows.addresses,
    params.client,
  );
  await replaceProviderRows(
    'restaurant_phone_numbers',
    params.restaurantId,
    rows.phoneNumbers,
    params.client,
  );
  await replaceProviderRows('restaurant_links', params.restaurantId, rows.links, params.client);
  await replaceProviderRows(
    'restaurant_categories',
    params.restaurantId,
    rows.categories,
    params.client,
  );
  await replaceProviderRows(
    'restaurant_service_areas',
    params.restaurantId,
    rows.serviceAreas,
    params.client,
  );
  await replaceProviderRows('restaurant_hours', params.restaurantId, rows.hours, params.client);

  if (params.syncAttributes) {
    await replaceProviderRows(
      'restaurant_attributes',
      params.restaurantId,
      rows.attributes,
      params.client,
    );
  }

  await replaceProviderFieldSyncStatuses(
    params.restaurantId,
    fieldSyncStatuses,
    [
      'restaurant_business_details',
      'restaurant_addresses',
      'restaurant_phone_numbers',
      'restaurant_links',
      'restaurant_categories',
      'restaurant_service_areas',
      'restaurant_hours',
      ...(params.syncAttributes ? ['restaurant_attributes'] : []),
    ],
    params.client,
  );
}

export async function readGoogleBusinessProfileBusinessInfo(
  restaurantId: string,
  client: DbClient,
): Promise<GoogleBusinessProfileBusinessInfo> {
  const [
    detailsResult,
    addressesResult,
    phoneNumbersResult,
    linksResult,
    categoriesResult,
    serviceAreasResult,
    hoursResult,
    attributesResult,
    fieldSyncStatusesResult,
    coreOperatingHoursResult,
    coreServicePeriodsResult,
  ] = await Promise.all([
    client
      .from('restaurant_business_details')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle(),
    client
      .from('restaurant_addresses')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_phone_numbers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_links')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_service_areas')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_hours')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('hours_type', { ascending: true })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_attributes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('attribute_group', { ascending: true })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_field_sync_statuses')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('provider', GBP_SOURCE),
    client
      .from('restaurant_operating_hours')
      .select(
        'id, restaurant_id, day_of_week, effective_date, opens_at, closes_at, is_closed, notes, reservation_interval_minutes, reservation_slot_times, created_at, updated_at',
      )
      .eq('restaurant_id', restaurantId),
    client
      .from('restaurant_service_periods')
      .select('id, restaurant_id, name, day_of_week, start_time, end_time, booking_option')
      .eq('restaurant_id', restaurantId),
  ]);

  const results = [
    detailsResult,
    addressesResult,
    phoneNumbersResult,
    linksResult,
    categoriesResult,
    serviceAreasResult,
    hoursResult,
    attributesResult,
    coreOperatingHoursResult,
    coreServicePeriodsResult,
  ];
  if (
    fieldSyncStatusesResult.error &&
    !isMissingFieldSyncStatusesTableError(fieldSyncStatusesResult.error)
  ) {
    throw fieldSyncStatusesResult.error;
  }
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw firstError;
  }

  const fieldSyncStatusLookup = new Map<string, RestaurantFieldSyncStatusRow>();
  for (const row of fieldSyncStatusesResult.data ?? []) {
    fieldSyncStatusLookup.set(
      buildFieldStatusLookupKey(row.entity_table, row.entity_key, row.field_key),
      row,
    );
  }

  return {
    details: mapDetails(detailsResult.data, fieldSyncStatusLookup),
    addresses: (addressesResult.data ?? []).map((row) => mapAddress(row, fieldSyncStatusLookup)),
    phoneNumbers: (phoneNumbersResult.data ?? []).map((row) =>
      mapPhoneNumber(row, fieldSyncStatusLookup),
    ),
    links: (linksResult.data ?? []).map((row) => mapLink(row, fieldSyncStatusLookup)),
    categories: (categoriesResult.data ?? []).map((row) => mapCategory(row, fieldSyncStatusLookup)),
    serviceAreas: (serviceAreasResult.data ?? []).map((row) =>
      mapServiceArea(row, fieldSyncStatusLookup),
    ),
    hours: (hoursResult.data ?? []).map((row) => mapHour(row, fieldSyncStatusLookup)),
    attributes: (attributesResult.data ?? []).map((row) =>
      mapAttribute(row, fieldSyncStatusLookup),
    ),
    coreNormalization: buildGoogleBusinessProfileCoreNormalization({
      gbpHoursRows: (hoursResult.data ?? []) as RestaurantHourRow[],
      coreOperatingHoursRows: (coreOperatingHoursResult.data ??
        []) as RestaurantOperatingHoursRow[],
      coreServicePeriodRows: (coreServicePeriodsResult.data ?? []) as RestaurantServicePeriodRow[],
    }),
  };
}

function mapDetails(
  row: RestaurantBusinessDetailsRow | null,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
) {
  if (!row) {
    return null;
  }

  const entityTable = 'restaurant_business_details';
  const entityKey = getDetailsEntityKey();

  return {
    description: row.description,
    openingDate: row.opening_date,
    businessStatus: row.business_status,
    isServiceAreaBusiness: row.is_service_area_business,
    source: row.source,
    managedBy: row.managed_by,
    lastSyncedAt: row.last_synced_at,
    verification: {
      description: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'description')),
        row.description,
      ),
      openingDate: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'opening_date')),
        row.opening_date,
      ),
      businessStatus: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'business_status')),
        row.business_status,
      ),
      isServiceAreaBusiness: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'is_service_area_business')),
        row.is_service_area_business,
      ),
    },
  };
}

function mapAddress(row: RestaurantAddressRow, lookup: Map<string, RestaurantFieldSyncStatusRow>) {
  const addressLines = Array.isArray(row.address_lines)
    ? row.address_lines.filter((value): value is string => typeof value === 'string')
    : [];
  const entityTable = 'restaurant_addresses';
  const entityKey = getAddressEntityKey({
    addressType: row.address_type,
    displayOrder: row.display_order,
  });

  return {
    id: row.id,
    addressType: row.address_type,
    formattedAddress: row.formatted_address,
    addressLines,
    locality: row.locality,
    administrativeArea: row.administrative_area,
    postalCode: row.postal_code,
    regionCode: row.region_code,
    countryCode: row.country_code,
    isPrimary: row.is_primary,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'formatted_address')),
        row.formatted_address,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'address_lines')),
        addressLines,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'locality')),
        row.locality,
      ),
    ]),
  };
}

function mapPhoneNumber(
  row: RestaurantPhoneNumberRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
) {
  const entityTable = 'restaurant_phone_numbers';
  const entityKey = getPhoneEntityKey({
    phoneKind: row.phone_kind,
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    phoneKind: row.phone_kind,
    phoneNumber: row.phone_number,
    isPrimary: row.is_primary,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: resolveFieldVerification(
      lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'phone_number')),
      row.phone_number,
    ),
  };
}

function mapLink(row: RestaurantLinkRow, lookup: Map<string, RestaurantFieldSyncStatusRow>) {
  const entityTable = 'restaurant_links';
  const entityKey = getLinkEntityKey({
    linkType: row.link_type,
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    linkType: row.link_type,
    linkStatus: row.link_status,
    label: row.label,
    url: row.url,
    isPrimary: row.is_primary,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'url')),
        row.url,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'label')),
        row.label,
      ),
    ]),
  };
}

function mapCategory(
  row: RestaurantCategoryRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
) {
  const entityTable = 'restaurant_categories';
  const entityKey = getCategoryEntityKey({
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    displayName: row.display_name,
    categoryCode: row.category_code,
    isPrimary: row.is_primary,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_name')),
        row.display_name,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'category_code')),
        row.category_code,
      ),
    ]),
  };
}

function mapServiceArea(
  row: RestaurantServiceAreaRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
) {
  const entityTable = 'restaurant_service_areas';
  const entityKey = getServiceAreaEntityKey({
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    displayName: row.display_name,
    areaType: row.area_type,
    regionCode: row.region_code,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_name')),
        row.display_name,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'area_type')),
        row.area_type,
      ),
    ]),
  };
}

function mapHour(row: RestaurantHourRow, lookup: Map<string, RestaurantFieldSyncStatusRow>) {
  const entityTable = 'restaurant_hours';
  const entityKey = getHoursEntityKey({
    hoursType: row.hours_type,
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    hoursType: row.hours_type,
    periodLabel: row.period_label,
    openDay: row.open_day,
    closeDay: row.close_day,
    startDate: row.start_date,
    endDate: row.end_date,
    openTime: row.open_time,
    closeTime: row.close_time,
    isClosed: row.is_closed,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'period_label')),
        row.period_label,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'open_day')),
        row.open_day,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'close_day')),
        row.close_day,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'start_date')),
        row.start_date,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'end_date')),
        row.end_date,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'open_time')),
        row.open_time,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'close_time')),
        row.close_time,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'is_closed')),
        row.is_closed,
      ),
    ]),
  };
}

function mapAttribute(
  row: RestaurantAttributeRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
) {
  const enumValues = Array.isArray(row.enum_values)
    ? row.enum_values.filter((value): value is string => typeof value === 'string')
    : [];
  const entityTable = 'restaurant_attributes';
  const entityKey = getAttributeEntityKey({
    attributeKey: row.attribute_key,
  });
  return {
    id: row.id,
    attributeGroup: row.attribute_group,
    attributeKey: row.attribute_key,
    displayName: row.display_name,
    displayText: row.display_text,
    valueType: row.value_type,
    boolValue: row.bool_value,
    textValue: row.text_value,
    uriValue: row.uri_value,
    enumValues,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_name')),
        row.display_name,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_text')),
        row.display_text,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'bool_value')),
        row.bool_value,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'text_value')),
        row.text_value,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'uri_value')),
        row.uri_value,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'enum_values')),
        enumValues,
      ),
    ]),
  };
}

export const businessInfoTestUtils = {
  buildCanonicalRows,
  buildFieldSyncStatuses,
  combineFieldVerifications,
  humanizeIdentifier,
  normalizeGoogleDate,
  normalizeGoogleTime,
  replaceProviderFieldSyncStatuses,
};
