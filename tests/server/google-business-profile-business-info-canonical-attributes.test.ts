import { describe, expect, it } from 'vitest';

import { buildCanonicalAttributeRows } from '@/server/google-business-profile/businessInfoCanonicalAttributes';

describe('google business profile business info canonical attributes', () => {
  it('builds normalized attribute rows and derived URI links', () => {
    const projection = buildCanonicalAttributeRows({
      restaurantId: 'rest-1',
      sourceRecordId: 'locations/456',
      syncedAt: '2026-05-22T07:10:00.000Z',
      startingLinkDisplayOrder: 3,
      attributes: {
        name: 'locations/456/attributes',
        attributes: [
          {
            name: 'locations/456/attributes/url_menu',
            attributeId: 'attributes/url_menu',
            displayName: 'Menu',
            valueType: 'URL',
            uriValues: [{ uri: 'https://example.com/menu' }],
          },
          {
            name: 'locations/456/attributes/has_wheelchair_accessible_entrance',
            attributeId: 'attributes/has_wheelchair_accessible_entrance',
            displayName: 'Accessible entrance',
            valueType: 'BOOL',
            values: [{ boolValue: true }],
            displayStrings: {
              standaloneText: 'Has accessible entrance',
              negativeText: 'No accessible entrance',
            },
          },
          {
            name: 'locations/456/attributes/payment_options',
            attributeId: 'attributes/payment_options',
            displayName: 'Payments',
            valueType: 'REPEATED_ENUM',
            repeatedEnumValue: {
              setValues: ['PAY_CASH', 'PAY_CARD'],
              unsetValues: ['PAY_CHEQUE'],
            },
          },
        ],
      },
    });

    expect(projection.attributes).toHaveLength(3);
    expect(projection.attributes[0]).toMatchObject({
      restaurant_id: 'rest-1',
      attribute_key: 'url_menu',
      value_type: 'uri',
      uri_value: 'https://example.com/menu',
      source: 'gbp',
      managed_by: 'gbp',
      source_record_id: 'locations/456/attributes/url_menu',
      change_origin: 'google',
    });
    expect(projection.attributes[1]).toMatchObject({
      attribute_key: 'has_wheelchair_accessible_entrance',
      value_type: 'boolean',
      bool_value: true,
      display_text: 'Has accessible entrance',
      display_text_negative: 'No accessible entrance',
    });
    expect(projection.attributes[2]).toMatchObject({
      attribute_key: 'payment_options',
      value_type: 'multienum',
      enum_values: ['PAY_CASH', 'PAY_CARD'],
      unset_enum_values: ['PAY_CHEQUE'],
      display_text: 'Payments: Pay Cash, Pay Card',
    });
    expect(projection.links).toEqual([
      expect.objectContaining({
        link_type: 'menu_or_services',
        label: 'Menu',
        url: 'https://example.com/menu',
        display_order: 3,
      }),
    ]);
  });

  it('returns empty rows when attributes are unavailable', () => {
    expect(
      buildCanonicalAttributeRows({
        restaurantId: 'rest-1',
        sourceRecordId: 'locations/456',
        syncedAt: '2026-05-22T07:10:00.000Z',
        startingLinkDisplayOrder: 0,
        attributes: null,
      }),
    ).toEqual({ attributes: [], links: [] });
  });
});
