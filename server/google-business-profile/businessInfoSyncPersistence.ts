import {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
  type CanonicalSyncRows,
} from './businessInfoCanonicalRows';
import { buildPayloadHash, toJson } from './businessInfoNormalization';

import type { FieldSyncStatusInsert, ProviderRowTable } from './businessInfoFieldSyncStatus';
import type {
  GoogleBusinessProfileAttributesResponse,
  GoogleBusinessProfileLocationProfile,
} from './client';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type RestaurantAttributeDefinitionRow =
  Database['public']['Tables']['restaurant_attribute_definitions']['Row'];
type RestaurantProfileChangeLogInsert =
  Database['public']['Tables']['restaurant_profile_change_log']['Insert'];
type CanonicalBusinessInfoReplacementRpcClient = DbClient & {
  rpc(
    fn: 'replace_gbp_canonical_business_info',
    args: {
      p_restaurant_id: string;
      p_external_profile_id: string;
      p_location_snapshot: Json;
      p_location_source_revision: string | null;
      p_location_payload_hash: string;
      p_attributes_snapshot: Json | null;
      p_attributes_source_revision: string | null;
      p_attributes_payload_hash: string | null;
      p_business_details: Json | null;
      p_addresses: Json;
      p_phone_numbers: Json;
      p_links: Json;
      p_categories: Json;
      p_service_areas: Json;
      p_hours: Json;
      p_attributes: Json | null;
      p_service_items: Json | null;
      p_field_sync_statuses: Json;
      p_field_sync_entity_tables: string[];
      p_profile_change_log_rows: Json;
    },
  ): Promise<{ error: { message?: string } | null }>;
};

export function isMissingOptionalProfileTableError(error: unknown, tableName: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : null;

  return Boolean(message?.includes(tableName)) && (code === '42P01' || code === 'PGRST205');
}

export function isMissingFieldSyncStatusesTableError(error: unknown): boolean {
  return isMissingOptionalProfileTableError(error, 'restaurant_field_sync_statuses');
}

