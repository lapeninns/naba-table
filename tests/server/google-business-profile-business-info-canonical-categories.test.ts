import { describe, expect, it } from 'vitest';

import { buildCanonicalCategoryRows } from '@/server/google-business-profile/businessInfoCanonicalCategories';

describe('google business profile business info canonical categories', () => {
  it('builds primary and additional category rows', () => {
    const rows = buildCanonicalCategoryRows({
      restaurantId: 'rest-1',
      sourceRecordId: 'locations/456',
      syncedAt: '2026-05-22T07:22:00.000Z',
      location: {
        categories: {
          primaryCategory: {
            name: 'categories/gcid:pub',
            displayName: ' Pub ',
            moreHoursTypes: [
              {
                hoursTypeId: 'KITCHEN',
                displayName: 'Kitchen',
                localizedDisplayName: 'Kitchen hours',
              },
            ],
          },
          additionalCategories: [
            {
              name: 'categories/gcid:indian_restaurant',
              displayName: '',
            },
            {
              name: 'categories/gcid:bar',
              displayName: 'Bar',
            },
          ],
        },
      } as never,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        restaurant_id: 'rest-1',
        display_name: 'Pub',
        category_code: 'gcid:pub',
        is_primary: true,
        display_order: 0,
        source: 'gbp',
        managed_by: 'gbp',
        change_origin: 'google',
        more_hours_types_json: [
          {
            hoursTypeId: 'KITCHEN',
            displayName: 'Kitchen',
            localizedDisplayName: 'Kitchen hours',
          },
        ],
      }),
      expect.objectContaining({
        display_name: 'Gcid:indian Restaurant',
        category_code: 'gcid:indian_restaurant',
        is_primary: false,
        display_order: 1,
      }),
      expect.objectContaining({
        display_name: 'Bar',
        category_code: 'gcid:bar',
        is_primary: false,
        display_order: 2,
      }),
    ]);
  });

  it('returns empty rows when categories are unavailable', () => {
    expect(
      buildCanonicalCategoryRows({
        restaurantId: 'rest-1',
        sourceRecordId: 'locations/456',
        syncedAt: '2026-05-22T07:22:00.000Z',
        location: {} as never,
      }),
    ).toEqual([]);
  });
});
