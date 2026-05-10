import { randomUUID } from 'node:crypto';

import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type BusinessDetailsRow = Database['public']['Tables']['restaurant_business_details']['Row'];
type CategoryRow = Database['public']['Tables']['restaurant_categories']['Row'];
type ServiceAreaRow = Database['public']['Tables']['restaurant_service_areas']['Row'];
type AttributeRow = Database['public']['Tables']['restaurant_attributes']['Row'];
type ServiceItemRow = Database['public']['Tables']['restaurant_service_items']['Row'];
type LinkRow = Database['public']['Tables']['restaurant_links']['Row'];
type ProfileChangeLogInsert =
  Database['public']['Tables']['restaurant_profile_change_log']['Insert'];

const CORE_SOURCE = 'nabatable';
const PROVIDER_SOURCE = 'gbp';
const CORE_MANAGED_BY = 'nabatable';
const MANAGED_LINK_TYPES = [
  'website',
  'menu_or_services',
  'reservation',
  'order',
  'chat',
  'facebook',
  'instagram',
  'x',
  'youtube',
  'tiktok',
  'linkedin',
  'other',
] as const;
const DEFAULT_OWNER_PROVENANCE = {
  changeOrigin: 'owner',
  changedVia: 'ops_business_context',
  changeReason: 'Owner/admin business-context update.',
} as const;

type BusinessContextMoreHoursType = {
  hoursTypeId: string | null;
  displayName: string | null;
  localizedDisplayName: string | null;
};

type BusinessContextValueMetadata = {
  value: boolean | string | null;
  displayName: string | null;
};

export type RestaurantBusinessContextSnapshot = {
  core: {
    businessDetails?: {
      id: string;
      openingDate: string | null;
      businessStatus: string | null;
      isServiceAreaBusiness: boolean;
      source: string;
      managedBy: string;
      updatedAt: string | null;
    } | null;
    links?: Array<{
      id: string;
      linkType: string;
      linkStatus: string;
      label: string | null;
      url: string;
      isPrimary: boolean;
      source: string;
      managedBy: string;
      updatedAt: string | null;
    }>;
    categories: Array<{
      id: string;
      displayName: string;
      categoryCode: string | null;
      moreHoursTypes: BusinessContextMoreHoursType[];
      isPrimary: boolean;
      source: string;
      managedBy: string;
      updatedAt: string | null;
    }>;
    serviceAreas: Array<{
      id: string;
      displayName: string;
      areaType: string;
      regionCode: string | null;
      googlePlaceId: string | null;
      googlePlaceResourceName: string | null;
      placeData: Record<string, unknown> | null;
      source: string;
      managedBy: string;
      updatedAt: string | null;
    }>;
    attributes: Array<{
      id: string;
      attributeGroup: string | null;
      attributeKey: string;
      attributeName: string | null;
      attributeId: string | null;
      displayName: string | null;
      displayText: string | null;
      displayTextStandalone: string | null;
      displayTextNegative: string | null;
      valueType: string;
      boolValue: boolean | null;
      textValue: string | null;
      uriValue: string | null;
      uriValues: string[];
      enumValues: string[];
      unsetEnumValues: string[];
      rawValue: Record<string, unknown> | null;
      rawEnumValues: Record<string, unknown> | null;
      displayValue: Record<string, unknown> | null;
      valueMetadata: BusinessContextValueMetadata[];
      source: string;
      managedBy: string;
      updatedAt: string | null;
    }>;
    serviceItems: Array<{
      id: string;
      itemKey: string;
      itemType: string | null;
      displayName: string | null;
      description: string | null;
      payload: Record<string, unknown> | null;
      source: string;
      managedBy: string;
      updatedAt: string | null;
    }>;
  };
  providerSnapshot: RestaurantBusinessContextSnapshot['core'];
};

