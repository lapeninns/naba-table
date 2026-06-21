import { buildFieldStatusLookupKey, getHoursEntityKey } from './businessInfoFieldSyncStatus';
import {
  combineFieldVerifications,
  resolveFieldVerification,
} from './businessInfoReadModelVerification';

import type { GoogleBusinessProfileBusinessInfo } from './businessInfoReadModel';
import type { Database } from '@/types/supabase';

type RestaurantHourRow = Database['public']['Tables']['restaurant_hours']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export function mapHour(
  row: RestaurantHourRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['hours'][number] {
  const entityTable = 'restaurant_hours';
  const entityKey = getHoursEntityKey({
    hoursType: row.hours_type,
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    hoursType: row.hours_type,
    periodLabel: row.period_label,
    periodCode: row.period_code,
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
