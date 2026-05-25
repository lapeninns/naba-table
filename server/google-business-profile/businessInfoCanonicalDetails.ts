import {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
} from './businessInfoCanonicalConstants';
import { normalizeText } from './businessInfoNormalizationCore';
import { normalizeGoogleDate } from './businessInfoScheduleNormalization';
import { normalizeBusinessStatus } from './businessInfoStatusNormalization';

import type { GoogleBusinessProfileLocationProfile } from './client';
import type { Database } from '@/types/supabase';

type DetailsInsert = Database['public']['Tables']['restaurant_business_details']['Insert'];

export function buildCanonicalDetailsRow(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  sourceRecordId: string | null;
  syncedAt: string;
}): DetailsInsert | null {
  const { restaurantId, location, sourceRecordId, syncedAt } = input;
  const businessName = normalizeText(location.title);
  const description = normalizeText(location.profile?.description);
  const languageCode = normalizeText(location.languageCode);
  const openingDate = normalizeGoogleDate(location.openInfo?.openingDate);
  const businessStatus = normalizeBusinessStatus(location.openInfo?.status);
  const canReopen =
    typeof location.openInfo?.canReopen === 'boolean' ? location.openInfo.canReopen : null;
  const isServiceAreaBusiness = Boolean(location.serviceArea);

  if (
    !businessName &&
    !description &&
    !languageCode &&
    !openingDate &&
    !businessStatus &&
    canReopen === null &&
    !isServiceAreaBusiness
  ) {
    return null;
  }

  return {
    restaurant_id: restaurantId,
    business_name: businessName,
    description,
    language_code: languageCode,
    opening_date: openingDate,
    business_status: businessStatus,
    is_service_area_business: isServiceAreaBusiness,
    can_reopen: canReopen,
    source: GBP_SOURCE,
    source_record_id: sourceRecordId,
    managed_by: GBP_MANAGED_BY,
    last_synced_at: syncedAt,
    ...GBP_CHANGE_PROVENANCE,
  };
}