export type UpdateRestaurantBusinessContextInput = Partial<{
  businessDetails: {
    openingDate?: string | null;
    businessStatus?: string | null;
    isServiceAreaBusiness?: boolean;
  };
  links: Array<{
    id?: string;
    linkType: string;
    linkStatus?: string | null;
    label?: string | null;
    url: string;
    isPrimary?: boolean;
  }>;
  categories: Array<{
    id?: string;
    displayName: string;
    categoryCode?: string | null;
    moreHoursTypes?: BusinessContextMoreHoursType[];
    isPrimary?: boolean;
  }>;
  serviceAreas: Array<{
    id?: string;
    displayName: string;
    areaType?: string;
    regionCode?: string | null;
    googlePlaceId?: string | null;
    googlePlaceResourceName?: string | null;
    placeData?: Record<string, unknown> | null;
  }>;
  attributes: Array<{
    id?: string;
    attributeGroup?: string | null;
    attributeKey: string;
    attributeName?: string | null;
    attributeId?: string | null;
    displayName?: string | null;
    displayText?: string | null;
    displayTextStandalone?: string | null;
    displayTextNegative?: string | null;
    valueType: string;
    boolValue?: boolean | null;
    textValue?: string | null;
    uriValue?: string | null;
    uriValues?: string[];
    enumValues?: string[];
    unsetEnumValues?: string[];
    rawValue?: Record<string, unknown> | null;
    rawEnumValues?: Record<string, unknown> | null;
    displayValue?: Record<string, unknown> | null;
    valueMetadata?: BusinessContextValueMetadata[];
  }>;
  serviceItems: Array<{
    id?: string;
    itemKey: string;
    itemType?: string | null;
    displayName?: string | null;
    description?: string | null;
    payload?: Record<string, unknown> | null;
  }>;
}>;

export type RestaurantBusinessContextChangeProvenance = {
  changeOrigin?: 'google' | 'owner' | 'api' | 'suggestion' | 'system' | 'import';
  changedByUserId?: string | null;
  changedVia?: string | null;
  changeReason?: string | null;
  externalProfileId?: string | null;
  externalProvider?: string | null;
  draftId?: string | null;
  publishJobId?: string | null;
  publishEventId?: string | null;
};

function resolveChangeProvenance(
  provenance: RestaurantBusinessContextChangeProvenance | undefined,
) {
  return {
    change_origin: provenance?.changeOrigin ?? DEFAULT_OWNER_PROVENANCE.changeOrigin,
    changed_by_user_id: provenance?.changedByUserId ?? null,
    changed_via: provenance?.changedVia ?? DEFAULT_OWNER_PROVENANCE.changedVia,
    change_reason: provenance?.changeReason ?? DEFAULT_OWNER_PROVENANCE.changeReason,
  };
}

function isMissingProfileChangeLogTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : null;

  return (
    Boolean(message?.includes('restaurant_profile_change_log')) &&
    (code === '42P01' || code === 'PGRST205')
  );
}

async function insertBusinessContextChangeLogRows(
  rows: ProfileChangeLogInsert[],
  client: DbClient,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from('restaurant_profile_change_log').insert(rows);
  if (error) {
    if (isMissingProfileChangeLogTableError(error)) {
      return;
    }
    throw error;
  }
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeText(typeof item === 'string' ? item : null))
    .filter((item): item is string => Boolean(item));
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeMoreHoursTypes(value: unknown): BusinessContextMoreHoursType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = normalizeRecord(item);
      if (!record) {
        return null;
      }

      const hoursTypeId = normalizeText(
        typeof record.hoursTypeId === 'string' ? record.hoursTypeId : null,
      );
      const displayName = normalizeText(
        typeof record.displayName === 'string' ? record.displayName : null,
      );
      const localizedDisplayName = normalizeText(
        typeof record.localizedDisplayName === 'string' ? record.localizedDisplayName : null,
      );

      if (!hoursTypeId && !displayName && !localizedDisplayName) {
        return null;
      }

      return {
        hoursTypeId,
        displayName,
        localizedDisplayName,
      };
    })
    .filter((item): item is BusinessContextMoreHoursType => item !== null);
}

function normalizeValueMetadata(value: unknown): BusinessContextValueMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = normalizeRecord(item);
      if (!record) {
        return null;
      }

      const normalizedValue =
        typeof record.value === 'boolean' || typeof record.value === 'string' ? record.value : null;
      const displayName = normalizeText(
        typeof record.displayName === 'string' ? record.displayName : null,
      );

      if (normalizedValue === null && !displayName) {
        return null;
      }

      return {
        value: normalizedValue,
        displayName,
      };
    })
    .filter((item): item is BusinessContextValueMetadata => item !== null);
}

function mapBusinessDetails(row: BusinessDetailsRow) {
  return {
    id: row.id,
    openingDate: row.opening_date,
    businessStatus: row.business_status,
    isServiceAreaBusiness: row.is_service_area_business,
    source: row.source,
    managedBy: row.managed_by,
    updatedAt: row.updated_at ?? null,
  };
}

