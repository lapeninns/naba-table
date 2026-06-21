import { describe, expect, it } from 'vitest';

import {
  CATEGORY_TEXT_FIELDS,
  getCategoryRowTitle,
  getMoreHoursTypeDisplayState,
} from '@/components/features/restaurant-settings/discovery/panels/categoriesPanelDomain';

import type { CategoryEditor } from '@/components/features/restaurant-settings/businessContextModel';

const buildCategory = (overrides: Partial<CategoryEditor> = {}): CategoryEditor => ({
  id: 'category-1',
  displayName: 'Restaurant',
  categoryCode: 'restaurant',
  isPrimary: false,
  moreHoursTypes: [],
  moreHoursTypeDraft: '',
  ...overrides,
});

describe('categoriesPanelDomain', () => {
  it('keeps category field specs stable', () => {
    expect(CATEGORY_TEXT_FIELDS.map((field) => field.field)).toEqual([
      'displayName',
      'categoryCode',
    ]);
    expect(CATEGORY_TEXT_FIELDS.find((field) => field.field === 'categoryCode')?.helpText).toBe(
      'Optional provider identifier. Leave blank if the category name is enough.',
    );
  });

  it('derives row titles from the shared category title helper', () => {
    expect(getCategoryRowTitle(buildCategory())).toBe('Restaurant');
    expect(getCategoryRowTitle(buildCategory({ displayName: '', isPrimary: true }))).toBe(
      'Primary category',
    );
    expect(getCategoryRowTitle(buildCategory({ displayName: '' }))).toBe('New category');
  });

  it('derives more-hours badge display with empty-label fallbacks', () => {
    expect(
      getMoreHoursTypeDisplayState({
        hoursTypeId: 'KITCHEN_HOURS',
        displayName: 'Kitchen hours',
        localizedDisplayName: 'Kitchen',
      }),
    ).toEqual({
      label: 'KITCHEN_HOURS',
      badgeText: 'KITCHEN_HOURS',
      removeLabel: 'KITCHEN_HOURS',
    });
    expect(
      getMoreHoursTypeDisplayState({
        hoursTypeId: '',
        displayName: '',
        localizedDisplayName: '',
      }),
    ).toEqual({
      label: '',
      badgeText: 'Unnamed type',
      removeLabel: 'more-hours type',
    });
  });
});
