import { describe, expect, it } from 'vitest';

import {
  buildFoodMenuItemStableKey,
  buildServicePeriodStableKey,
  findFoodMenuItemDriftField,
  findServicePeriodDriftField,
  slugifyDualSyncDisplay,
} from '@/components/features/restaurant-settings/gbpDriftDomain';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

describe('gbpDriftDomain', () => {
  it('slugifies display values for stable dual-sync keys', () => {
    expect(slugifyDualSyncDisplay('  Nepalese & Indian Specials!  ')).toBe(
      'nepalese-indian-specials',
    );
    expect(slugifyDualSyncDisplay('---')).toBe('');
  });

  it('builds and matches service-period stable keys from field keys or payload stable keys', () => {
    const identity = {
      bookingOption: 'lunch',
      dayOfWeek: 1,
      endTime: '14:00',
      name: 'Lunch',
      startTime: '12:00',
    };
    const stableKey = buildServicePeriodStableKey(identity);

    expect(stableKey).toBe('1|12:00|14:00|lunch|lunch');
    expect(
      findServicePeriodDriftField(
        [
          driftField({
            fieldKey: `servicePeriods.${stableKey}`,
            sectionKey: 'servicePeriods',
          }),
        ],
        identity,
      )?.fieldKey,
    ).toBe(`servicePeriods.${stableKey}`);

    expect(
      findServicePeriodDriftField(
        [
          driftField({
            coreValue: { stableKey },
            fieldKey: 'servicePeriods.generated',
            sectionKey: 'servicePeriods',
          }),
        ],
        identity,
      )?.fieldKey,
    ).toBe('servicePeriods.generated');
  });

  it('matches service-period drift fields by core or GBP value identity when stable keys are absent', () => {
    const identity = {
      bookingOption: 'dinner',
      dayOfWeek: 5,
      endTime: '21:00',
      name: 'Dinner',
      startTime: '17:00',
    };

    expect(
      findServicePeriodDriftField(
        [
          driftField({
            fieldKey: 'servicePeriods.value-match',
            gbpValue: {
              bookingOption: 'dinner',
              dayOfWeek: 5,
              endTime: '21:00',
              name: ' dinner ',
              startTime: '17:00',
            },
            sectionKey: 'servicePeriods',
          }),
        ],
        identity,
      )?.fieldKey,
    ).toBe('servicePeriods.value-match');
  });

  it('builds and matches food-menu item keys, legacy keys, and item ids', () => {
    const identity = {
      externalItemId: 'item-77',
      itemId: 'local-77',
      menuId: null,
      menuLabel: 'Main Menu',
      sectionId: null,
      sectionLabel: 'Chef Specials',
    };
    const stableKey = buildFoodMenuItemStableKey(identity);

    expect(stableKey).toBe('foodMenu.menu.main-menu.section.chef-specials.item.item-77');
    expect(
      findFoodMenuItemDriftField(
        [
          driftField({
            coreValue: { stableKey },
            fieldKey: 'foodMenus.stable',
            sectionKey: 'foodMenus',
          }),
        ],
        identity,
      )?.fieldKey,
    ).toBe('foodMenus.stable');

    expect(
      findFoodMenuItemDriftField(
        [
          driftField({
            coreValue: { localItemId: 'local-77' },
            fieldKey: 'foodMenus.local-id',
            sectionKey: 'foodMenus',
          }),
        ],
        identity,
      )?.fieldKey,
    ).toBe('foodMenus.local-id');
  });
});

function driftField(overrides: Partial<DualSyncFieldSummary>): DualSyncFieldSummary {
  return {
    coreStatus: 'present',
    coreValue: null,
    fieldKey: 'field',
    gbpStatus: 'present',
    gbpValue: null,
    label: 'Field',
    liveStatus: 'drifted',
    savedNeedsReview: true,
    sectionKey: 'servicePeriods',
    ...overrides,
  } as DualSyncFieldSummary;
}
