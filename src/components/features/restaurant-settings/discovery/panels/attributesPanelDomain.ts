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
  /** The subtitle is the machine key, shown in the mono font. */
  subtitleIsKey: boolean;
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

/** Yes / No / Not set, in the order the amenity radios show them. "Not set" means unknown. */
export const AMENITY_VALUE_OPTIONS = [
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
  { label: 'Not set', value: 'unset' },
] satisfies AttributeBoolOption[];

export const ATTRIBUTE_ADVANCED_BOOL_OPTIONS = [
  { label: 'Not set', value: 'unset' },
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
] satisfies AttributeBoolOption[];

export function getAmenityValueLabel(value: AttributeEditor['boolValue']): string {
  return AMENITY_VALUE_OPTIONS.find((option) => option.value === value)?.label ?? 'Not set';
}

export function findAmenityAttributeRow(
  attributes: AttributeEditor[],
  definition: AmenityAttributeDefinition,
): AttributeEditor | undefined {
  return attributes.find((row) => row.attributeKey === definition.key);
}

/** Amenities in a group with a Yes or No answer ("N of M set"). */
export function countSetAmenityAttributes(
  group: AmenityAttributeGroup,
  attributes: AttributeEditor[],
): number {
  return group.keys.filter((definition) => {
    const value = findAmenityAttributeRow(attributes, definition)?.boolValue;
    return value === 'true' || value === 'false';
  }).length;
}

export function getAmenityAttributeValue(
  row: AttributeEditor | undefined,
): AttributeEditor['boolValue'] {
  return row?.boolValue ?? 'unset';
}

export function getAttributeAdvancedRowDisplayState(
  row: AttributeEditor,
): AttributeAdvancedRowDisplayState {
  const inCatalogue = AMENITY_ATTRIBUTE_KEYS.has(row.attributeKey);
  return {
    title: formatAttributeTitle(row),
    subtitle: inCatalogue
      ? 'Also shown in the amenity list above'
      : row.attributeKey || 'No key set',
    subtitleIsKey: !inCatalogue && Boolean(row.attributeKey),
  };
}
