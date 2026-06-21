import { describe, expect, it } from 'vitest';

import { buildCanonicalServiceAreaRows } from '@/server/google-business-profile/businessInfoCanonicalServiceAreas';

describe('google business profile business info canonical service areas', () => {
  it('builds service-area place rows from place infos', () => {
    const rows = buildCanonicalServiceAreaRows({
      restaurantId: 'rest-1',
      sourceRecordId: 'locations/456',
      syncedAt: '2026-05-22T07:16:00.000Z',
      location: {
        serviceArea: {
          regionCode: 'GB',
          businessType: 'CUSTOMER_LOCATION_ONLY',
          places: {
            placeInfos: [
              {
                displayName: { text: 'Cambridge' },
                placeId: 'place-1',
                place: 'places/cambridge',
              },
              {
                placeName: 'Girton',
                resourceName: 'places/girton',
              },
              {
                displayName: '',
                address: '',
              },
            ],
          },
        },
      } as never,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        restaurant_id: 'rest-1',
        display_name: 'Cambridge',
        area_type: 'place',
        region_code: 'GB',
        google_place_id: 'place-1',
        google_place_resource_name: 'places/place-1',
        display_order: 0,
        source: 'gbp',
        managed_by: 'gbp',
        change_origin: 'google',
      }),
      expect.objectContaining({
        display_name: 'Girton',
        google_place_resource_name: 'places/girton',
        display_order: 1,
      }),
    ]);
  });

  it('falls back to a region row when place rows are unavailable', () => {
    const rows = buildCanonicalServiceAreaRows({
      restaurantId: 'rest-1',
      sourceRecordId: 'locations/456',
      syncedAt: '2026-05-22T07:16:00.000Z',
      location: {
        serviceArea: {
          regionCode: 'GB',
          businessType: 'POSTAL_CODES',
          places: {
            placeInfos: [{ displayName: '' }],
          },
        },
      } as never,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        display_name: 'GB',
        area_type: 'postal_code',
        region_code: 'GB',
        place_data_json: {
          businessType: 'POSTAL_CODES',
          regionCode: 'GB',
        },
        display_order: 0,
      }),
    ]);
  });

  it('returns empty rows when service-area payload is unavailable', () => {
    expect(
      buildCanonicalServiceAreaRows({
        restaurantId: 'rest-1',
        sourceRecordId: 'locations/456',
        syncedAt: '2026-05-22T07:16:00.000Z',
        location: {} as never,
      }),
    ).toEqual([]);
  });
});
