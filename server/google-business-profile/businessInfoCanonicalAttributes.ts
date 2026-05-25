import {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
} from './businessInfoCanonicalConstants';
import {
  buildAttributeDisplayText,
  deriveLinkTypeFromAttribute,
  extractLastSegment,
  normalizeAttributeValueType,
} from './businessInfoCanonicalHelpers';
import { humanizeIdentifier } from './businessInfoLabelNormalization';
import {
  buildDisplayValueJson,
  buildRawAttributeValueJson,
  buildRawEnumValuesJson,
  normalizeAttributeValueMetadata,
  normalizeStringArray,
  normalizeText,
  uniqueStrings,
} from './businessInfoNormalization';

import type { GoogleBusinessProfileAttributesResponse } from './client';
import type { Database } from '@/types/supabase';

type AttributeInsert = Database['public']['Tables']['restaurant_attributes']['Insert'];
type LinkInsert = Database['public']['Tables']['restaurant_links']['Insert'];

export type CanonicalAttributeRowsResult = {
  attributes: AttributeInsert[];
  links: LinkInsert[];
};

export function buildCanonicalAttributeRows(input: {
  restaurantId: string;
  attributes: GoogleBusinessProfileAttributesResponse | null;
  sourceRecordId: string | null;
  syncedAt: string;
  startingLinkDisplayOrder: number;
}): CanonicalAttributeRowsResult {
  const attributeRows: AttributeInsert[] = [];
  const links: LinkInsert[] = [];

  for (const [index, attribute] of (input.attributes?.attributes ?? []).entries()) {
    const attributeKey =
      extractLastSegment(attribute.attributeId) ??
      extractLastSegment(attribute.name) ??
      `attribute_${index}`;
    const displayName = normalizeText(attribute.displayName) ?? humanizeIdentifier(attributeKey);
    const rawSetEnumValues = normalizeStringArray(attribute.repeatedEnumValue?.setValues);
    const rawUnsetEnumValues = normalizeStringArray(attribute.repeatedEnumValue?.unsetValues);
    const rawValueEnumValues = normalizeStringArray(
      (attribute.values ?? []).map((value) => value?.enumValue?.value ?? null),
    );
    const enumValues = uniqueStrings([...rawSetEnumValues, ...rawValueEnumValues]);
    const displayEnumValues = uniqueStrings([
      ...rawSetEnumValues.map((value) => humanizeIdentifier(extractLastSegment(value)) ?? value),
      ...normalizeStringArray(
        (attribute.values ?? [])
          .map((value) => {
            if (typeof value?.displayName === 'string') {
              return value.displayName;
            }
            if (value?.enumValue?.displayName) {
              return value.enumValue.displayName;
            }
            if (typeof value?.stringValue === 'string') {
              return value.stringValue;
            }
            return null;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    ]);

    const boolValue =
      typeof attribute.values?.[0]?.boolValue === 'boolean'
        ? attribute.values[0].boolValue
        : typeof attribute.valueMetadata?.[0]?.value === 'boolean'
          ? attribute.valueMetadata[0].value
          : null;
    const textValue =
      normalizeText(attribute.values?.[0]?.stringValue) ??
      normalizeText(attribute.values?.[0]?.displayName) ??
      null;
    const uriValue =
      normalizeText(attribute.uriValue) ?? normalizeText(attribute.uriValues?.[0]?.uri) ?? null;
    const uriValues = normalizeStringArray(
      (attribute.uriValues ?? []).map((item) => item.uri ?? null),
    );
    const unsetEnumValues = rawUnsetEnumValues;
    const displayUnsetEnumValues = rawUnsetEnumValues.map(
      (value) => humanizeIdentifier(extractLastSegment(value)) ?? value,
    );
    const valueMetadata = normalizeAttributeValueMetadata(attribute.valueMetadata);
    const valueType = normalizeAttributeValueType(attribute.valueType);
    const positiveLabel =
      normalizeText(attribute.displayStrings?.standaloneText) ??
      normalizeText(attribute.displayName);
    const negativeLabel = normalizeText(attribute.displayStrings?.negativeText);
    const displayText = buildAttributeDisplayText({
      displayName,
      boolValue,
      textValue: boolValue === null ? textValue : null,
      uriValue,
      enumValues: displayEnumValues,
      positiveLabel,
      negativeLabel,
    });
    const attributeSourceRecordId =
      normalizeText(attribute.name) ?? normalizeText(attribute.attributeId) ?? input.sourceRecordId;

    attributeRows.push({
      restaurant_id: input.restaurantId,
      attribute_group: normalizeText(attribute.groupDisplayName),
      attribute_key: attributeKey,
      attribute_name: normalizeText(attribute.name),
      attribute_id: normalizeText(attribute.attributeId),
      display_name: displayName,
      value_type: valueType,
      bool_value: boolValue,
      text_value: boolValue === null ? textValue : null,
      uri_value: uriValue,
      uri_values: uriValues,
      enum_values: enumValues,
      unset_enum_values: unsetEnumValues,
      value_metadata_json: valueMetadata,
      raw_value_json: buildRawAttributeValueJson(attribute) as AttributeInsert['raw_value_json'],
      raw_enum_values_json: buildRawEnumValuesJson({
        setValues: rawSetEnumValues,
        unsetValues: rawUnsetEnumValues,
        valueEnumValues: rawValueEnumValues,
      }) as AttributeInsert['raw_enum_values_json'],
      display_value_json: buildDisplayValueJson({
        displayName,
        displayStrings: attribute.displayStrings,
        enumValues: displayEnumValues,
        unsetEnumValues: displayUnsetEnumValues,
        valueDisplays: displayEnumValues,
        uriValues,
        valueMetadata,
      }) as AttributeInsert['display_value_json'],
      display_text: displayText,
      display_text_standalone: positiveLabel,
      display_text_negative: negativeLabel,
      display_order: index,
      source: GBP_SOURCE,
      source_record_id: attributeSourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: input.syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    });

    if (uriValue) {
      links.push({
        restaurant_id: input.restaurantId,
        link_type: deriveLinkTypeFromAttribute(attributeKey),
        link_status: 'current',
        label: displayName,
        url: uriValue,
        is_primary: false,
        display_order: input.startingLinkDisplayOrder + links.length,
        source: GBP_SOURCE,
        source_record_id: attributeSourceRecordId,
        managed_by: GBP_MANAGED_BY,
        last_synced_at: input.syncedAt,
        ...GBP_CHANGE_PROVENANCE,
      });
    }
  }

  return {
    attributes: attributeRows,
    links,
  };
}
