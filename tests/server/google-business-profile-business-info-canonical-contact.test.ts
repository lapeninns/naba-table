import { describe, expect, it } from 'vitest';

import { buildCanonicalContactRows } from '@/server/google-business-profile/businessInfoCanonicalContact';

describe('google business profile business info canonical contact', () => {
  it('builds storefront address, phone, and base link rows', () => {
    const rows = buildCanonicalContactRows({
      restaurantId: 'rest-1',
      sourceRecordId: 'locations/456',
      syncedAt: '2026-05-22T07:19:00.000Z',
      location: {
        storefrontAddress: {
          addressLines: ['89 High Street'],
          locality: 'Girton',
          administrativeArea: 'Cambridgeshire',
          postalCode: 'CB3 0QD',
          regionCode: 'GB',
          languageCode: 'en-GB',
          recipients: ['Old Crown'],
        },
        latlng: { latitude: 52.2351, longitude: 0.0838 },
        phoneNumbers: {
          primaryPhone: ' 01223 277217 ',
          additionalPhones: ['01223 277218', '', null],
        },
        websiteUri: 'https://www.oldcrowngirton.com',
        metadata: {
          mapsUri: 'https://maps.google.com/example',
          newReviewUri: 'https://g.page/r/example/review',
        },
      } as never,
    });

    expect(rows.addresses).toEqual([
      expect.objectContaining({
        restaurant_id: 'rest-1',
        address_type: 'storefront',
        formatted_address: '89 High Street, Girton, Cambridgeshire, CB3 0QD, GB',
        address_lines: ['89 High Street'],
        latitude: 52.2351,
        longitude: 0.0838,
        latlng_json: { latitude: 52.2351, longitude: 0.0838 },
        source: 'gbp',
        managed_by: 'gbp',
        change_origin: 'google',
      }),
    ]);
    expect(rows.phoneNumbers).toEqual([
      expect.objectContaining({
        phone_kind: 'primary',
        phone_number: '01223 277217',
        is_primary: true,
        display_order: 0,
      }),
      expect.objectContaining({
        phone_kind: 'additional',
        phone_number: '01223 277218',
        is_primary: false,
        display_order: 1,
      }),
    ]);
    expect(rows.links).toEqual([
      expect.objectContaining({
        link_type: 'website',
        label: 'Website',
        url: 'https://www.oldcrowngirton.com',
        is_primary: true,
        display_order: 0,
      }),
      expect.objectContaining({
        link_type: 'google_map',
        label: 'Google Maps',
        url: 'https://maps.google.com/example',
        display_order: 1,
      }),
      expect.objectContaining({
        link_type: 'google_review',
        label: 'Google reviews',
        url: 'https://g.page/r/example/review',
        display_order: 2,
      }),
    ]);
  });

  it('returns empty rows when contact payloads are unavailable', () => {
    expect(
      buildCanonicalContactRows({
        restaurantId: 'rest-1',
        sourceRecordId: 'locations/456',
        syncedAt: '2026-05-22T07:19:00.000Z',
        location: {} as never,
      }),
    ).toEqual({ addresses: [], phoneNumbers: [], links: [] });
  });
});