function mapLink(row: LinkRow) {
  return {
    id: row.id,
    linkType: row.link_type,
    linkStatus: row.link_status,
    label: row.label,
    url: row.url,
    isPrimary: row.is_primary,
    source: row.source,
    managedBy: row.managed_by,
    updatedAt: row.updated_at ?? null,
  };
}

function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    categoryCode: row.category_code,
    moreHoursTypes: normalizeMoreHoursTypes(row.more_hours_types_json),
    isPrimary: row.is_primary,
    source: row.source,
    managedBy: row.managed_by,
    updatedAt: row.updated_at ?? null,
  };
}

function mapServiceArea(row: ServiceAreaRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    areaType: row.area_type,
    regionCode: row.region_code,
    googlePlaceId: row.google_place_id,
    googlePlaceResourceName: row.google_place_resource_name,
    placeData: normalizeRecord(row.place_data_json),
    source: row.source,
    managedBy: row.managed_by,
    updatedAt: row.updated_at ?? null,
  };
}

function mapAttribute(row: AttributeRow) {
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
    uriValues: normalizeStringArray(row.uri_values),
    enumValues: normalizeStringArray(row.enum_values),
    unsetEnumValues: normalizeStringArray(row.unset_enum_values),
    rawValue: normalizeRecord(row.raw_value_json),
    rawEnumValues: normalizeRecord(row.raw_enum_values_json),
    displayValue: normalizeRecord(row.display_value_json),
    valueMetadata: normalizeValueMetadata(row.value_metadata_json),
    source: row.source,
    managedBy: row.managed_by,
    updatedAt: row.updated_at ?? null,
  };
}

function mapServiceItem(row: ServiceItemRow) {
  return {
    id: row.id,
    itemKey: row.item_key,
    itemType: row.item_type,
    displayName: row.display_name,
    description: row.description,
    payload: normalizeRecord(row.payload_json),
    source: row.source,
    managedBy: row.managed_by,
    updatedAt: row.updated_at ?? null,
  };
}

function emptyFamily(): RestaurantBusinessContextSnapshot['core'] {
  return {
    businessDetails: null,
    links: [],
    categories: [],
    serviceAreas: [],
    attributes: [],
    serviceItems: [],
  };
}

function splitRows<T extends { source: string }>(rows: T[]): { core: T[]; providerSnapshot: T[] } {
  return rows.reduce(
    (acc, row) => {
      if (row.source === PROVIDER_SOURCE) {
        acc.providerSnapshot.push(row);
      } else if (row.source === CORE_SOURCE) {
        acc.core.push(row);
      }
      return acc;
    },
    { core: [] as T[], providerSnapshot: [] as T[] },
  );
}

type ProviderDeleteQuery = PromiseLike<{ error: unknown }> & {
  eq: (column: string, value: string) => ProviderDeleteQuery;
};

type MutableTableName =
  | 'restaurant_categories'
  | 'restaurant_service_areas'
  | 'restaurant_attributes'
  | 'restaurant_service_items';

async function replaceCoreRows<TTable extends MutableTableName>(
  table: TTable,
  restaurantId: string,
  rows: Database['public']['Tables'][TTable]['Insert'][],
  client: DbClient,
) {
  const query = client.from(table).delete() as ProviderDeleteQuery;
  const deleteResult = await query
    .eq('restaurant_id', restaurantId)
    .eq('source', CORE_SOURCE)
    .eq('managed_by', CORE_MANAGED_BY);

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (rows.length === 0) {
    return;
  }

  const insertBuilder = client.from(table) as {
    insert: (value: unknown[]) => PromiseLike<{ error: unknown }>;
  };
  const insertResult = await insertBuilder.insert(rows as unknown[]);
  if (insertResult.error) {
    throw insertResult.error;
  }
}

async function replaceCoreLinks(
  restaurantId: string,
  rows: Database['public']['Tables']['restaurant_links']['Insert'][],
  client: DbClient,
) {
  const deleteResult = await client
    .from('restaurant_links')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('source', CORE_SOURCE)
    .eq('managed_by', CORE_MANAGED_BY)
    .in('link_type', [...MANAGED_LINK_TYPES]);

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (rows.length === 0) {
    return;
  }

  const insertResult = await client.from('restaurant_links').insert(rows);
  if (insertResult.error) {
    throw insertResult.error;
  }
}

