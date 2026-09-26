import { randomUUID } from 'node:crypto';

import { logger } from '@/lib/logger';
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
type BusinessDetailsInsert = Database['public']['Tables']['restaurant_business_details']['Insert'];
type LinkInsert = Database['public']['Tables']['restaurant_links']['Insert'];
type CategoryInsert = Database['public']['Tables']['restaurant_categories']['Insert'];
type ServiceAreaInsert = Database['public']['Tables']['restaurant_service_areas']['Insert'];
type AttributeInsert = Database['public']['Tables']['restaurant_attributes']['Insert'];
type ServiceItemInsert = Database['public']['Tables']['restaurant_service_items']['Insert'];

const CORE_SOURCE = 'nabatable';
const PROVIDER_SOURCE = 'gbp';
const CORE_MANAGED_BY = 'nabatable';
const DEFAULT_OWNER_PROVENANCE = {
  changeOrigin: 'owner',
  changedVia: 'ops_business_context',
  changeReason: 'Owner/admin business-context update.',
} as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERVICE_AREA_TYPES = new Set(['place', 'region', 'postal_code', 'other']);
const ATTRIBUTE_VALUE_TYPE_ALIASES = new Map([
  ['boolean', 'boolean'],
  ['bool', 'boolean'],
  ['text', 'text'],
  ['string', 'text'],
  ['uri', 'uri'],
  ['url', 'uri'],
  ['enum', 'enum'],
  ['multienum', 'multienum'],
  ['multi_enum', 'multienum'],
  ['repeated_enum', 'multienum'],
]);

type BusinessContextMoreHoursType = {
  hoursTypeId: string | null;
  displayName: string | null;
  localizedDisplayName: string | null;
};

type BusinessContextValueMetadata = {
  value: boolean | string | null;
  displayName: string | null;
};

/** Invalid business-context input. `field` is a dot path into the request body. */
export class BusinessContextValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'BusinessContextValidationError';
    this.field = field;
  }
}

/** The stored revision moved since the caller loaded it; nothing was written. */
export class BusinessContextStaleWriteError extends Error {
  readonly currentRevision: number;

  constructor(currentRevision: number) {
    super('Business context changed since it was loaded.');
    this.name = 'BusinessContextStaleWriteError';
    this.currentRevision = currentRevision;
  }
}

export type UpdateRestaurantBusinessContextOptions = {
  /**
   * Revision the caller's draft is based on. When set, the write is refused with
   * {@link BusinessContextStaleWriteError} if another write landed since.
   */
  expectedRevision?: number | null;
};

