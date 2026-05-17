import { describe, expect, it } from 'vitest';

import { compareCanonical, valuesMatch } from '@/lib/dual-sync/compare-field';
import { isGbpComparableSection } from '@/lib/dual-sync/field-key-meta';

describe('dual-sync compare field', () => {
  it('compares profile text, phone, URL, and import-only fields with field-specific canonicalizers', () => {
    expect(valuesMatch('profile.name', ' The Bell  Inn ', 'the bell inn')).toBe(true);
    expect(valuesMatch('profile.businessDescription', 'Fresh food', 'fresh food')).toBe(false);
    expect(valuesMatch('profile.contactPhone', '+44 (0) 1223 123456', '+4401223123456')).toBe(true);
    expect(valuesMatch('profile.address', '1 High   Street', '1 high street')).toBe(true);
    expect(
      valuesMatch(
        'profile.googleMapUrl',
        'https://www.google.com/maps/place/The+Bell/0x123:0x456',
        'https://google.com/maps/place/The+Bell/0x123:0x456',
      ),
    ).toBe(true);
    expect(
      valuesMatch('profile.googleReviewUrl', 'https://g.page/the-bell/review', 'gpage:bad'),
    ).toBe(false);
  });

  it('compares weekly operating hours as canonical day objects', () => {
    expect(
      valuesMatch(
        'operatingHours.weekly.1',
        { opensAt: '09:00', closesAt: '17:00', isClosed: false },
        { opensAt: '09:00', closesAt: '17:00', isClosed: 0 },
      ),
    ).toBe(true);
    expect(
      valuesMatch(
        'operatingHours.weekly.1',
        { opensAt: '09:00', closesAt: '17:00', isClosed: false },
        { opensAt: '10:00', closesAt: '17:00', isClosed: false },
      ),
    ).toBe(false);
  });

  it('compares canonical food menu items with sorted arrays and rounded numeric values', () => {
    const local = {
      stableKey: 'item-1',
      itemName: '  Fish  Pie ',
      sectionLabel: ' Mains ',
      description: 'Smoked haddock',
      basePrice: 13.001,
      currency: 'gbp',
      dietaryTags: [' Vegetarian ', 'Gluten Free'],
      allergensContains: ['Milk', ' fish '],
    };
    const google = {
      stableKey: 'item-1',
      itemName: 'fish pie',
      sectionLabel: 'mains',
      description: 'smoked haddock',
      basePrice: 13,
      currency: 'GBP',
      dietaryTags: ['gluten free', 'vegetarian'],
      allergensContains: ['fish', 'milk'],
    };

    const result = compareCanonical('foodMenus.items.mains.item-1', local, google);
    expect(result.matches).toBe(true);
  });

  it('recognizes only GBP-comparable sections', () => {
    expect(isGbpComparableSection('profile')).toBe(true);
    expect(isGbpComparableSection('foodMenus')).toBe(true);
    expect(isGbpComparableSection('core_only')).toBe(false);
  });
});
