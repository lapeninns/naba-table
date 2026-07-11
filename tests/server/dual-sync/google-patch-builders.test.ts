import { describe, expect, it } from 'vitest';

import {
  buildGoogleAttribute,
  buildGoogleCategoriesPatch,
  buildGoogleCategoryPayload,
  buildGoogleServiceAreaPatch,
  buildGoogleServiceItemsPatch,
  buildGoogleStorefrontAddressPatch,
  googleBusinessTypeForServiceAreas,
  normalizeAttributeName,
  normalizeGoogleCategoryName,
} from '@/server/dual-sync/publish/ports/google-patch-builders';

import type {
  DualSyncAttributeValue,
  DualSyncCategoryValue,
  DualSyncProfileSectionValue,
  DualSyncServiceAreaValue,
  DualSyncServiceItemValue,
} from '@/server/dual-sync/snapshots/types';

function category(overrides: Partial<DualSyncCategoryValue> = {}): DualSyncCategoryValue {
  return {
    displayName: 'Nepalese restaurant',
    categoryCode: 'gcid:nepalese_restaurant',
    moreHoursTypes: [],
    isPrimary: false,
    ...overrides,
  };
}

function serviceArea(overrides: Partial<DualSyncServiceAreaValue> = {}): DualSyncServiceAreaValue {
  return {
    displayName: 'Cambridge',
    areaType: 'place',
    regionCode: null,
    placeData: null,
    ...overrides,
  };
}

function serviceItem(overrides: Partial<DualSyncServiceItemValue> = {}): DualSyncServiceItemValue {
  return {
    itemKey: 'job_type:dine_in',
    itemType: 'structured',
    displayName: 'Dine in',
    description: null,
    payload: { structuredServiceItem: { serviceTypeId: 'job_type:dine_in' } },
    ...overrides,
  };
}

function attribute(overrides: Partial<DualSyncAttributeValue> = {}): DualSyncAttributeValue {
  return {
    attributeKey: 'wi_fi',
    attributeName: null,
    attributeId: null,
    valueType: 'BOOL',
    boolValue: null,
    textValue: null,
    uriValue: null,
    uriValues: [],
    enumValues: [],
    unsetEnumValues: [],
    ...overrides,
  } as DualSyncAttributeValue;
}

const googleAddress: NonNullable<DualSyncProfileSectionValue['storefrontAddress']> = {
  addressLines: ['1 Old Lane'],
  locality: 'Cambridge',
  administrativeArea: 'Cambridgeshire',
  postalCode: 'CB1 1AA',
  regionCode: 'GB',
  languageCode: 'en',
  sublocality: null,
  organization: null,
  recipients: [],
};

describe('normalizeGoogleCategoryName', () => {
  it('prefixes bare category codes and preserves already-prefixed ones @contract', () => {
    expect(normalizeGoogleCategoryName('gcid:restaurant')).toBe('categories/gcid:restaurant');
    expect(normalizeGoogleCategoryName('categories/gcid:restaurant')).toBe(
      'categories/gcid:restaurant',
    );
    expect(normalizeGoogleCategoryName('  categories/gcid:cafe  ')).toBe('categories/gcid:cafe');
  });

  it('returns null for null, empty, and whitespace-only codes @contract', () => {
    expect(normalizeGoogleCategoryName(null)).toBeNull();
    expect(normalizeGoogleCategoryName('')).toBeNull();
    expect(normalizeGoogleCategoryName('   ')).toBeNull();
  });
});

describe('buildGoogleCategoryPayload', () => {
  it('maps display name and omits empty more-hours fields per type @contract', () => {
    const payload = buildGoogleCategoryPayload(
      category({
        moreHoursTypes: [
          { hoursTypeId: 'DELIVERY', displayName: 'Delivery', localizedDisplayName: null },
          { hoursTypeId: null, displayName: null, localizedDisplayName: 'Brunch' },
        ],
      }),
    );

    expect(payload).toEqual({
      name: 'categories/gcid:nepalese_restaurant',
      displayName: 'Nepalese restaurant',
      moreHoursTypes: [
        { hoursTypeId: 'DELIVERY', displayName: 'Delivery' },
        { localizedDisplayName: 'Brunch' },
      ],
    });
  });

  it('rejects categories without a Google category code @contract', () => {
    expect(() => buildGoogleCategoryPayload(category({ categoryCode: null }))).toThrow(
      'Category "Nepalese restaurant" requires a Google category code.',
    );
    expect(() => buildGoogleCategoryPayload(category({ categoryCode: '  ' }))).toThrow(
      /requires a Google category code/,
    );
  });
});