export async function upsertBusinessDetails(
  restaurantId: string,
  details: CanonicalSyncRows['details'],
  client: DbClient,
) {
  if (!details) {
    const { error } = await client
      .from('restaurant_business_details')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('source', GBP_SOURCE)
      .eq('managed_by', GBP_MANAGED_BY);

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await client.from('restaurant_business_details').upsert(details, {
    onConflict: 'restaurant_id,source,managed_by',
  });

  if (error) {
    throw error;
  }
}

export async function linkAttributeDefinitions(
  rows: CanonicalSyncRows['attributes'],
  client: DbClient,
): Promise<CanonicalSyncRows['attributes']> {
  if (rows.length === 0) {
    return rows;
  }

  const attributeKeys = [...new Set(rows.map((row) => row.attribute_key).filter(Boolean))];
  if (attributeKeys.length === 0) {
    return rows;
  }

  const { data, error } = await client
    .from('restaurant_attribute_definitions')
    .select('id, attribute_key, provider_attribute_id')
    .eq('provider', 'google_business_profile')
    .in('attribute_key', attributeKeys);

  if (error) {
    if (isMissingOptionalProfileTableError(error, 'restaurant_attribute_definitions')) {
      return rows;
    }
    throw error;
  }

  const byAttributeKey = new Map<string, RestaurantAttributeDefinitionRow>();
  for (const definition of data ?? []) {
    byAttributeKey.set(definition.attribute_key, definition as RestaurantAttributeDefinitionRow);
  }

  return rows.map((row) => ({
    ...row,
    attribute_definition_id: byAttributeKey.get(row.attribute_key)?.id ?? null,
  }));
}

export function buildProfileChangeLogRows(params: {
  restaurantId: string;
  externalProfileId: string;
  syncedAt: string;
  rows: CanonicalSyncRows;
  syncAttributes: boolean;
  syncServiceItems: boolean;
}): RestaurantProfileChangeLogInsert[] {
  const tableRows: Array<{
    table: ProviderRowTable | 'restaurant_business_details';
    value: unknown;
    rowCount: number;
  }> = [
    {
      table: 'restaurant_business_details',
      value: params.rows.details,
      rowCount: params.rows.details ? 1 : 0,
    },
    {
      table: 'restaurant_addresses',
      value: params.rows.addresses,
      rowCount: params.rows.addresses.length,
    },
    {
      table: 'restaurant_phone_numbers',
      value: params.rows.phoneNumbers,
      rowCount: params.rows.phoneNumbers.length,
    },
    { table: 'restaurant_links', value: params.rows.links, rowCount: params.rows.links.length },
    {
      table: 'restaurant_categories',
      value: params.rows.categories,
      rowCount: params.rows.categories.length,
    },
    {
      table: 'restaurant_service_areas',
      value: params.rows.serviceAreas,
      rowCount: params.rows.serviceAreas.length,
    },
    { table: 'restaurant_hours', value: params.rows.hours, rowCount: params.rows.hours.length },
    ...(params.syncAttributes
      ? [
          {
            table: 'restaurant_attributes' as const,
            value: params.rows.attributes,
            rowCount: params.rows.attributes.length,
          },
        ]
      : []),
    ...(params.syncServiceItems
      ? [
          {
            table: 'restaurant_service_items' as const,
            value: params.rows.serviceItems,
            rowCount: params.rows.serviceItems.length,
          },
        ]
      : []),
  ];

  return tableRows
    .filter((entry) => entry.rowCount > 0)
    .map((entry) => ({
      restaurant_id: params.restaurantId,
      entity_table: entry.table,
      field_path: '$',
      old_value: null,
      new_value: entry.value as RestaurantProfileChangeLogInsert['new_value'],
      change_origin: GBP_CHANGE_PROVENANCE.change_origin,
      changed_via: GBP_CHANGE_PROVENANCE.changed_via,
      change_reason: GBP_CHANGE_PROVENANCE.change_reason,
      external_profile_id: params.externalProfileId,
      external_provider: 'google_business_profile',
      status: 'applied',
      detected_at: params.syncedAt,
      applied_at: params.syncedAt,
      metadata: {
        syncWriter: 'syncGoogleBusinessProfileCanonicalBusinessInfo',
        rowCount: entry.rowCount,
      },
    }));
}

export async function insertProfileChangeLogRows(
  rows: RestaurantProfileChangeLogInsert[],
  client: DbClient,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from('restaurant_profile_change_log').insert(rows);
  if (error) {
    if (isMissingOptionalProfileTableError(error, 'restaurant_profile_change_log')) {
      return;
    }
    throw error;
  }
}

export async function replaceProviderFieldSyncStatuses(
  restaurantId: string,
  rows: FieldSyncStatusInsert[],
  entityTables: string[],
  client: DbClient,
) {
  let deleteQuery = client
    .from('restaurant_field_sync_statuses')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('provider', GBP_SOURCE);

  if (entityTables.length > 0) {
    deleteQuery = deleteQuery.in('entity_table', entityTables);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    if (isMissingFieldSyncStatusesTableError(deleteError)) {
      return;
    }
    throw deleteError;
  }

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await client.from('restaurant_field_sync_statuses').insert(rows);

  if (insertError) {
    if (isMissingFieldSyncStatusesTableError(insertError)) {
      return;
    }
    throw insertError;
  }
}

export async function replaceGoogleBusinessProfileCanonicalBusinessInfo(params: {
  restaurantId: string;
  externalProfileId: string;
  locationSnapshot: GoogleBusinessProfileLocationProfile;
  locationSourceRevision: string | null;
  attributesSnapshot: GoogleBusinessProfileAttributesResponse | null;
  attributesSourceRevision: string | null;
  rows: CanonicalSyncRows;
  fieldSyncStatuses: FieldSyncStatusInsert[];
  fieldSyncEntityTables: string[];
  profileChangeLogRows: RestaurantProfileChangeLogInsert[];
  syncAttributes: boolean;
  syncServiceItems: boolean;
  client: DbClient;
}) {
  const { error } = await (params.client as CanonicalBusinessInfoReplacementRpcClient).rpc(
    'replace_gbp_canonical_business_info',
    {
      p_restaurant_id: params.restaurantId,
      p_external_profile_id: params.externalProfileId,
      p_location_snapshot: toJson(params.locationSnapshot),
      p_location_source_revision: params.locationSourceRevision,
      p_location_payload_hash: buildPayloadHash(params.locationSnapshot),
      p_attributes_snapshot:
        params.syncAttributes && params.attributesSnapshot
          ? toJson(params.attributesSnapshot)
          : null,
      p_attributes_source_revision:
        params.syncAttributes && params.attributesSnapshot ? params.attributesSourceRevision : null,
      p_attributes_payload_hash:
        params.syncAttributes && params.attributesSnapshot
          ? buildPayloadHash(params.attributesSnapshot)
          : null,
      p_business_details: params.rows.details ? toJson(params.rows.details) : null,
      p_addresses: toJson(params.rows.addresses),
      p_phone_numbers: toJson(params.rows.phoneNumbers),
      p_links: toJson(params.rows.links),
      p_categories: toJson(params.rows.categories),
      p_service_areas: toJson(params.rows.serviceAreas),
      p_hours: toJson(params.rows.hours),
      p_attributes: params.syncAttributes ? toJson(params.rows.attributes) : null,
      p_service_items: params.syncServiceItems ? toJson(params.rows.serviceItems) : null,
      p_field_sync_statuses: toJson(params.fieldSyncStatuses),
      p_field_sync_entity_tables: params.fieldSyncEntityTables,
      p_profile_change_log_rows: toJson(params.profileChangeLogRows),
    },
  );

  if (error) {
    throw error;
  }
}
