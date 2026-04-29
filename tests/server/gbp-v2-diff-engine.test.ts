import { describe, expect, it } from 'vitest';

import { buildSyncV2Diff } from '@/server/google-business-profile-v2/diff/engine';

import type { SyncV2CanonicalSnapshot } from '@/server/google-business-profile-v2/snapshot/types';

function emptySnapshot(): SyncV2CanonicalSnapshot {
  return {
    profile: {
      name: null,
      businessDescription: null,
      contactPhone: null,
      address: null,
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: {
      weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        opensAt: null,
        closesAt: null,
        isClosed: true,
      })),
    },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
  };
}

describe('buildSyncV2Diff', () => {
  it('returns no diff items when both sides match', () => {
    const result = buildSyncV2Diff({ nabatable: emptySnapshot(), google: emptySnapshot() });
    expect(result.items).toHaveLength(0);
    expect(Object.values(result.bySection).every((items) => items.length === 0)).toBe(true);
  });

  it('emits a profile diff when name differs and respects push capability', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    const result = buildSyncV2Diff({
      nabatable: { ...nab, profile: { ...nab.profile, name: 'Old Crown Girton' } },
      google: { ...goo, profile: { ...goo.profile, name: 'Old Crown' } },
    });
    const profileItems = result.bySection.profile;
    expect(profileItems).toHaveLength(1);
    const [item] = profileItems;
    expect(item.fieldKey).toBe('name');
    expect(item.normalizedNabatableValue).toBe('Old Crown Girton');
    expect(item.normalizedGoogleValue).toBe('Old Crown');
    expect(item.capabilities.canImport).toBe(true);
    expect(item.capabilities.canExport).toBe(true);
    expect(item.capabilities.googleUpdateMask).toBe('title');
    expect(item.nabatableValueHash).not.toBe(item.googleValueHash);
  });

  it('covers profile description as an importable and exportable Google profile field', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    const result = buildSyncV2Diff({
      nabatable: {
        ...nab,
        profile: { ...nab.profile, businessDescription: 'Local dining and Sunday roasts.' },
      },
      google: {
        ...goo,
        profile: { ...goo.profile, businessDescription: 'Google dining description.' },
      },
    });

    const item = result.bySection.profile.find((i) => i.fieldKey === 'businessDescription');
    expect(item).toBeDefined();
    expect(item?.capabilities.canImport).toBe(true);
    expect(item?.capabilities.canExport).toBe(true);
    expect(item?.capabilities.googleUpdateMask).toBe('profile');
  });

  it('allows exporting an empty Nabatable profile description as a Google clear', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    const result = buildSyncV2Diff({
      nabatable: nab,
      google: {
        ...goo,
        profile: { ...goo.profile, businessDescription: 'Google dining description.' },
      },
    });

    const item = result.bySection.profile.find((i) => i.fieldKey === 'businessDescription');
    expect(item).toBeDefined();
    expect(item?.normalizedNabatableValue).toBeNull();
    expect(item?.capabilities.canImport).toBe(true);
    expect(item?.capabilities.canExport).toBe(true);
    expect(item?.capabilities.blockedReasons).toBeUndefined();
    expect(item?.capabilities.googleUpdateMask).toBe('profile');
  });

  it('marks read-only profile fields as not exportable', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    const result = buildSyncV2Diff({
      nabatable: {
        ...nab,
        profile: { ...nab.profile, googleMapUrl: 'https://maps.example/local' },
      },
      google: {
        ...goo,
        profile: { ...goo.profile, googleMapUrl: 'https://maps.example/global' },
      },
    });
    const item = result.bySection.profile.find((i) => i.fieldKey === 'googleMapUrl');
    expect(item).toBeDefined();
    expect(item?.capabilities.canExport).toBe(false);
    expect(item?.capabilities.blockedReasons).toContain(
      'Google Maps URL is Google-owned metadata and is not directly writable.',
    );
  });

  it('keeps flat address export blocked until structured storefront address data exists', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    const result = buildSyncV2Diff({
      nabatable: {
        ...nab,
        profile: { ...nab.profile, address: '89 High Street, Cambridge CB3 0QD' },
      },
      google: {
        ...goo,
        profile: { ...goo.profile, address: '89 High Street, Girton, Cambridge CB3 0QD' },
      },
    });
    const item = result.bySection.profile.find((i) => i.fieldKey === 'address');
    expect(item).toBeDefined();
    expect(item?.capabilities.canExport).toBe(false);
    expect(item?.capabilities.blockedReasons).toContain(
      'Address export requires an existing Google storefrontAddress with a region code.',
    );
  });

  it('allows address export when Google has a structured storefront address to preserve', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    const result = buildSyncV2Diff({
      nabatable: {
        ...nab,
        profile: { ...nab.profile, address: '89 High Street, Cambridge CB3 0QD' },
      },
      google: {
        ...goo,
        profile: {
          ...goo.profile,
          address: '89 High Street, Girton, Cambridge CB3 0QD',
          storefrontAddress: {
            addressLines: ['89 High Street'],
            locality: 'Girton',
            administrativeArea: 'Cambridge',
            postalCode: 'CB3 0QD',
            regionCode: 'GB',
            languageCode: null,
            sublocality: null,
            organization: null,
            recipients: [],
          },
        },
      },
    });
    const item = result.bySection.profile.find((i) => i.fieldKey === 'address');
    expect(item).toBeDefined();
    expect(item?.capabilities.canExport).toBe(true);
    expect(item?.capabilities.googleUpdateMask).toBe('storefrontAddress');
  });

  it('allows exporting Google-only service periods as Google deletes', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    const result = buildSyncV2Diff({
      nabatable: nab,
      google: {
        ...goo,
        servicePeriods: {
          periods: [
            {
              stableKey: '1|12:00|15:00|lunch|lunch',
              dayOfWeek: 1,
              startTime: '12:00',
              endTime: '15:00',
              bookingOption: 'lunch',
              name: 'Lunch',
            },
          ],
        },
      },
    });

    const [item] = result.bySection.servicePeriods;
    expect(item?.fieldKey).toBe('1|12:00|15:00|lunch|lunch');
    expect(item?.normalizedNabatableValue).toBeNull();
    expect(item?.capabilities.canImport).toBe(true);
    expect(item?.capabilities.canExport).toBe(true);
    expect(item?.capabilities.blockedReasons).toBeUndefined();
    expect(item?.capabilities.googleUpdateMask).toBe('moreHours');
  });

  it('allows API-shaped business context values to export to Google', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    nab.businessContext = {
      categories: [
        {
          displayName: 'Bar',
          categoryCode: 'gcid:bar',
          moreHoursTypes: [],
          isPrimary: true,
        },
      ],
      serviceAreas: [
        {
          displayName: 'Cambridge',
          areaType: 'region',
          regionCode: 'GB',
          placeData: { businessType: 'CUSTOMER_LOCATION_ONLY', regionCode: 'GB' },
        },
      ],
      attributes: [
        {
          attributeKey: 'has_takeout',
          attributeName: 'attributes/has_takeout',
          attributeId: 'attributes/has_takeout',
          valueType: 'BOOL',
          boolValue: true,
          textValue: null,
          uriValue: null,
          uriValues: [],
          enumValues: [],
          unsetEnumValues: [],
        },
      ],
      serviceItems: [
        {
          itemKey: 'service:delivery',
          itemType: 'free_form_service_item',
          displayName: 'Delivery',
          description: 'Local delivery',
          payload: {
            freeFormServiceItem: {
              category: 'Delivery',
              label: { displayName: 'Delivery', description: 'Local delivery' },
            },
          },
        },
      ],
    };
    const result = buildSyncV2Diff({ nabatable: nab, google: goo });
    expect(result.bySection['businessContext.categories'][0]?.capabilities.canExport).toBe(true);
    expect(result.bySection['businessContext.serviceAreas'][0]?.capabilities.canExport).toBe(true);
    expect(result.bySection['businessContext.attributes'][0]?.capabilities.canExport).toBe(true);
    expect(result.bySection['businessContext.serviceItems'][0]?.capabilities.canExport).toBe(true);
  });

  it('blocks business context export when required Google payload data is missing', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    nab.businessContext = {
      ...nab.businessContext,
      categories: [
        { displayName: 'Bar', categoryCode: null, moreHoursTypes: [], isPrimary: false },
      ],
      serviceItems: [
        {
          itemKey: 'delivery',
          itemType: null,
          displayName: 'Delivery',
          description: null,
          payload: null,
        },
      ],
    };
    const result = buildSyncV2Diff({ nabatable: nab, google: goo });
    expect(result.bySection['businessContext.categories'][0]?.capabilities.canExport).toBe(false);
    expect(result.bySection['businessContext.serviceItems'][0]?.capabilities.canExport).toBe(false);
  });

  it('allows exporting a Nabatable-null business-context decision as a Google delete', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    goo.businessContext = {
      ...goo.businessContext,
      categories: [
        {
          displayName: 'Bar',
          categoryCode: 'gcid:bar',
          moreHoursTypes: [],
          isPrimary: false,
        },
      ],
    };
    const result = buildSyncV2Diff({ nabatable: nab, google: goo });
    const cat = result.bySection['businessContext.categories'][0];
    expect(cat?.normalizedNabatableValue).toBeNull();
    expect(cat?.capabilities.canImport).toBe(true);
    expect(cat?.capabilities.canExport).toBe(true);
  });

  it('keeps engine-wide ordering: profile first, then operatingHours, then service periods, then business context', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    nab.profile = { ...nab.profile, name: 'A' };
    goo.profile = { ...goo.profile, name: 'B' };
    nab.operatingHours.weekly[3] = {
      dayOfWeek: 3,
      opensAt: '10:00',
      closesAt: '18:00',
      isClosed: false,
    } as never;
    nab.businessContext = {
      ...nab.businessContext,
      categories: [
        {
          displayName: 'Pub',
          categoryCode: 'gcid:pub',
          moreHoursTypes: [],
          isPrimary: true,
        },
      ],
    };
    const result = buildSyncV2Diff({ nabatable: nab, google: goo });
    const sectionOrder = result.items.map((i) => i.sectionKey);
    expect(sectionOrder).toEqual(['profile', 'operatingHours', 'businessContext.categories']);
  });

  it('marks business-context items present only in Nabatable as import-blocked but export-capable when payload data is available', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    nab.businessContext = {
      ...nab.businessContext,
      categories: [
        {
          displayName: 'Bar',
          categoryCode: 'gcid:bar',
          moreHoursTypes: [],
          isPrimary: false,
        },
      ],
    };
    const result = buildSyncV2Diff({ nabatable: nab, google: goo });
    const cat = result.bySection['businessContext.categories'][0];
    expect(cat).toBeDefined();
    expect(cat?.normalizedNabatableValue).toBeTruthy();
    expect(cat?.normalizedGoogleValue).toBeNull();
    expect(cat?.capabilities.canImport).toBe(false);
    expect(cat?.capabilities.canExport).toBe(true);
    expect(cat?.capabilities.googleUpdateMask).toBe('categories');
  });

  it('emits per-day operating hours diffs only for differing days', () => {
    const nab = emptySnapshot();
    const goo = emptySnapshot();
    nab.operatingHours.weekly[1] = {
      dayOfWeek: 1,
      opensAt: '09:00',
      closesAt: '17:00',
      isClosed: false,
    } as never;
    const result = buildSyncV2Diff({ nabatable: nab, google: goo });
    expect(result.bySection.operatingHours).toHaveLength(1);
    expect(result.bySection.operatingHours[0]?.fieldKey).toBe('monday');
    expect(result.bySection.operatingHours[0]?.capabilities.googleUpdateMask).toBe('regularHours');
  });
});