describe('buildGoogleCategoriesPatch', () => {
  it('promotes the flagged primary and keeps the rest as additional categories @contract', () => {
    const secondary = category({ displayName: 'Cafe', categoryCode: 'gcid:cafe' });
    const primary = category({
      displayName: 'Restaurant',
      categoryCode: 'gcid:restaurant',
      isPrimary: true,
    });

    const patch = buildGoogleCategoriesPatch([secondary, primary]);

    expect(patch.primaryCategory.name).toBe('categories/gcid:restaurant');
    expect(patch.additionalCategories).toHaveLength(1);
    expect(patch.additionalCategories[0]?.name).toBe('categories/gcid:cafe');
  });

  it('falls back to the first category when no primary is flagged @contract', () => {
    const patch = buildGoogleCategoriesPatch([
      category({ displayName: 'Cafe', categoryCode: 'gcid:cafe' }),
      category({ displayName: 'Bar', categoryCode: 'gcid:bar' }),
    ]);

    expect(patch.primaryCategory.name).toBe('categories/gcid:cafe');
    expect(patch.additionalCategories.map((entry) => entry.name)).toEqual(['categories/gcid:bar']);
  });

  it('keeps a single category patch with no additional categories @contract', () => {
    const patch = buildGoogleCategoriesPatch([category({ isPrimary: true })]);

    expect(patch.additionalCategories).toEqual([]);
  });

  it('rejects an empty category list @contract', () => {
    expect(() => buildGoogleCategoriesPatch([])).toThrow(
      'At least one category is required before exporting categories to Google.',
    );
  });
});

describe('googleBusinessTypeForServiceAreas', () => {
  it('uses the first non-empty businessType from place data @contract', () => {
    const areas = [
      serviceArea({ placeData: { businessType: '   ' } }),
      serviceArea({ placeData: { businessType: 'CUSTOMER_AND_BUSINESS_LOCATION' } }),
      serviceArea({ placeData: { businessType: 'CUSTOMER_LOCATION_ONLY' } }),
    ];

    expect(googleBusinessTypeForServiceAreas(areas)).toBe('CUSTOMER_AND_BUSINESS_LOCATION');
  });

  it('defaults to CUSTOMER_LOCATION_ONLY when no area declares a type @contract', () => {
    expect(googleBusinessTypeForServiceAreas([])).toBe('CUSTOMER_LOCATION_ONLY');
    expect(
      googleBusinessTypeForServiceAreas([
        serviceArea({ placeData: null }),
        serviceArea({ placeData: { businessType: 42 } }),
      ]),
    ).toBe('CUSTOMER_LOCATION_ONLY');
  });
});

describe('buildGoogleServiceAreaPatch', () => {
  it('builds businessType, regionCode, and placeInfos from populated areas @contract', () => {
    const patch = buildGoogleServiceAreaPatch([
      serviceArea({
        regionCode: 'GB',
        placeData: { placeName: 'Cambridge', placeId: 'place-1', businessType: 'CUSTOMER_LOCATION_ONLY' },
      }),
      serviceArea({ placeData: { placeName: 'Ely', placeId: 'place-2' } }),
    ]);

    expect(patch).toEqual({
      businessType: 'CUSTOMER_LOCATION_ONLY',
      regionCode: 'GB',
      places: {
        placeInfos: [
          { placeName: 'Cambridge', placeId: 'place-1', businessType: 'CUSTOMER_LOCATION_ONLY' },
          { placeName: 'Ely', placeId: 'place-2' },
        ],
      },
    });
  });

  it('falls back to a trimmed placeData regionCode when no area-level code exists @contract', () => {
    const patch = buildGoogleServiceAreaPatch([
      serviceArea({ placeData: { regionCode: '  GB  ' } }),
    ]);

    expect(patch.regionCode).toBe('GB');
  });

  it('omits regionCode and places for areas with empty place data @contract', () => {
    const patch = buildGoogleServiceAreaPatch([
      serviceArea({ placeData: {} }),
      serviceArea({ placeData: null }),
    ]);

    expect(patch).toEqual({ businessType: 'CUSTOMER_LOCATION_ONLY' });
  });

  it('rejects an empty service-area list @contract', () => {
    expect(() => buildGoogleServiceAreaPatch([])).toThrow(
      'At least one service area is required before exporting service areas to Google.',
    );
  });
});

describe('buildGoogleServiceItemsPatch', () => {
  it('passes canonical payloads through unchanged and preserves order @contract', () => {
    const first = serviceItem();
    const second = serviceItem({
      itemKey: 'job_type:takeout',
      payload: { structuredServiceItem: { serviceTypeId: 'job_type:takeout' } },
    });

    expect(buildGoogleServiceItemsPatch([first, second])).toEqual([
      first.payload,
      second.payload,
    ]);
  });

  it('maps an empty selection to an empty patch @contract', () => {
    expect(buildGoogleServiceItemsPatch([])).toEqual([]);
  });

  it('rejects items with missing or empty payloads @contract', () => {
    expect(() => buildGoogleServiceItemsPatch([serviceItem({ payload: null })])).toThrow(
      'Service item "job_type:dine_in" requires a canonical Google payload.',
    );
    expect(() => buildGoogleServiceItemsPatch([serviceItem({ payload: {} })])).toThrow(
      /requires a canonical Google payload/,
    );
  });
});

