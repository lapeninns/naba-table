import { describe, expect, it } from 'vitest';

import { AMENITY_ATTRIBUTE_GROUPS } from '@/components/features/restaurant-settings/businessContextModel';
import {
  ATTRIBUTE_ADVANCED_BOOL_OPTIONS,
  ATTRIBUTE_ADVANCED_JSON_FIELDS,
  ATTRIBUTE_ADVANCED_TEXT_FIELDS,
  ATTRIBUTE_ADVANCED_VALUE_FIELDS,
  AMENITY_VALUE_OPTIONS,
  countSetAmenityAttributes,
  findAmenityAttributeRow,
  getAmenityAttributeValue,
  getAmenityValueLabel,
  getAttributeAdvancedRowDisplayState,
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
      { label: 'Not set', value: 'unset' },
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ]);
    expect(AMENITY_VALUE_OPTIONS.map((option) => option.label)).toEqual(['Yes', 'No', 'Not set']);
  });

  it('counts amenities answered Yes or No as set and finds rows by catalog definition', () => {
    const group = AMENITY_ATTRIBUTE_GROUPS.find((candidate) =>
      candidate.keys.some((definition) => definition.key === 'has_wifi'),
    );
    expect(group).toBeDefined();
    const definition = group?.keys.find((candidate) => candidate.key === 'has_wifi');
    expect(definition).toBeDefined();

    const attributes = [
      buildAttribute({ attributeKey: 'has_wifi', boolValue: 'true' }),
      buildAttribute({ id: 'attribute-2', attributeKey: 'has_restroom', boolValue: 'false' }),
      buildAttribute({ id: 'attribute-3', attributeKey: 'good_for_kids', boolValue: 'unset' }),
      buildAttribute({ id: 'attribute-4', attributeKey: 'serves_beer', boolValue: 'true' }),
    ];

    // Yes and No count as set; "Not set" and other groups' amenities do not.
    expect(countSetAmenityAttributes(group!, attributes)).toBe(2);
    expect(findAmenityAttributeRow(attributes, definition!)).toMatchObject({
      attributeKey: 'has_wifi',
    });
  });

  it('reads an amenity as Yes, No or Not set, treating a missing row as Not set', () => {
    expect(getAmenityAttributeValue(undefined)).toBe('unset');
    expect(getAmenityAttributeValue(buildAttribute({ boolValue: 'false' }))).toBe('false');
    expect(getAmenityAttributeValue(buildAttribute({ boolValue: 'true' }))).toBe('true');
    expect(getAmenityValueLabel('true')).toBe('Yes');
    expect(getAmenityValueLabel('false')).toBe('No');
    expect(getAmenityValueLabel('unset')).toBe('Not set');
  });

  it('derives advanced row display state', () => {
    expect(getAttributeAdvancedRowDisplayState(buildAttribute())).toEqual({
      title: 'Wi-Fi',
      subtitle: 'Also shown in the amenity list above',
      subtitleIsKey: false,
    });
    expect(
      getAttributeAdvancedRowDisplayState(
        buildAttribute({ displayName: '', attributeKey: 'custom_feature' }),
      ),
    ).toEqual({
      title: 'Custom Feature',
      subtitle: 'custom_feature',
      subtitleIsKey: true,
    });
    expect(
      getAttributeAdvancedRowDisplayState(buildAttribute({ displayName: '', attributeKey: '' })),
    ).toEqual({
      title: 'New attribute',
      subtitle: 'No key set',
      subtitleIsKey: false,
    });
  });
});
