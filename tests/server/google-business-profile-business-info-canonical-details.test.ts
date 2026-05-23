import { describe, expect, it } from 'vitest';

import { buildCanonicalDetailsRow } from '@/server/google-business-profile/businessInfoCanonicalDetails';

describe('google business profile business info canonical details', () => {
  it('builds a normalized business details row', () => {
    const row = buildCanonicalDetailsRow({
      restaurantId: 'rest-1',
      sourceRecordId: 'locations/456',
      syncedAt: '2026-05-22T07:27:00.000Z',
      location: {
        title: ' Old Crown Girton ',
        languageCode: ' en-GB ',
        profile: { description: ' Pub and restaurant ' },
        openInfo: {
          openingDate: { year: 2020, month: 5, day: 3 },
          status: 'OPEN',
          canReopen: true,
        },
      } as never,
    });

    expect(row).toMatchObject({
      restaurant_id: 'rest-1',
      business_name: 'Old Crown Girton',
      description: 'Pub and restaurant',
      language_code: 'en-GB',
      opening_date: '2020-05-03',
      business_status: 'open',
      is_service_area_business: false,
      can_reopen: true,
      source: 'gbp',
      managed_by: 'gbp',
      source_record_id: 'locations/456',
      change_origin: 'google',
    });
  });

  it('emits a details row for service-area-only locations', () => {
    const row = buildCanonicalDetailsRow({
      restaurantId: 'rest-1',
      sourceRecordId: 'locations/456',
      syncedAt: '2026-05-22T07:27:00.000Z',
      location: {
        serviceArea: {
          regionCode: 'GB',
        },
      } as never,
    });

    expect(row).toMatchObject({
      business_name: null,
      description: null,
      language_code: null,
      opening_date: null,
      business_status: null,
      is_service_area_business: true,
      can_reopen: null,
    });
  });

  it('returns null when no canonical details fields are available', () => {
    expect(
      buildCanonicalDetailsRow({
        restaurantId: 'rest-1',
        sourceRecordId: 'locations/456',
        syncedAt: '2026-05-22T07:27:00.000Z',
        location: {} as never,
      }),
    ).toBeNull();
  });
});
