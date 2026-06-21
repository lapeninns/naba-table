import { normalizeText } from './businessInfoNormalizationCore';

import type { GoogleBusinessProfileAttributesResponse } from './client';

type GoogleBusinessProfileAttribute = NonNullable<
  GoogleBusinessProfileAttributesResponse['attributes']
>[number];

export function normalizeAttributeValueMetadata(
  value:
    | Array<{
        value?: boolean | string;
        displayName?: string;
      }>
    | null
    | undefined,
) {
  return (value ?? [])
    .map((item) => {
      const normalizedValue =
        typeof item?.value === 'boolean' || typeof item?.value === 'string' ? item.value : null;
      const displayName = normalizeText(item?.displayName);

      if (normalizedValue === null && !displayName) {
        return null;
      }

      return {
        value: normalizedValue,
        displayName,
      };
    })
    .filter(
      (
        item,
      ): item is {
        value: boolean | string | null;
        displayName: string | null;
      } => Boolean(item),
    );
}

export function buildRawAttributeValueJson(attribute: GoogleBusinessProfileAttribute) {
  return {
    valueType: attribute.valueType ?? null,
    values: attribute.values ?? [],
    repeatedEnumValue: attribute.repeatedEnumValue ?? null,
    uriValue: attribute.uriValue ?? null,
    uriValues: attribute.uriValues ?? [],
    valueMetadata: attribute.valueMetadata ?? [],
  };
}

export function buildRawEnumValuesJson(input: {
  setValues: string[];
  unsetValues: string[];
  valueEnumValues: string[];
}) {
  return {
    setValues: input.setValues,
    unsetValues: input.unsetValues,
    valueEnumValues: input.valueEnumValues,
  };
}

export function buildDisplayValueJson(input: {
  displayName: string | null;
  displayStrings: GoogleBusinessProfileAttribute['displayStrings'] | undefined;
  enumValues: string[];
  unsetEnumValues: string[];
  valueDisplays: string[];
  uriValues: string[];
  valueMetadata: ReturnType<typeof normalizeAttributeValueMetadata>;
}) {
  return {
    displayName: input.displayName,
    displayStrings: input.displayStrings ?? null,
    enumValues: input.enumValues,
    unsetEnumValues: input.unsetEnumValues,
    valueDisplays: input.valueDisplays,
    uriValues: input.uriValues,
    valueMetadata: input.valueMetadata,
  };
}
