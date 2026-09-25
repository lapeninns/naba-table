import { describe, expect, it } from 'vitest';

import {
  addMoreHoursTypesToCategory,
  addNamedCategoryEditor,
  addNamedServiceAreaEditor,
  createAttributeEditor,
  createCategoryEditor,
  createLinkEditor,
  createServiceAreaEditor,
  createServiceItemEditor,
  hasMoreHoursTypeDraftValues,
  makePrimaryCategoryEditor,
  removeCategoryEditor,
  removeEditorRow,
  removeMoreHoursTypeFromCategory,
  setAmenityAttributeValue,
  updateEditorRow,
} from '@/components/features/restaurant-settings/businessContextEditorActions';

import type {
  AttributeEditor,
  CategoryEditor,
} from '@/components/features/restaurant-settings/businessContextModel';

function buildCategory(overrides: Partial<CategoryEditor> = {}): CategoryEditor {
  return {
    id: 'category-1',
    displayName: 'Restaurant',
    categoryCode: 'restaurant',
    isPrimary: true,
    moreHoursTypes: [
      {
        hoursTypeId: 'KITCHEN',
        displayName: 'Kitchen',
        localizedDisplayName: 'Kitchen',
      },
    ],
    moreHoursTypeDraft: 'draft',
    ...overrides,
  };
}

function buildAttribute(overrides: Partial<AttributeEditor> = {}): AttributeEditor {
  return {
    id: 'attribute-1',
    attributeGroup: '',
    attributeKey: 'has_wifi',
    attributeName: '',
    attributeId: '',
    displayName: '',
    displayText: '',
    displayTextStandalone: '',
    displayTextNegative: '',
    valueType: '',
    boolValue: 'unset',
    textValue: '',
    uriValue: '',
    uriValuesText: '',
    enumValuesText: '',
    unsetEnumValuesText: '',
    rawValueJson: '',
    rawEnumValuesJson: '',
    displayValueJson: '',
    valueMetadataJson: '',
    ...overrides,
  };
}

