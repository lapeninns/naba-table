import { AMENITY_ATTRIBUTE_KEYS, formatAttributeTitle } from '../../businessContextModel';

import type {
  AmenityAttributeDefinition,
  AmenityAttributeGroup,
  AttributeEditor,
} from '../../businessContextModel';

export type AttributeFieldSpec = {
  label: string;
  field: keyof AttributeEditor;
};

export type AttributeBoolOption = {
  label: string;
  value: AttributeEditor['boolValue'];
};

export type AttributeAdvancedRowDisplayState = {
  title: string;
  subtitle: string;
};

export const ATTRIBUTE_ADVANCED_TEXT_FIELDS = [
  { label: 'Group', field: 'attributeGroup' },
  { label: 'Key', field: 'attributeKey' },
  { label: 'Name', field: 'attributeName' },
  { label: 'Reference ID', field: 'attributeId' },
  { label: 'Display name', field: 'displayName' },
  { label: 'Value type', field: 'valueType' },
] satisfies AttributeFieldSpec[];

export const ATTRIBUTE_ADVANCED_VALUE_FIELDS = [
  { label: 'Guest-facing text', field: 'displayText' },
  { label: 'Standalone text', field: 'displayTextStandalone' },
  { label: 'Text when unavailable', field: 'displayTextNegative' },
  { label: 'Link values, comma separated', field: 'uriValuesText' },
  { label: 'Selected values, comma separated', field: 'enumValuesText' },
  { label: 'Excluded values, comma separated', field: 'unsetEnumValuesText' },
] satisfies AttributeFieldSpec[];

export const ATTRIBUTE_ADVANCED_JSON_FIELDS = [
  { label: 'Raw value', field: 'rawValueJson' },
  { label: 'Raw selected values', field: 'rawEnumValuesJson' },
  { label: 'Display value', field: 'displayValueJson' },
] satisfies AttributeFieldSpec[];

export const ATTRIBUTE_ADVANCED_BOOL_OPTIONS = [
  { label: 'Unset', value: 'unset' },
  { label: 'True', value: 'true' },
  { label: 'False', value: 'false' },
] satisfies AttributeBoolOption[];

export type AmenityAttributeDisplayState = {
  checked: boolean;
  helperText: 'Saved as no' | 'Saved detail' | 'Not set';
};

export function findAmenityAttributeRow(
  attributes: AttributeEditor[],
  definition: AmenityAttributeDefinition,
): AttributeEditor | undefined {
  return attributes.find((row) => row.attributeKey === definition.key);
}

export function countSelectedAmenityAttributes(
  group: AmenityAttributeGroup,
  attributes: AttributeEditor[],
): number {
  return group.keys.filter(
    (definition) => findAmenityAttributeRow(attributes, definition)?.boolValue === 'true',
  ).length;
}

export function getAmenityAttributeDisplayState(
  row: AttributeEditor | undefined,
): AmenityAttributeDisplayState {
  if (!row) {
    return { checked: false, helperText: 'Not set' };
  }
  return {
    checked: row.boolValue === 'true',
    helperText: row.boolValue === 'false' ? 'Saved as no' : 'Saved detail',
  };
}

export function getAttributeAdvancedRowDisplayState(
  row: AttributeEditor,
): AttributeAdvancedRowDisplayState {
  return {
    title: formatAttributeTitle(row),
    subtitle: AMENITY_ATTRIBUTE_KEYS.has(row.attributeKey)
      ? 'Shown in grouped amenities'
      : row.attributeKey || 'No key set',
  };
}