export type RestaurantBusinessContextSnapshot = {
  /**
   * Per-restaurant save revision (0 before the first atomic save). Absent while the revision
   * RPC is not deployed.
   */
  revision?: number;
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

type BusinessContextReplacement = {
  businessDetails?: BusinessDetailsInsert;
  links?: LinkInsert[];
  categories?: CategoryInsert[];
  serviceAreas?: ServiceAreaInsert[];
  attributes?: AttributeInsert[];
  serviceItems?: ServiceItemInsert[];
};

type BusinessContextReplacementArgs = {
  p_restaurant_id: string;
  p_business_details: BusinessDetailsInsert | null;
  p_links: LinkInsert[] | null;
  p_categories: CategoryInsert[] | null;
  p_service_areas: ServiceAreaInsert[] | null;
  p_attributes: AttributeInsert[] | null;
  p_service_items: ServiceItemInsert[] | null;
};

type RpcError = { code?: string; message?: string };

/**
 * The business-context RPCs are not in the generated `Database` types (like the core RPC before
 * them), so they are typed here.
 */
type BusinessContextRpcClient = {
  rpc(
    fn: 'replace_restaurant_business_context_core',
    args: BusinessContextReplacementArgs,
  ): PromiseLike<{ error: RpcError | null }>;
  rpc(
    fn: 'replace_restaurant_business_context_v2',
    args: BusinessContextReplacementArgs & {
      p_change_log_rows: ProfileChangeLogInsert[];
      p_expected_revision: number | null;
    },
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
  rpc(
    fn: 'get_restaurant_business_context_revision_v1',
    args: { p_restaurant_id: string },
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
};

function asBusinessContextRpcClient(client: DbClient): BusinessContextRpcClient {
  return client as unknown as BusinessContextRpcClient;
}

/** PostgREST (PGRST202) or Postgres (42883): the function is not deployed yet. */
function isMissingRpcError(error: RpcError | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

function readRevision(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeOptionalUuid(
  value: string | null | undefined,
  label: string,
  field: string,
): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return randomUUID();
  }
  if (!UUID_PATTERN.test(normalized)) {
    throw new BusinessContextValidationError(field, `${label} must be a valid UUID`);
  }
  return normalized;
}

function assertUniqueRowIds(rows: Array<{ id?: string }>, label: string, family: string) {
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (!row.id) {
      return;
    }
    if (seen.has(row.id)) {
      throw new BusinessContextValidationError(
        `${family}.${index}.id`,
        `Duplicate ${label} id ${row.id}`,
      );
    }
    seen.add(row.id);
  });
}

function normalizeServiceAreaType(value: string | null | undefined, field: string): string {
  const normalized = normalizeText(value)?.toLowerCase() ?? 'region';
  if (!SERVICE_AREA_TYPES.has(normalized)) {
    throw new BusinessContextValidationError(
      field,
      `Service area type must be one of ${Array.from(SERVICE_AREA_TYPES).join(', ')}`,
    );
  }
  return normalized;
}

function normalizeAttributeValueType(
  value: string | null | undefined,
  attributeKey: string,
  field: string,
): string {
  const normalized = normalizeText(value)?.toLowerCase();
  const mapped = normalized ? ATTRIBUTE_VALUE_TYPE_ALIASES.get(normalized) : null;
  if (!mapped) {
    throw new BusinessContextValidationError(
      field,
      `Attribute "${attributeKey}" value type must be one of boolean, text, uri, enum, or multienum`,
    );
  }
  return mapped;
}

function assertSinglePrimaryCategory(rows: CategoryInsert[]) {
  const primaryCount = rows.filter((row) => row.is_primary).length;
  if (primaryCount > 1) {
    throw new BusinessContextValidationError(
      'categories',
      'Only one business category can be marked as primary',
    );
  }
}

function toReplacementArgs(
  restaurantId: string,
  replacement: BusinessContextReplacement,
): BusinessContextReplacementArgs {
  return {
    p_restaurant_id: restaurantId,
    p_business_details: replacement.businessDetails ?? null,
    p_links: replacement.links ?? null,
    p_categories: replacement.categories ?? null,
    p_service_areas: replacement.serviceAreas ?? null,
    p_attributes: replacement.attributes ?? null,
    p_service_items: replacement.serviceItems ?? null,
  };
}

type ReplacementOutcome = { applied: true; revision: number | undefined };

/**
 * Applies the replacement and its change-log rows in one transaction
 * (`replace_restaurant_business_context_v2`). While that RPC is not deployed, falls back to the
 * core RPC followed by a separate change-log insert, the pre-v2 behaviour, without a revision.
 */
async function replaceBusinessContextAtomically(
  restaurantId: string,
  replacement: BusinessContextReplacement,
  changeLogRows: ProfileChangeLogInsert[],
  expectedRevision: number | null,
  client: DbClient,
): Promise<ReplacementOutcome> {
  const rpcClient = asBusinessContextRpcClient(client);
  const args = toReplacementArgs(restaurantId, replacement);
  const { data, error } = await rpcClient.rpc('replace_restaurant_business_context_v2', {
    ...args,
    p_change_log_rows: changeLogRows,
    p_expected_revision: expectedRevision,
  });

  if (!error) {
    const result = normalizeRecord(data);
    const revision = readRevision(result?.revision);
    if (result?.status === 'stale') {
      throw new BusinessContextStaleWriteError(revision ?? 0);
    }
    if (result?.status !== 'applied') {
      throw new Error('Unexpected business-context replacement result');
    }
    return { applied: true, revision };
  }

  if (!isMissingRpcError(error)) {
    throw error;
  }

  logger.warn('business_context.atomic_rpc_missing', {
    restaurantId,
    preconditionIgnored: expectedRevision !== null,
  });
  if (Object.keys(replacement).length > 0) {
    const legacy = await rpcClient.rpc('replace_restaurant_business_context_core', args);
    if (legacy.error) {
      throw legacy.error;
    }
  }
  await insertBusinessContextChangeLogRows(changeLogRows, client);
  return { applied: true, revision: undefined };
}

async function readBusinessContextRevision(
  restaurantId: string,
  client: DbClient,
): Promise<number | undefined> {
  const { data, error } = await asBusinessContextRpcClient(client).rpc(
    'get_restaurant_business_context_revision_v1',
    { p_restaurant_id: restaurantId },
  );
  if (error) {
    if (isMissingRpcError(error)) {
      return undefined;
    }
    throw error;
  }
  return readRevision(data);
}

/**
 * The saved business context with its revision. The revision is read before the rows, so a
 * write that lands between the two reads makes the revision older than the rows: the next save
 * is then refused as stale rather than silently overwriting that write.
 */
export async function getRestaurantBusinessContext(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantBusinessContextSnapshot> {
  const revision = await readBusinessContextRevision(restaurantId, client);
  const snapshot = await readBusinessContextRows(restaurantId, client);
  return revision === undefined ? snapshot : { revision, ...snapshot };
}

async function readBusinessContextRows(
  restaurantId: string,
  client: DbClient,
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

/**
 * Replaces the given sections, writes their change-log rows and bumps the revision in one
 * transaction. Throws {@link BusinessContextValidationError} for invalid input (before any
 * write) and {@link BusinessContextStaleWriteError} when `options.expectedRevision` is stale.
 */
export async function updateRestaurantBusinessContext(
  restaurantId: string,
  input: UpdateRestaurantBusinessContextInput,
  client: DbClient = getServiceSupabaseClient(),
  provenance?: RestaurantBusinessContextChangeProvenance,
  options: UpdateRestaurantBusinessContextOptions = {},
): Promise<RestaurantBusinessContextSnapshot> {
  const now = new Date().toISOString();
  const canonicalProvenance = resolveChangeProvenance(provenance);
  const changeLogRows: ProfileChangeLogInsert[] = [];
  const replacement: BusinessContextReplacement = {};

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
    } satisfies BusinessDetailsInsert;

    replacement.businessDetails = row;

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
    const rows = input.links.map<LinkInsert>((row, index) => {
      const linkType = normalizeText(row.linkType);
      if (!linkType) {
        throw new BusinessContextValidationError(
          `links.${index}.linkType`,
          'Link type is required',
        );
      }

      const url = normalizeText(row.url);
      if (!url) {
        throw new BusinessContextValidationError(
          `links.${index}.url`,
          `URL is required for ${linkType}`,
        );
      }

      return {
        id: normalizeOptionalUuid(row.id, 'Link id', `links.${index}.id`),
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
    assertUniqueRowIds(rows, 'link', 'links');

    replacement.links = rows;
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
    const rows = input.categories.map<CategoryInsert>((row, index) => {
      const displayName = normalizeText(row.displayName);
      if (!displayName) {
        throw new BusinessContextValidationError(
          `categories.${index}.displayName`,
          'Category display name is required',
        );
      }

      return {
        id: normalizeOptionalUuid(row.id, 'Category id', `categories.${index}.id`),
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
    assertUniqueRowIds(rows, 'category', 'categories');
    assertSinglePrimaryCategory(rows);

    replacement.categories = rows;
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
    const rows = input.serviceAreas.map<ServiceAreaInsert>((row, index) => {
      const displayName = normalizeText(row.displayName);
      if (!displayName) {
        throw new BusinessContextValidationError(
          `serviceAreas.${index}.displayName`,
          'Service area display name is required',
        );
      }

      return {
        id: normalizeOptionalUuid(row.id, 'Service area id', `serviceAreas.${index}.id`),
        restaurant_id: restaurantId,
        display_name: displayName,
        area_type: normalizeServiceAreaType(row.areaType, `serviceAreas.${index}.areaType`),
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
    assertUniqueRowIds(rows, 'service area', 'serviceAreas');

    replacement.serviceAreas = rows;
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
    const rows = input.attributes.map<AttributeInsert>((row, index) => {
      const attributeKey = normalizeText(row.attributeKey);
      if (!attributeKey) {
        throw new BusinessContextValidationError(
          `attributes.${index}.attributeKey`,
          'Attribute key is required',
        );
      }

      const valueType = normalizeAttributeValueType(
        row.valueType,
        attributeKey,
        `attributes.${index}.valueType`,
      );

      return {
        id: normalizeOptionalUuid(row.id, 'Attribute id', `attributes.${index}.id`),
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
    assertUniqueRowIds(rows, 'attribute', 'attributes');

    replacement.attributes = rows;
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
    const rows = input.serviceItems.map<ServiceItemInsert>((row, index) => {
      const itemKey = normalizeText(row.itemKey);
      if (!itemKey) {
        throw new BusinessContextValidationError(
          `serviceItems.${index}.itemKey`,
          'Service item key is required',
        );
      }

      return {
        id: normalizeOptionalUuid(row.id, 'Service item id', `serviceItems.${index}.id`),
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
    assertUniqueRowIds(rows, 'service item', 'serviceItems');

    replacement.serviceItems = rows;
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

  const outcome = await replaceBusinessContextAtomically(
    restaurantId,
    replacement,
    changeLogRows,
    options.expectedRevision ?? null,
    client,
  );

  if (outcome.revision === undefined) {
    return getRestaurantBusinessContext(restaurantId, client);
  }
  // The revision this write produced. Rows read afterwards can only be the same or newer, so a
  // concurrent write can make the next save stale, never silently lost.
  const snapshot = await readBusinessContextRows(restaurantId, client);
  return { revision: outcome.revision, ...snapshot };
}
