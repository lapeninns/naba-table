import { buildFieldStatusLookupKey, getAttributeEntityKey } from './businessInfoFieldSyncStatus';
import { normalizeJsonArray, normalizeRecord, normalizeText } from './businessInfoNormalization';
import {
  combineFieldVerifications,
  resolveFieldVerification,
} from './businessInfoReadModelVerification';

import type { GoogleBusinessProfileBusinessInfo } from './businessInfoReadModel';
import type { Database } from '@/types/supabase';

type RestaurantAttributeRow = Database['public']['Tables']['restaurant_attributes']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export function mapAttribute(
  row: RestaurantAttributeRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['attributes'][number] {
  const enumValues = Array.isArray(row.enum_values)
    ? row.enum_values.filter((value): value is string => typeof value === 'string')
    : [];
  const entityTable = 'restaurant_attributes';
  const entityKey = getAttributeEntityKey({
    attributeKey: row.attribute_key,
  });
  return {
    id: row.id,
    attributeGroup: row.attribute_group,
    attributeKey: row.attribute_key,
    attributeName: row.attribute_name,
    attributeId: row.attribute_id,
    displayName: row.display_name,
    displayText: row.display_text,
    displayTextStandalone: row.display_text_standalone,
    displayTextNegative: row.display_text_negative,
    valueType: row.value_type,
    boolValue: row.bool_value,
    textValue: row.text_value,
    uriValue: row.uri_value,
    uriValues: Array.isArray(row.uri_values)
      ? row.uri_values.filter((value): value is string => typeof value === 'string')
      : [],
    enumValues,
    unsetEnumValues: Array.isArray(row.unset_enum_values)
      ? row.unset_enum_values.filter((value): value is string => typeof value === 'string')
      : [],
    rawValue: normalizeRecord(row.raw_value_json),
    rawEnumValues: normalizeRecord(row.raw_enum_values_json),
    displayValue: normalizeRecord(row.display_value_json),
    valueMetadata: normalizeJsonArray(row.value_metadata_json, (item) => {
      const record = normalizeRecord(item);
      if (!record) {
        return null;
      }

      const value =
        typeof record.value === 'boolean' || typeof record.value === 'string' ? record.value : null;
      const displayName =
        typeof record.displayName === 'string' ? normalizeText(record.displayName) : null;

      if (value === null && !displayName) {
        return null;
      }

      return {
        value,
        displayName,
      };
    }),
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'attribute_name')),
        row.attribute_name,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'attribute_id')),
        row.attribute_id,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_name')),
        row.display_name,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_text')),
        row.display_text,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_text_standalone')),
        row.display_text_standalone,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_text_negative')),
        row.display_text_negative,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'bool_value')),
        row.bool_value,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'text_value')),
        row.text_value,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'uri_value')),
        row.uri_value,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'uri_values')),
        row.uri_values,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'enum_values')),
        enumValues,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'unset_enum_values')),
        row.unset_enum_values,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'value_metadata_json')),
        row.value_metadata_json,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'raw_value_json')),
        row.raw_value_json,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'raw_enum_values_json')),
        row.raw_enum_values_json,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_value_json')),
        row.display_value_json,
      ),
    ]),
  };
}
