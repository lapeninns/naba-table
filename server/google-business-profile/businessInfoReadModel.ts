import {
  mapAddress,
  mapAttribute,
  mapCategory,
  mapDetails,
  mapHour,
  mapLink,
  mapPhoneNumber,
  mapServiceArea,
  mapServiceItem,
} from './businessInfoReadModelMappers';
import { buildFieldSyncStatusLookup } from './businessInfoReadModelVerification';
import {
  buildGoogleBusinessProfileCoreNormalization,
  type GoogleBusinessProfileCoreNormalization,
} from './core-normalization';

import type { GoogleBusinessProfileFieldVerification } from './businessInfoReadModelVerification';
import type { Database } from '@/types/supabase';

type RestaurantBusinessDetailsRow =
  Database['public']['Tables']['restaurant_business_details']['Row'];
type RestaurantAddressRow = Database['public']['Tables']['restaurant_addresses']['Row'];
type RestaurantPhoneNumberRow = Database['public']['Tables']['restaurant_phone_numbers']['Row'];
type RestaurantLinkRow = Database['public']['Tables']['restaurant_links']['Row'];
type RestaurantCategoryRow = Database['public']['Tables']['restaurant_categories']['Row'];
type RestaurantServiceAreaRow = Database['public']['Tables']['restaurant_service_areas']['Row'];
type RestaurantHourRow = Database['public']['Tables']['restaurant_hours']['Row'];
type RestaurantAttributeRow = Database['public']['Tables']['restaurant_attributes']['Row'];
type RestaurantServiceItemRow = Database['public']['Tables']['restaurant_service_items']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];
type RestaurantOperatingHoursRow =
  Database['public']['Tables']['restaurant_operating_hours']['Row'];
type RestaurantServicePeriodRow = Database['public']['Tables']['restaurant_service_periods']['Row'];

export type { GoogleBusinessProfileFieldVerification } from './businessInfoReadModelVerification';
export {
  buildFieldSyncStatusLookup,
  combineFieldVerifications,
  resolveFieldVerification,
} from './businessInfoReadModelVerification';
export {
  mapAddress,
  mapAttribute,
  mapCategory,
  mapDetails,
  mapHour,
  mapLink,
  mapPhoneNumber,
  mapServiceArea,
  mapServiceItem,
} from './businessInfoReadModelMappers';

export type GoogleBusinessProfileBusinessInfo = {
  details: {
    businessName: string | null;
    description: string | null;
    languageCode: string | null;
    openingDate: string | null;
    businessStatus: string | null;
    isServiceAreaBusiness: boolean;
    canReopen: boolean | null;
    source: string;
    managedBy: string;
    lastSyncedAt: string | null;
    verification?: {
      businessName: GoogleBusinessProfileFieldVerification | null;
      description: GoogleBusinessProfileFieldVerification | null;
      languageCode: GoogleBusinessProfileFieldVerification | null;
      openingDate: GoogleBusinessProfileFieldVerification | null;
      businessStatus: GoogleBusinessProfileFieldVerification | null;
      isServiceAreaBusiness: GoogleBusinessProfileFieldVerification | null;
      canReopen: GoogleBusinessProfileFieldVerification | null;
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
    languageCode: string | null;
    sublocality: string | null;
    organization: string | null;
    sortingCode: string | null;
    recipients: string[];
    latlng: {
      latitude?: number;
      longitude?: number;
    } | null;
    latitude: number | null;
    longitude: number | null;
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
    moreHoursTypes: Array<{
      hoursTypeId: string | null;
      displayName: string | null;
      localizedDisplayName: string | null;
    }>;
    isPrimary: boolean;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  serviceAreas: Array<{
    id: string;
    displayName: string;
    areaType: string;
    regionCode: string | null;
    googlePlaceId: string | null;
    googlePlaceResourceName: string | null;
    placeData: Record<string, unknown> | null;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  hours: Array<{
    id: string;
    hoursType: string;
    periodLabel: string | null;
    periodCode: string | null;
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
    attributeName: string | null;
    attributeId: string | null;
    displayName: string | null;
    displayText: string | null;
    displayTextStandalone: string | null;
    displayTextNegative: string | null;
    valueType: string;
    boolValue: boolean | null;
    textValue: string | null;
    uriValue: string | null;
    uriValues: string[];
    enumValues: string[];
    unsetEnumValues: string[];
    rawValue: Record<string, unknown> | null;
    rawEnumValues: Record<string, unknown> | null;
    displayValue: Record<string, unknown> | null;
    valueMetadata: Array<{
      value: boolean | string | null;
      displayName: string | null;
    }>;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  serviceItems: Array<{
    id: string;
    itemKey: string;
    itemType: string | null;
    displayName: string | null;
    description: string | null;
    payload: Record<string, unknown> | null;
    lastSyncedAt: string | null;
    verificationStatus?: GoogleBusinessProfileFieldVerification | null;
  }>;
  coreNormalization: GoogleBusinessProfileCoreNormalization;
};

export type GoogleBusinessProfileBusinessInfoReadRows = {
  details: RestaurantBusinessDetailsRow | null;
  addresses: RestaurantAddressRow[];
  phoneNumbers: RestaurantPhoneNumberRow[];
  links: RestaurantLinkRow[];
  categories: RestaurantCategoryRow[];
  serviceAreas: RestaurantServiceAreaRow[];
  hours: RestaurantHourRow[];
  attributes: RestaurantAttributeRow[];
  serviceItems: RestaurantServiceItemRow[];
  fieldSyncStatuses: RestaurantFieldSyncStatusRow[];
  coreOperatingHours: RestaurantOperatingHoursRow[];
  coreServicePeriods: RestaurantServicePeriodRow[];
};

export function mapGoogleBusinessProfileBusinessInfo(
  rows: GoogleBusinessProfileBusinessInfoReadRows,
): GoogleBusinessProfileBusinessInfo {
  const fieldSyncStatusLookup = buildFieldSyncStatusLookup(rows.fieldSyncStatuses);

  return {
    details: mapDetails(rows.details, fieldSyncStatusLookup),
    addresses: rows.addresses.map((row) => mapAddress(row, fieldSyncStatusLookup)),
    phoneNumbers: rows.phoneNumbers.map((row) => mapPhoneNumber(row, fieldSyncStatusLookup)),
    links: rows.links.map((row) => mapLink(row, fieldSyncStatusLookup)),
    categories: rows.categories.map((row) => mapCategory(row, fieldSyncStatusLookup)),
    serviceAreas: rows.serviceAreas.map((row) => mapServiceArea(row, fieldSyncStatusLookup)),
    hours: rows.hours.map((row) => mapHour(row, fieldSyncStatusLookup)),
    attributes: rows.attributes.map((row) => mapAttribute(row, fieldSyncStatusLookup)),
    serviceItems: rows.serviceItems.map((row) => mapServiceItem(row, fieldSyncStatusLookup)),
    coreNormalization: buildGoogleBusinessProfileCoreNormalization({
      gbpHoursRows: rows.hours,
      coreOperatingHoursRows: rows.coreOperatingHours,
      coreServicePeriodRows: rows.coreServicePeriods,
    }),
  };
}