describe('businessContextEditorActions', () => {
  it('creates empty editor rows with the expected defaults', () => {
    expect(createLinkEditor()).toMatchObject({
      linkType: 'website',
      label: '',
      url: '',
      isPrimary: false,
    });
    expect(createCategoryEditor()).toMatchObject({
      displayName: '',
      categoryCode: '',
      isPrimary: false,
      moreHoursTypes: [],
      moreHoursTypeDraft: '',
    });
    expect(createServiceAreaEditor('Cambridge')).toMatchObject({
      displayName: 'Cambridge',
      areaType: 'region',
      placeDataJson: '',
    });
    expect(createAttributeEditor()).toMatchObject({
      valueType: 'text',
      boolValue: 'unset',
    });
    expect(createServiceItemEditor()).toMatchObject({
      itemKey: '',
      payloadJson: '',
    });
  });

  it('updates and removes editor rows by id without changing other rows', () => {
    const rows = [
      { id: 'row-1', label: 'One' },
      { id: 'row-2', label: 'Two' },
    ];

    expect(updateEditorRow(rows, 'row-2', 'label', 'Updated')).toEqual([
      { id: 'row-1', label: 'One' },
      { id: 'row-2', label: 'Updated' },
    ]);
    expect(removeEditorRow(rows, 'row-1')).toEqual([{ id: 'row-2', label: 'Two' }]);
  });

  it('adds unique more-hours chips and clears empty drafts', () => {
    const categories = [buildCategory()];

    expect(hasMoreHoursTypeDraftValues(' , ')).toBe(false);
    expect(addMoreHoursTypesToCategory(categories, 'category-1', ' , ')[0]).toMatchObject({
      moreHoursTypeDraft: '',
      moreHoursTypes: categories[0].moreHoursTypes,
    });

    expect(hasMoreHoursTypeDraftValues('kitchen, HAPPY_HOUR')).toBe(true);
    expect(
      addMoreHoursTypesToCategory(categories, 'category-1', 'kitchen, HAPPY_HOUR')[0],
    ).toMatchObject({
      moreHoursTypeDraft: '',
      moreHoursTypes: [
        {
          hoursTypeId: 'KITCHEN',
          displayName: 'Kitchen',
          localizedDisplayName: 'Kitchen',
        },
        {
          hoursTypeId: 'HAPPY_HOUR',
          displayName: null,
          localizedDisplayName: null,
        },
      ],
    });
  });

  it('removes a category more-hours chip by index', () => {
    const [category] = addMoreHoursTypesToCategory([buildCategory()], 'category-1', 'HAPPY_HOUR');

    expect(removeMoreHoursTypeFromCategory([category], 'category-1', 0)[0].moreHoursTypes).toEqual([
      {
        hoursTypeId: 'HAPPY_HOUR',
        displayName: null,
        localizedDisplayName: null,
      },
    ]);
  });

  it('sets an amenity to Yes, No or Not set from the catalogue definition', () => {
    const definition = { key: 'has_wifi', label: 'Wi-Fi' };

    const added = setAmenityAttributeValue([], definition, 'Amenities', 'true');
    expect(added).toEqual([
      expect.objectContaining({
        attributeGroup: 'Amenities',
        attributeKey: 'has_wifi',
        attributeId: 'has_wifi',
        displayName: 'Wi-Fi',
        valueType: 'boolean',
        boolValue: 'true',
      }),
    ]);
    expect(setAmenityAttributeValue([], definition, 'Amenities', 'false')).toEqual([
      expect.objectContaining({ attributeKey: 'has_wifi', boolValue: 'false' }),
    ]);
    // Not set on an amenity with no row sends nothing new.
    expect(setAmenityAttributeValue([], definition, 'Amenities', 'unset')).toEqual([]);

    const saved = buildAttribute({ id: '5b0f7f2e-1111-4c1e-9d55-000000000001' });
    const updated = setAmenityAttributeValue([saved], definition, 'Amenities', 'false');
    expect(updated).toEqual([
      expect.objectContaining({
        id: saved.id,
        attributeGroup: 'Amenities',
        attributeId: 'has_wifi',
        displayName: 'Wi-Fi',
        valueType: 'boolean',
        boolValue: 'false',
      }),
    ]);
  });

  it('keeps a saved amenity row as unknown but drops a draft-only row when set to Not set', () => {
    const definition = { key: 'has_wifi', label: 'Wi-Fi' };
    const saved = buildAttribute({
      id: '5b0f7f2e-1111-4c1e-9d55-000000000001',
      boolValue: 'true',
    });

    expect(setAmenityAttributeValue([saved], definition, 'Amenities', 'unset')).toEqual([
      expect.objectContaining({ id: saved.id, boolValue: 'unset' }),
    ]);

    const draftOnly = setAmenityAttributeValue([], definition, 'Amenities', 'true');
    expect(setAmenityAttributeValue(draftOnly, definition, 'Amenities', 'unset')).toEqual([]);
  });

  it('keeps exactly one main category as categories are added, promoted and removed', () => {
    const first = addNamedCategoryEditor([], buildCategory({ id: 'category-a', isPrimary: false }));
    expect(first.map((row) => row.isPrimary)).toEqual([true]);

    const two = addNamedCategoryEditor(first, buildCategory({ id: 'category-b', isPrimary: true }));
    expect(two.map((row) => row.isPrimary)).toEqual([true, false]);

    const promoted = makePrimaryCategoryEditor(two, 'category-b');
    expect(promoted.map((row) => [row.id, row.isPrimary])).toEqual([
      ['category-a', false],
      ['category-b', true],
    ]);

    // Removing the main category makes the first remaining one main.
    expect(removeCategoryEditor(promoted, 'category-b')).toEqual([
      expect.objectContaining({ id: 'category-a', isPrimary: true }),
    ]);
    // Removing another category leaves the main one alone.
    expect(removeCategoryEditor(promoted, 'category-a')).toEqual([
      expect.objectContaining({ id: 'category-b', isPrimary: true }),
    ]);
  });

  it('adds service areas by name without duplicates', () => {
    const cambridge = createServiceAreaEditor('Cambridge');
    const once = addNamedServiceAreaEditor([], cambridge);
    expect(once).toEqual([cambridge]);
    expect(addNamedServiceAreaEditor(once, createServiceAreaEditor(' cambridge '))).toBe(once);
    expect(addNamedServiceAreaEditor(once, createServiceAreaEditor('  '))).toBe(once);
  });
});
