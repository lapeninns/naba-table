import { describe, expect, it } from 'vitest';

import {
  buildAttributeDisplayText,
  buildCanonicalRows,
  deriveLinkTypeFromAttribute,
  extractLastSegment,
  normalizeAttributeValueType,
  normalizeServiceAreaType,
  pickPlaceDisplayName,
} from '@/server/google-business-profile/businessInfoCanonicalRows';

describe('google business profile business info canonical rows', () => {
  it('normalizes helper values used by canonical row construction', () => {
    expect(extractLastSegment('locations/123/categories/gcid:pub')).toBe('gcid:pub');
    expect(pickPlaceDisplayName({ displayName: { text: 'Cambridge' } })).toBe('Cambridge');
    expect(deriveLinkTypeFromAttribute('url_menu')).toBe('menu_or_services');
    expect(deriveLinkTypeFromAttribute('url_reservation')).toBe('reservation');
    expect(normalizeServiceAreaType('POSTAL_CODES')).toBe('postal_code');
    expect(normalizeAttributeValueType('REPEATED_ENUM')).toBe('multienum');
  });

  it('builds display text for boolean, enum, text, and uri attributes', () => {
    expect(
      buildAttributeDisplayText({
        displayName: 'Accessible entrance',
        boolValue: true,
        textValue: null,
        uriValue: null,
        enumValues: [],
        positiveLabel: 'Has accessible entrance',
        negativeLabel: 'No accessible entrance',
      }),
    ).toBe('Has accessible entrance');
    expect(
      buildAttributeDisplayText({
        displayName: 'Offerings',
        boolValue: null,
        textValue: null,
        uriValue: null,
        enumValues: ['Beer', 'Wine'],
        positiveLabel: null,
        negativeLabel: null,
      }),
    ).toBe('Offerings: Beer, Wine');
    expect(
      buildAttributeDisplayText({
        displayName: 'Booking URL',
        boolValue: null,
        textValue: null,
        uriValue: 'https://example.com/book',
        enumValues: [],
        positiveLabel: null,
        negativeLabel: null,
      }),
    ).toBe('Booking URL: https://example.com/book');
  });

  it('maps a Google location and attributes payload into canonical insert rows', () => {
    const rows = buildCanonicalRows({
      restaurantId: 'rest-1',
      syncedAt: '2026-05-21T20:00:00.000Z',
      location: {
        name: 'locations/456',
        title: 'Old Crown Girton',
        languageCode: 'en-GB',
        profile: { description: 'Pub and restaurant' },
        storefrontAddress: {
          addressLines: ['89 High Street'],
          locality: 'Girton',
          administrativeArea: 'Cambridgeshire',
          postalCode: 'CB3 0QD',
          regionCode: 'GB',
        },
        latlng: { latitude: 52.2351, longitude: 0.0838 },
        phoneNumbers: {
          primaryPhone: '01223 277217',
          additionalPhones: ['01223 277218'],
        },
        metadata: {
          mapsUri: 'https://maps.google.com/example',
          newReviewUri: 'https://g.page/r/example/review',
        },
        websiteUri: 'https://www.oldcrowngirton.com',
        categories: {
          primaryCategory: {
            name: 'gcid:pub',
            displayName: 'Pub',
          },
        },
        serviceArea: {
          regionCode: 'GB',
          places: {
            placeInfos: [{ displayName: { text: 'Cambridge' }, placeId: 'place-1' }],
          },
        },
        regularHours: {
          periods: [
            {
              openDay: 'FRIDAY',
              closeDay: 'FRIDAY',
              openTime: '12:00',
              closeTime: '22:30',
            },
          ],
        },
        serviceItems: [
          {
            structuredServiceItemId: 'private_dining',
            displayName: 'Private dining',
            description: 'Private dining room',
          },
        ],
      },
      attributes: {
        name: 'locations/456/attributes',
        attributes: [
          {
            attributeId: 'url_menu',
            displayName: 'Menu',
            valueType: 'URL',
            uriValues: [{ uri: 'https://www.oldcrowngirton.com/menu' }],
          },
        ],
      },
    });

    expect(rows.details).toMatchObject({
      restaurant_id: 'rest-1',
      business_name: 'Old Crown Girton',
      source: 'gbp',
      managed_by: 'gbp',
      change_origin: 'google',
    });
    expect(rows.addresses[0]).toMatchObject({
      formatted_address: '89 High Street, Girton, Cambridgeshire, CB3 0QD, GB',
      latitude: 52.2351,
      longitude: 0.0838,
    });
    expect(rows.phoneNumbers).toHaveLength(2);
    expect(rows.links.map((link) => link.link_type)).toEqual([
      'website',
      'google_map',
      'google_review',
      'menu_or_services',
    ]);
    expect(rows.categories[0]).toMatchObject({ display_name: 'Pub', is_primary: true });
    expect(rows.serviceAreas[0]).toMatchObject({
      display_name: 'Cambridge',
      google_place_id: 'place-1',
    });
    expect(rows.hours[0]).toMatchObject({
      hours_type: 'public',
      open_day: 5,
      open_time: '12:00',
      close_time: '22:30',
    });
    expect(rows.attributes[0]).toMatchObject({
      attribute_key: 'url_menu',
      value_type: 'uri',
      uri_value: 'https://www.oldcrowngirton.com/menu',
    });
    expect(rows.serviceItems[0]).toMatchObject({
      item_key: 'private_dining',
      display_name: 'Private dining',
    });
  });
});
