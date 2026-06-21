import {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
} from './businessInfoCanonicalConstants';
import { extractLastSegment } from './businessInfoCanonicalHelpers';
import { humanizeIdentifier } from './businessInfoLabelNormalization';
import { normalizeText } from './businessInfoNormalizationCore';
import { normalizeMoreHoursTypes } from './businessInfoScheduleNormalization';

import type { GoogleBusinessProfileLocationProfile } from './client';
import type { Database } from '@/types/supabase';

type CategoryInsert = Database['public']['Tables']['restaurant_categories']['Insert'];

export function buildCanonicalCategoryRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  sourceRecordId: string | null;
  syncedAt: string;
}): CategoryInsert[] {
  const { restaurantId, location, sourceRecordId, syncedAt } = input;
  const categories: CategoryInsert[] = [];
  const primaryCategory = location.categories?.primaryCategory;
  const primaryCategoryName =
    normalizeText(primaryCategory?.displayName) ??
    humanizeIdentifier(extractLastSegment(primaryCategory?.name));

  if (primaryCategoryName) {
    categories.push({
      restaurant_id: restaurantId,
      display_name: primaryCategoryName,
      category_code: extractLastSegment(primaryCategory?.name),
      more_hours_types_json: normalizeMoreHoursTypes(primaryCategory?.moreHoursTypes),
      is_primary: true,
      display_order: 0,
      source: GBP_SOURCE,
      source_record_id: normalizeText(primaryCategory?.name) ?? sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
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
      more_hours_types_json: normalizeMoreHoursTypes(category.moreHoursTypes),
      is_primary: false,
      display_order: index + 1,
      source: GBP_SOURCE,
      source_record_id: normalizeText(category.name) ?? sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    });
  });

  return categories;
}
