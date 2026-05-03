import { describe, expect, it } from 'vitest';

import {
  buildAttributeFields,
  buildCategoryFields,
  buildFoodMenuItemFields,
  buildRegistry,
  buildServiceAreaFields,
  buildServiceItemFields,
  buildServicePeriodFields,
  CORE_ONLY_FIELDS,
  findFieldConfig,
  OPERATING_HOURS_FIELDS,
  PROFILE_FIELDS,
  resolveFieldCapability,
} from '@/server/dual-sync/registry';

const emptySnapshot = {
  profile: null,
  operatingHours: { weekly: [] },
  servicePeriods: { periods: [] },
  businessContext: {
    categories: [],
    serviceAreas: [],
    attributes: [],
    serviceItems: [],
  },
} as const;

describe('dual-sync registry', () => {
  it('exposes a profile field per syncable scalar', () => {
    const keys = PROFILE_FIELDS.map((entry) => entry.fieldKey);
    expect(keys).toEqual([
      'profile.name',
      'profile.businessDescription',
      'profile.contactPhone',
      'profile.address',
      'profile.googleMapUrl',
      'profile.googleReviewUrl',
    ]);
  });

  it('emits one weekly operating-hours entry per day', () => {
    expect(OPERATING_HOURS_FIELDS).toHaveLength(7);
    const dayKeys = OPERATING_HOURS_FIELDS.map((entry) => entry.fieldKey);
    expect(dayKeys).toEqual([
      'operatingHours.weekly.0',
      'operatingHours.weekly.1',
      'operatingHours.weekly.2',
      'operatingHours.weekly.3',
      'operatingHours.weekly.4',
      'operatingHours.weekly.5',
      'operatingHours.weekly.6',
    ]);
  });

  it('marks core-only fields as unsupported', () => {
    expect(CORE_ONLY_FIELDS.length).toBeGreaterThan(0);
    for (const entry of CORE_ONLY_FIELDS) {
      expect(entry.conflictPolicy).toBe('unsupported');
      expect(entry.importable).toBe(false);
      expect(entry.exportable).toBe(false);
    }
  });

  it('builds dynamic service-period fields keyed off the union of stable keys', () => {
    const fields = buildServicePeriodFields({
      coreSnapshot: {
        periods: [
          {
            stableKey: '0|18:00|22:00|dinner|kitchen',
            name: 'Kitchen',
            dayOfWeek: 0,
            startTime: '18:00',
            endTime: '22:00',
            bookingOption: 'dinner',
          },
        ],
      },
      gbpSnapshot: {
        periods: [
          {
            stableKey: '6|11:00|14:00|brunch|brunch',
            name: 'Brunch',
            dayOfWeek: 6,
            startTime: '11:00',
            endTime: '14:00',
            bookingOption: 'brunch',
          },
        ],
      },
    });
    expect(fields).toHaveLength(2);
    expect(fields.map((f) => f.fieldKey).sort()).toEqual([
      'servicePeriods.0|18:00|22:00|dinner|kitchen',
      'servicePeriods.6|11:00|14:00|brunch|brunch',
    ]);
  });

  it('builds dynamic business-context fields keyed off the union of slugs / keys', () => {
    expect(
      buildCategoryFields({
        coreSnapshot: [
          {
            displayName: 'Restaurant',
            categoryCode: 'restaurant',
            isPrimary: true,
            moreHoursTypes: [],
          },
        ],
        gbpSnapshot: [
          { displayName: 'Bar', categoryCode: 'bar', isPrimary: false, moreHoursTypes: [] },
        ],
      }).map((f) => f.fieldKey),
    ).toEqual(['businessContext.categories.bar', 'businessContext.categories.restaurant']);

    expect(
      buildServiceAreaFields({
        coreSnapshot: [
          { displayName: 'London', areaType: 'place', regionCode: 'GB', placeData: null },
        ],
        gbpSnapshot: [],
      }).map((f) => f.fieldKey),
    ).toEqual(['businessContext.serviceAreas.london']);

    expect(
      buildAttributeFields({
        coreSnapshot: [
          {
            attributeKey: 'has_wifi',
            attributeName: 'Wi-Fi',
            attributeId: null,
            valueType: 'BOOL',
            boolValue: true,
            textValue: null,
            uriValue: null,
            uriValues: [],
            enumValues: [],
            unsetEnumValues: [],
          },
        ],
        gbpSnapshot: [],
      }).map((f) => f.fieldKey),
    ).toEqual(['businessContext.attributes.has_wifi']);

    expect(
      buildServiceItemFields({
        coreSnapshot: [
          {
            itemKey: 'item:bar/cocktails',
            itemType: 'STANDARD',
            displayName: 'Cocktails',
            description: null,
            payload: null,
          },
        ],
        gbpSnapshot: [],
      }).map((f) => f.fieldKey),
    ).toEqual(['businessContext.serviceItems.item:bar/cocktails']);
  });

  it('builds dynamic FoodMenus fields keyed off stable projected item identities', () => {
    const fields = buildFoodMenuItemFields({
      coreSnapshot: {
        items: [
          {
            stableKey: 'foodMenu.item.starters/vegetarian.starter-paneer',
            itemName: 'Chilli Paneer',
            sectionLabel: 'Starters - Vegetarian',
            description: 'Crisp paneer',
            basePrice: 8.95,
            currency: 'GBP',
            dietaryTags: ['Vegetarian'],
            allergensContains: ['Milk'],
            googlePath: 'menus[0].sections[0].items[0]',
          },
        ],
      },
      gbpSnapshot: {
        items: [
          {
            stableKey: 'foodMenu.item.mains/default.tikka-masala',
            itemName: 'Tikka Masala',
            sectionLabel: 'Mains',
            description: 'Google description',
            basePrice: 12.5,
            currency: 'GBP',
            dietaryTags: [],
            allergensContains: ['Milk'],
            googlePath: 'menus[0].sections[1].items[0]',
          },
        ],
      },
    });

    expect(fields.map((field) => field.fieldKey)).toEqual([
      'foodMenus.items.mains.foodMenu_item_mains/default_tikka-masala',
      'foodMenus.items.starters-vegetarian.foodMenu_item_starters/vegetarian_starter-paneer',
    ]);
    expect(fields[0]).toMatchObject({
      sectionKey: 'foodMenus',
      kind: 'foodMenu.item',
      importable: true,
      exportable: true,
      googleUpdateMask: 'menus',
      conflictPolicy: 'manual',
      deletePolicy: 'manual',
    });
  });

  it('composes the static + dynamic registry deterministically', () => {
    const registry = buildRegistry({
      coreSnapshot: {
        ...emptySnapshot,
        foodMenus: {
          items: [
            {
              stableKey: 'foodMenu.item.starters/default.chilli-paneer',
              itemName: 'Chilli Paneer',
              sectionLabel: 'Starters',
              description: null,
              basePrice: 8.95,
              currency: 'GBP',
              dietaryTags: [],
              allergensContains: [],
              googlePath: null,
            },
          ],
        },
      },
      gbpSnapshot: emptySnapshot,
    });
    const fieldKeys = new Set(registry.map((f) => f.fieldKey));
    expect(fieldKeys.has('profile.name')).toBe(true);
    expect(fieldKeys.has('operatingHours.weekly.0')).toBe(true);
    expect(
      fieldKeys.has('foodMenus.items.starters.foodMenu_item_starters/default_chilli-paneer'),
    ).toBe(true);
    expect(fieldKeys.has('core.bookingPolicy')).toBe(true);
  });

  it('finds a config by fieldKey or returns null', () => {
    const registry = buildRegistry({ coreSnapshot: emptySnapshot, gbpSnapshot: emptySnapshot });
    expect(findFieldConfig(registry, 'profile.name')?.label).toBe('Business name');
    expect(findFieldConfig(registry, 'profile.unknown')).toBeNull();
  });

  it('resolves capability flags using importable/exportable + value presence', () => {
    const config = PROFILE_FIELDS.find((f) => f.fieldKey === 'profile.contactPhone')!;
    expect(
      resolveFieldCapability({ config, coreValue: '+44 1', gbpValue: '+44 1' }).canImport,
    ).toBe(true);
    expect(resolveFieldCapability({ config, coreValue: null, gbpValue: '+44 1' }).canExport).toBe(
      false,
    );
    expect(resolveFieldCapability({ config, coreValue: '+44 1', gbpValue: null }).canImport).toBe(
      false,
    );
  });
});