describe('normalizeAttributeName', () => {
  it('prefers attributeName, then attributeId, then attributeKey @contract', () => {
    expect(
      normalizeAttributeName(
        attribute({ attributeName: 'attributes/wi_fi', attributeId: 'ignored', attributeKey: 'ignored-too' }),
      ),
    ).toBe('attributes/wi_fi');
    expect(normalizeAttributeName(attribute({ attributeId: 'has_delivery' }))).toBe(
      'attributes/has_delivery',
    );
    expect(normalizeAttributeName(attribute({ attributeKey: 'serves_beer' }))).toBe(
      'attributes/serves_beer',
    );
  });

  it('rescopes location-scoped attribute resource names @contract', () => {
    expect(
      normalizeAttributeName(attribute({ attributeName: 'locations/123/attributes/wi_fi' })),
    ).toBe('attributes/wi_fi');
  });

  it('rejects attributes whose identifiers are all blank @contract', () => {
    expect(() =>
      normalizeAttributeName(attribute({ attributeName: '  ', attributeId: '', attributeKey: '  ' })),
    ).toThrow(/requires a Google attribute name/);
  });
});

describe('buildGoogleAttribute', () => {
  it('builds bool attributes and rejects missing boolean values @contract', () => {
    expect(buildGoogleAttribute(attribute({ valueType: 'BOOL', boolValue: false }))).toEqual({
      name: 'attributes/wi_fi',
      values: [{ boolValue: false }],
    });
    expect(() => buildGoogleAttribute(attribute({ valueType: 'BOOL', boolValue: null }))).toThrow(
      'Attribute "wi_fi" requires a boolean value.',
    );
  });

  it('merges and dedupes URL attribute values @contract', () => {
    expect(
      buildGoogleAttribute(
        attribute({
          valueType: 'URL',
          uriValue: 'https://menu.example',
          uriValues: ['https://menu.example', 'https://order.example'],
        }),
      ),
    ).toEqual({
      name: 'attributes/wi_fi',
      uriValues: [{ uri: 'https://menu.example' }, { uri: 'https://order.example' }],
    });
    expect(() => buildGoogleAttribute(attribute({ valueType: 'URL' }))).toThrow(
      'Attribute "wi_fi" requires at least one URL.',
    );
  });

  it('builds repeated enum attributes from set and unset value IDs @contract', () => {
    expect(
      buildGoogleAttribute(
        attribute({
          valueType: 'REPEATED_ENUM',
          enumValues: ['serves_beer'],
          unsetEnumValues: ['serves_wine'],
        }),
      ),
    ).toEqual({
      name: 'attributes/wi_fi',
      repeatedEnumValue: { setValues: ['serves_beer'], unsetValues: ['serves_wine'] },
    });
  });

  it('rejects enum attributes with no values or display-label leakage @contract', () => {
    expect(() =>
      buildGoogleAttribute(attribute({ valueType: 'REPEATED_ENUM', enumValues: [], unsetEnumValues: [] })),
    ).toThrow(/requires raw Google enum value IDs/);
    expect(() =>
      buildGoogleAttribute(attribute({ valueType: 'REPEATED_ENUM', enumValues: ['Serves Beer'] })),
    ).toThrow(/requires raw Google enum value IDs/);
  });

  it('falls back to string values for text attributes and rejects empty text @contract', () => {
    expect(buildGoogleAttribute(attribute({ valueType: 'TEXT', textValue: 'Rooftop' }))).toEqual({
      name: 'attributes/wi_fi',
      values: [{ stringValue: 'Rooftop' }],
    });
    expect(() => buildGoogleAttribute(attribute({ valueType: 'TEXT', textValue: null }))).toThrow(
      'Attribute "wi_fi" requires a text value.',
    );
  });
});

describe('buildGoogleStorefrontAddressPatch', () => {
  it('overlays the trimmed Nabatable address onto the Google address context @contract', () => {
    const patch = buildGoogleStorefrontAddressPatch({
      nabatableAddress: '  2 New Street  ',
      googleAddress: googleAddress,
    });

    expect(patch).toEqual({
      addressLines: ['2 New Street'],
      locality: 'Cambridge',
      administrativeArea: 'Cambridgeshire',
      postalCode: 'CB1 1AA',
      regionCode: 'GB',
      languageCode: 'en',
      recipients: [],
    });
  });

  it('rejects blank Nabatable addresses @contract', () => {
    expect(() =>
      buildGoogleStorefrontAddressPatch({ nabatableAddress: null, googleAddress }),
    ).toThrow('Address export requires a Nabatable address value.');
    expect(() =>
      buildGoogleStorefrontAddressPatch({ nabatableAddress: '   ', googleAddress }),
    ).toThrow(/requires a Nabatable address value/);
  });

  it('rejects exports without an existing Google region code @contract', () => {
    expect(() =>
      buildGoogleStorefrontAddressPatch({ nabatableAddress: '2 New Street', googleAddress: null }),
    ).toThrow('Address export requires an existing Google storefrontAddress region code.');
    expect(() =>
      buildGoogleStorefrontAddressPatch({
        nabatableAddress: '2 New Street',
        googleAddress: { ...googleAddress, regionCode: null },
      }),
    ).toThrow(/requires an existing Google storefrontAddress region code/);
  });
});
