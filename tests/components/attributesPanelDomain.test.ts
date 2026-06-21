import { describe, expect, it } from 'vitest';

import { AMENITY_ATTRIBUTE_GROUPS } from '@/components/features/restaurant-settings/businessContextModel';
import {
  ATTRIBUTE_ADVANCED_BOOL_OPTIONS,
  ATTRIBUTE_ADVANCED_JSON_FIELDS,
  ATTRIBUTE_ADVANCED_TEXT_FIELDS,
  ATTRIBUTE_ADVANCED_VALUE_FIELDS,
  countSelectedAmenityAttributes,
  findAmenityAttributeRow,
  getAttributeAdvancedRowDisplayState,
  getAmenityAttributeDisplayState,
} from '@/components/features/restaurant-settings/discovery/panels/attributesPanelDomain';

import type { AttributeEditor } from '@/components/features/restaurant-settings/businessContextModel';

const buildAttribute = (overrides: Partial<AttributeEditor> = {}): AttributeEditor => ({
  id: 'attribute-1',
  attributeGroup: 'Amenities',
  attributeKey: 'has_wifi',
  attributeName: '',
  attributeId: 'has_wifi',
  displayName: 'Wi-Fi',
  displayText: '',
  displayTextStandalone: '',
  displayTextNegative: '',
  valueType: '',
  boolValue: 'true',
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
});

describe('attributesPanelDomain', () => {
  it('keeps advanced attribute field specs stable', () => {
    expect(ATTRIBUTE_ADVANCED_TEXT_FIELDS.map((field) => field.field)).toEqual([
      'attributeGroup',
      'attributeKey',
      'attributeName',
      'attributeId',
      'displayName',
      'valueType',
    ]);
    expect(ATTRIBUTE_ADVANCED_VALUE_FIELDS.map((field) => field.field)).toEqual([
      'displayText',
      'displayTextStandalone',
      'displayTextNegative',
      'uriValuesText',
      'enumValuesText',
      'unsetEnumValuesText',
    ]);
    expect(ATTRIBUTE_ADVANCED_JSON_FIELDS.map((field) => field.field)).toEqual([
      'rawValueJson',
      'rawEnumValuesJson',
      'displayValueJson',
    ]);
    expect(ATTRIBUTE_ADVANCED_BOOL_OPTIONS).toEqual([
      { label: 'Unset', value: 'unset' },
      { label: 'True', value: 'true' },
      { label: 'False', value: 'false' },
    ]);
  });

  it('counts selected grouped amenities and finds rows by catalog definition', () => {
    const group = AMENITY_ATTRIBUTE_GROUPS.find((candidate) =>
      candidate.keys.some((definition) => definition.key === 'has_wifi'),
    );
    expect(group).toBeDefined();
    const definition = group?.keys.find((candidate) => candidate.key === 'has_wifi');
    expect(definition).toBeDefined();

    const attributes = [
      buildAttribute({ attributeKey: 'has_wifi', boolValue: 'true' }),
      buildAttribute({ id: 'attribute-2', attributeKey: 'serves_beer', boolValue: 'false' }),
    ];

    expect(countSelectedAmenityAttributes(group!, attributes)).toBe(1);
    expect(findAmenityAttributeRow(attributes, definition!)).toMatchObject({
      attributeKey: 'has_wifi',
    });
  });

  it('derives amenity checkbox display state defensively', () => {
    expect(getAmenityAttributeDisplayState(undefined)).toEqual({
      checked: false,
      helperText: 'Not set',
    });
    expect(getAmenityAttributeDisplayState(buildAttribute({ boolValue: 'false' }))).toEqual({
      checked: false,
      helperText: 'Saved as no',
    });
    expect(getAmenityAttributeDisplayState(buildAttribute({ boolValue: 'unset' }))).toEqual({
      checked: false,
      helperText: 'Saved detail',
    });
    expect(getAmenityAttributeDisplayState(buildAttribute({ boolValue: 'true' }))).toEqual({
      checked: true,
      helperText: 'Saved detail',
    });
  });

  it('derives advanced row display state', () => {
    expect(getAttributeAdvancedRowDisplayState(buildAttribute())).toEqual({
      title: 'Wi-Fi',
      subtitle: 'Shown in grouped amenities',
    });
    expect(
      getAttributeAdvancedRowDisplayState(
        buildAttribute({ displayName: '', attributeKey: 'custom_feature' }),
      ),
    ).toEqual({
      title: 'Custom Feature',
      subtitle: 'custom_feature',
    });
    expect(
      getAttributeAdvancedRowDisplayState(buildAttribute({ displayName: '', attributeKey: '' })),
    ).toEqual({
      title: 'New attribute',
      subtitle: 'No key set',
    });
  });
});