export async function getRestaurantBusinessContext(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantBusinessContextSnapshot> {
  const [
    businessDetailsResult,
    linksResult,
    categoriesResult,
    serviceAreasResult,
    attributesResult,
    serviceItemsResult,
  ] = await Promise.all([
    client
      .from('restaurant_business_details')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('updated_at', { ascending: false }),
    client
      .from('restaurant_links')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('link_type', { ascending: true })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_service_areas')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_attributes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('attribute_group', { ascending: true })
      .order('display_order', { ascending: true }),
    client
      .from('restaurant_service_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true }),
  ]);

  const errors = [
    businessDetailsResult.error,
    linksResult.error,
    categoriesResult.error,
    serviceAreasResult.error,
    attributesResult.error,
    serviceItemsResult.error,
  ].filter(Boolean);

  if (errors[0]) {
    throw errors[0];
  }

  const categoryGroups = splitRows((categoriesResult.data ?? []).map(mapCategory));
  const businessDetailsGroups = splitRows(
    (businessDetailsResult.data ?? []).map(mapBusinessDetails),
  );
  const linkGroups = splitRows((linksResult.data ?? []).map(mapLink));
  const serviceAreaGroups = splitRows((serviceAreasResult.data ?? []).map(mapServiceArea));
  const attributeGroups = splitRows((attributesResult.data ?? []).map(mapAttribute));
  const serviceItemGroups = splitRows((serviceItemsResult.data ?? []).map(mapServiceItem));

  return {
    core: {
      ...emptyFamily(),
      businessDetails: businessDetailsGroups.core[0] ?? null,
      links: linkGroups.core,
      categories: categoryGroups.core,
      serviceAreas: serviceAreaGroups.core,
      attributes: attributeGroups.core,
      serviceItems: serviceItemGroups.core,
    },
    providerSnapshot: {
      ...emptyFamily(),
      businessDetails: businessDetailsGroups.providerSnapshot[0] ?? null,
      links: linkGroups.providerSnapshot,
      categories: categoryGroups.providerSnapshot,
      serviceAreas: serviceAreaGroups.providerSnapshot,
      attributes: attributeGroups.providerSnapshot,
      serviceItems: serviceItemGroups.providerSnapshot,
    },
  };
}

export async function updateRestaurantBusinessContext(
  restaurantId: string,
  input: UpdateRestaurantBusinessContextInput,
  client: DbClient = getServiceSupabaseClient(),
  provenance?: RestaurantBusinessContextChangeProvenance,
): Promise<RestaurantBusinessContextSnapshot> {
  const now = new Date().toISOString();
  const canonicalProvenance = resolveChangeProvenance(provenance);
  const changeLogRows: ProfileChangeLogInsert[] = [];

  if (input.businessDetails) {
    const row = {
      restaurant_id: restaurantId,
      opening_date: normalizeText(input.businessDetails.openingDate ?? null),
      business_status: normalizeText(input.businessDetails.businessStatus ?? null),
      is_service_area_business: input.businessDetails.isServiceAreaBusiness ?? false,
      source: CORE_SOURCE,
      managed_by: CORE_MANAGED_BY,
      source_record_id: null,
      last_synced_at: null,
      last_manual_override_at: now,
    } satisfies Database['public']['Tables']['restaurant_business_details']['Insert'];

    const { error } = await client.from('restaurant_business_details').upsert(row, {
      onConflict: 'restaurant_id,source,managed_by',
    });
    if (error) {
      throw error;
    }

    changeLogRows.push({
      restaurant_id: restaurantId,
      entity_table: 'restaurant_business_details',
      field_path: '$',
      old_value: null,
      new_value: row as ProfileChangeLogInsert['new_value'],
      status: 'applied',
      detected_at: now,
      applied_at: now,
      external_profile_id: provenance?.externalProfileId ?? null,
      external_provider: provenance?.externalProvider ?? null,
      draft_id: provenance?.draftId ?? null,
      publish_job_id: provenance?.publishJobId ?? null,
      publish_event_id: provenance?.publishEventId ?? null,
      metadata: { writer: 'updateRestaurantBusinessContext', rowCount: 1 },
      ...canonicalProvenance,
    });
  }

  if (input.links) {
    const rows = input.links.map((row, index) => {
      const linkType = normalizeText(row.linkType);
      if (!linkType) {
        throw new Error('Link type is required');
      }

      const url = normalizeText(row.url);
      if (!url) {
        throw new Error(`URL is required for ${linkType}`);
      }

      return {
        id: normalizeText(row.id) ?? randomUUID(),
        restaurant_id: restaurantId,
        link_type: linkType,
        link_status: normalizeText(row.linkStatus ?? null) ?? 'current',
        label: normalizeText(row.label ?? null),
        url,
        is_primary: row.isPrimary ?? false,
        display_order: index,
        source: CORE_SOURCE,
        managed_by: CORE_MANAGED_BY,
        source_record_id: null,
        last_synced_at: null,
        last_manual_override_at: now,
      };
    });

    await replaceCoreLinks(restaurantId, rows, client);
    changeLogRows.push({
      restaurant_id: restaurantId,
      entity_table: 'restaurant_links',
      field_path: '$',
      old_value: null,
      new_value: rows as ProfileChangeLogInsert['new_value'],
      status: 'applied',
      detected_at: now,
      applied_at: now,
      external_profile_id: provenance?.externalProfileId ?? null,
      external_provider: provenance?.externalProvider ?? null,
      draft_id: provenance?.draftId ?? null,
      publish_job_id: provenance?.publishJobId ?? null,
      publish_event_id: provenance?.publishEventId ?? null,
      metadata: { writer: 'updateRestaurantBusinessContext', rowCount: rows.length },
      ...canonicalProvenance,
    });
  }

  if (input.categories) {
    const rows = input.categories.map((row, index) => {
      const displayName = normalizeText(row.displayName);
      if (!displayName) {
        throw new Error('Category display name is required');
      }

      return {
        id: normalizeText(row.id) ?? randomUUID(),
        restaurant_id: restaurantId,
        display_name: displayName,
        category_code: normalizeText(row.categoryCode ?? null),
        more_hours_types_json: row.moreHoursTypes ?? [],
        is_primary: row.isPrimary ?? false,
        display_order: index,
        source: CORE_SOURCE,
        managed_by: CORE_MANAGED_BY,
        source_record_id: null,
        last_synced_at: null,
        last_manual_override_at: now,
      };
    });

    await replaceCoreRows('restaurant_categories', restaurantId, rows, client);
    changeLogRows.push({
      restaurant_id: restaurantId,
      entity_table: 'restaurant_categories',
      field_path: '$',
      old_value: null,
      new_value: rows as ProfileChangeLogInsert['new_value'],
      status: 'applied',
      detected_at: now,
      applied_at: now,
      external_profile_id: provenance?.externalProfileId ?? null,
      external_provider: provenance?.externalProvider ?? null,
      draft_id: provenance?.draftId ?? null,
      publish_job_id: provenance?.publishJobId ?? null,
      publish_event_id: provenance?.publishEventId ?? null,
      metadata: { writer: 'updateRestaurantBusinessContext', rowCount: rows.length },
      ...canonicalProvenance,
    });
  }

  if (input.serviceAreas) {
    const rows = input.serviceAreas.map((row, index) => {
      const displayName = normalizeText(row.displayName);
      if (!displayName) {
        throw new Error('Service area display name is required');
      }

      return {
        id: normalizeText(row.id) ?? randomUUID(),
        restaurant_id: restaurantId,
        display_name: displayName,
        area_type: normalizeText(row.areaType) ?? 'region',
        region_code: normalizeText(row.regionCode ?? null),
        google_place_id: normalizeText(row.googlePlaceId ?? null),
        google_place_resource_name: normalizeText(row.googlePlaceResourceName ?? null),
        place_data_json: (row.placeData ??
          {}) as Database['public']['Tables']['restaurant_service_areas']['Insert']['place_data_json'],
        display_order: index,
        source: CORE_SOURCE,
        managed_by: CORE_MANAGED_BY,
        source_record_id: null,
        last_synced_at: null,
        last_manual_override_at: now,
      };
    });

    await replaceCoreRows('restaurant_service_areas', restaurantId, rows, client);
    changeLogRows.push({
      restaurant_id: restaurantId,
      entity_table: 'restaurant_service_areas',
      field_path: '$',
      old_value: null,
      new_value: rows as ProfileChangeLogInsert['new_value'],
      status: 'applied',
      detected_at: now,
      applied_at: now,
      external_profile_id: provenance?.externalProfileId ?? null,
      external_provider: provenance?.externalProvider ?? null,
      draft_id: provenance?.draftId ?? null,
      publish_job_id: provenance?.publishJobId ?? null,
      publish_event_id: provenance?.publishEventId ?? null,
      metadata: { writer: 'updateRestaurantBusinessContext', rowCount: rows.length },
      ...canonicalProvenance,
    });
  }

  if (input.attributes) {
    const rows = input.attributes.map((row, index) => {
      const attributeKey = normalizeText(row.attributeKey);
      if (!attributeKey) {
        throw new Error('Attribute key is required');
      }

      const valueType = normalizeText(row.valueType);
      if (!valueType) {
        throw new Error(`Attribute "${attributeKey}" requires a value type`);
      }

      return {
        id: normalizeText(row.id) ?? randomUUID(),
        restaurant_id: restaurantId,
        attribute_group: normalizeText(row.attributeGroup ?? null),
        attribute_key: attributeKey,
        attribute_name: normalizeText(row.attributeName ?? null),
        attribute_id: normalizeText(row.attributeId ?? null),
        display_name: normalizeText(row.displayName ?? null),
        display_text: normalizeText(row.displayText ?? null),
        display_text_standalone: normalizeText(row.displayTextStandalone ?? null),
        display_text_negative: normalizeText(row.displayTextNegative ?? null),
        value_type: valueType,
        bool_value: typeof row.boolValue === 'boolean' ? row.boolValue : null,
        text_value: normalizeText(row.textValue ?? null),
        uri_value: normalizeText(row.uriValue ?? null),
        uri_values: row.uriValues ?? [],
        enum_values: row.enumValues ?? [],
        unset_enum_values: row.unsetEnumValues ?? [],
        raw_value_json: (row.rawValue ??
          {}) as Database['public']['Tables']['restaurant_attributes']['Insert']['raw_value_json'],
        raw_enum_values_json: (row.rawEnumValues ??
          {}) as Database['public']['Tables']['restaurant_attributes']['Insert']['raw_enum_values_json'],
        display_value_json: (row.displayValue ??
          {}) as Database['public']['Tables']['restaurant_attributes']['Insert']['display_value_json'],
        value_metadata_json: row.valueMetadata ?? [],
        display_order: index,
        source: CORE_SOURCE,
        managed_by: CORE_MANAGED_BY,
        source_record_id: null,
        last_synced_at: null,
        last_manual_override_at: now,
      };
    });

    await replaceCoreRows('restaurant_attributes', restaurantId, rows, client);
    changeLogRows.push({
      restaurant_id: restaurantId,
      entity_table: 'restaurant_attributes',
      field_path: '$',
      old_value: null,
      new_value: rows as ProfileChangeLogInsert['new_value'],
      status: 'applied',
      detected_at: now,
      applied_at: now,
      external_profile_id: provenance?.externalProfileId ?? null,
      external_provider: provenance?.externalProvider ?? null,
      draft_id: provenance?.draftId ?? null,
      publish_job_id: provenance?.publishJobId ?? null,
      publish_event_id: provenance?.publishEventId ?? null,
      metadata: { writer: 'updateRestaurantBusinessContext', rowCount: rows.length },
      ...canonicalProvenance,
    });
  }

  if (input.serviceItems) {
    const rows = input.serviceItems.map((row, index) => {
      const itemKey = normalizeText(row.itemKey);
      if (!itemKey) {
        throw new Error('Service item key is required');
      }

      return {
        id: normalizeText(row.id) ?? randomUUID(),
        restaurant_id: restaurantId,
        item_key: itemKey,
        item_type: normalizeText(row.itemType ?? null),
        display_name: normalizeText(row.displayName ?? null),
        description: normalizeText(row.description ?? null),
        payload_json: (row.payload ??
          {}) as Database['public']['Tables']['restaurant_service_items']['Insert']['payload_json'],
        display_order: index,
        source: CORE_SOURCE,
        managed_by: CORE_MANAGED_BY,
        source_record_id: null,
        last_synced_at: null,
        last_manual_override_at: now,
      };
    });

    await replaceCoreRows('restaurant_service_items', restaurantId, rows, client);
    changeLogRows.push({
      restaurant_id: restaurantId,
      entity_table: 'restaurant_service_items',
      field_path: '$',
      old_value: null,
      new_value: rows as ProfileChangeLogInsert['new_value'],
      status: 'applied',
      detected_at: now,
      applied_at: now,
      external_profile_id: provenance?.externalProfileId ?? null,
      external_provider: provenance?.externalProvider ?? null,
      draft_id: provenance?.draftId ?? null,
      publish_job_id: provenance?.publishJobId ?? null,
      publish_event_id: provenance?.publishEventId ?? null,
      metadata: { writer: 'updateRestaurantBusinessContext', rowCount: rows.length },
      ...canonicalProvenance,
    });
  }

  await insertBusinessContextChangeLogRows(changeLogRows, client);

  return getRestaurantBusinessContext(restaurantId, client);
}
