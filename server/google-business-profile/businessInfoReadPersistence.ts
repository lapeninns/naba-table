import { GBP_MANAGED_BY, GBP_SOURCE } from './businessInfoCanonicalRows';
import {
  mapGoogleBusinessProfileBusinessInfo,
  type GoogleBusinessProfileBusinessInfo,
} from './businessInfoReadModel';
import { isMissingFieldSyncStatusesTableError } from './businessInfoSyncPersistence';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

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
    serviceItemsResult,
    fieldSyncStatusesResult,
    coreOperatingHoursResult,
    coreServicePeriodsResult,
  ] = await Promise.all([
    client
      .from('restaurant_business_details')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
      .maybeSingle(),
    client
      .from('restaurant_addresses')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_phone_numbers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_links')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_service_areas')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_hours')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
      .order('hours_type', { ascending: true })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_attributes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
      .order('attribute_group', { ascending: true })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_service_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY)
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
    serviceItemsResult,
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

  return mapGoogleBusinessProfileBusinessInfo({
    details: detailsResult.data,
    addresses: addressesResult.data ?? [],
    phoneNumbers: phoneNumbersResult.data ?? [],
    links: linksResult.data ?? [],
    categories: categoriesResult.data ?? [],
    serviceAreas: serviceAreasResult.data ?? [],
    hours: hoursResult.data ?? [],
    attributes: attributesResult.data ?? [],
    serviceItems: serviceItemsResult.data ?? [],
    fieldSyncStatuses: fieldSyncStatusesResult.data ?? [],
    coreOperatingHours: coreOperatingHoursResult.data ?? [],
    coreServicePeriods: (coreServicePeriodsResult.data ?? []) as never,
  });
}
