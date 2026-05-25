import {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
} from './businessInfoCanonicalConstants';
import { humanizeIdentifier } from './businessInfoLabelNormalization';
import { normalizeText } from './businessInfoNormalizationCore';
import {
  googleDayToNumber,
  normalizeGoogleDate,
  normalizeGoogleTime,
} from './businessInfoScheduleNormalization';

import type { GoogleBusinessProfileLocationProfile } from './client';
import type { Database } from '@/types/supabase';

type HourInsert = Database['public']['Tables']['restaurant_hours']['Insert'];

export function buildCanonicalHourRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  sourceRecordId: string | null;
  syncedAt: string;
}): HourInsert[] {
  const { restaurantId, location, sourceRecordId, syncedAt } = input;
  const hours: HourInsert[] = [];

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
      ...GBP_CHANGE_PROVENANCE,
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
      ...GBP_CHANGE_PROVENANCE,
    });
  });

  (location.moreHours ?? []).forEach((entry, entryIndex) => {
    (entry.periods ?? []).forEach((period, periodIndex) => {
      hours.push({
        restaurant_id: restaurantId,
        hours_type: 'service',
        period_code: normalizeText(entry.hoursTypeId),
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
        ...GBP_CHANGE_PROVENANCE,
      });
    });
  });

  return hours;
}
