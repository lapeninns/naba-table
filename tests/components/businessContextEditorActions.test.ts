import { describe, expect, it } from 'vitest';

import {
  addMoreHoursTypesToCategory,
  createAttributeEditor,
  createCategoryEditor,
  createLinkEditor,
  createServiceAreaEditor,
  createServiceItemEditor,
  hasMoreHoursTypeDraftValues,
  removeEditorRow,
  removeMoreHoursTypeFromCategory,
  toggleAmenityAttributeEditor,
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

  it('adds and updates amenity attributes from catalog definitions', () => {
    const definition = {
      key: 'has_wifi',
      label: 'Wi-Fi',
      valueType: 'boolean' as const,
    };

    const added = toggleAmenityAttributeEditor([], definition, 'Amenities', true);
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

    const updated = toggleAmenityAttributeEditor(
      [buildAttribute()],
      definition,
      'Amenities',
      false,
    );
    expect(updated).toEqual([
      expect.objectContaining({
        id: 'attribute-1',
        attributeGroup: 'Amenities',
        attributeId: 'has_wifi',
        displayName: 'Wi-Fi',
        valueType: 'boolean',
        boolValue: 'false',
      }),
    ]);
  });
});
