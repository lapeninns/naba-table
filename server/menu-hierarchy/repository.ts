import { getServiceSupabaseClient } from '@/server/supabase';

import { MenuHierarchyError, toMenuHierarchyError } from './errors';
import {
  DEFAULT_MENU_LANGUAGE_CODE,
  buildCanonicalMenuLabel,
  type CanonicalMenuItemAttributes,
  type CanonicalMenuLabel,
  type CanonicalRestaurantMenu,
  type CanonicalRestaurantMenuItem,
  type CanonicalRestaurantMenuOption,
  type CanonicalRestaurantMenuSection,
  type MenuItemKind,
  type MenuKind,
  type NabatableMenuItemExtensions,
  type RestaurantMenuInput,
  type MenuChildOrder,
  type MenuItemExtensionsMerge,
  type MenuReorderTarget,
  type RestaurantMenuItemInput,
  type RestaurantMenuItemPatch,
  type RestaurantMenuOptionInput,
  type RestaurantMenuOptionPatch,
  type RestaurantMenuPatch,
  type RestaurantMenuSectionInput,
  type RestaurantMenuSectionPatch,
} from './types';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type BaseDbClient = SupabaseClient<Database>;

type MenuRow = {
  id: string;
  restaurant_id: string;
  labels: Json;
  source_url: string | null;
  cuisines: string[];
  default_language_code: string;
  menu_kind: string;
  display_order: number;
  active: boolean;
  legacy_source: Json;
  created_at: string;
  updated_at: string;
};

type SectionRow = {
  id: string;
  restaurant_id: string;
  menu_id: string;
  labels: Json;
  display_order: number;
  active: boolean;
  legacy_category: string | null;
  legacy_subcategory: string | null;
  legacy_source: Json;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  restaurant_id: string;
  menu_id: string | null;
  section_id: string | null;
  item_kind: string;
  external_item_id: string;
  item_name: string;
  category: string;
  subcategory: string | null;
  base_price: string;
  currency: string;
  display_order: number;
  active: boolean;
  labels: Json;
  google_attributes: Json;
  google_media_keys: string[];
  local_media: Json;
  image_url: string | null;
  legacy_source: Json;
  created_at: string;
  updated_at: string;
};

type OptionRow = {
  id: string;
  restaurant_id: string;
  menu_item_id: string;
  external_option_id: string | null;
  labels: Json;
  google_attributes: Json;
  google_media_keys: string[];
  display_order: number;
  active: boolean;
  legacy_source: Json;
  created_at: string;
  updated_at: string;
};

type ExtensionRow = {
  restaurant_id: string;
  menu_item_id: string;
  drink_profile: Json;
  recommendation_metadata: Json;
  availability_policy: Json;
  customization_controls: Json;
  source_metadata: Json;
  created_at: string;
  updated_at: string;
};

type Insert<T> = Partial<T> & Record<string, unknown>;
type Update<T> = Partial<T> & Record<string, unknown>;

type MenuHierarchyDatabase = {
  public: {
    Tables: {
      restaurant_menus: {
        Row: MenuRow;
        Insert: Insert<MenuRow>;
        Update: Update<MenuRow>;
        Relationships: [];
      };
      restaurant_menu_sections: {
        Row: SectionRow;
        Insert: Insert<SectionRow>;
        Update: Update<SectionRow>;
        Relationships: [];
      };
      restaurant_menu_items: {
        Row: ItemRow;
        Insert: Insert<ItemRow>;
        Update: Update<ItemRow>;
        Relationships: [];
      };
      restaurant_menu_item_options: {
        Row: OptionRow;
        Insert: Insert<OptionRow>;
        Update: Update<OptionRow>;
        Relationships: [];
      };
      restaurant_menu_item_extensions: {
        Row: ExtensionRow;
        Insert: Insert<ExtensionRow>;
        Update: Update<ExtensionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_restaurant_menu_item_v1: {
        Args: {
          p_restaurant_id: string;
          p_menu_id: string;
          p_section_id: string;
          p_item: Json;
          p_extensions: Json;
          p_options: Json;
          p_idempotency_key: string | null;
        };
        Returns: Json;
      };
      update_restaurant_menu_item_v1: {
        Args: {
          p_restaurant_id: string;
          p_menu_id: string;
          p_section_id: string;
          p_item_id: string;
          p_set: Json;
          p_attributes_merge: Json | null;
          p_extensions: Json | null;
          p_extensions_merge: Json | null;
        };
        Returns: Json;
      };
      create_restaurant_menu_section_v1: {
        Args: { p_restaurant_id: string; p_menu_id: string; p_section: Json };
        Returns: SectionRow;
      };
      create_restaurant_menu_item_option_v1: {
        Args: {
          p_restaurant_id: string;
          p_menu_id: string;
          p_section_id: string;
          p_item_id: string;
          p_option: Json;
        };
        Returns: OptionRow;
      };
      reorder_restaurant_menu_sections_v1: {
        Args: { p_restaurant_id: string; p_menu_id: string; p_ordered_ids: string[] };
        Returns: Json;
      };
      reorder_restaurant_menu_items_v1: {
        Args: {
          p_restaurant_id: string;
          p_menu_id: string;
          p_section_id: string;
          p_ordered_ids: string[];
        };
        Returns: Json;
      };
      reorder_restaurant_menu_item_options_v1: {
        Args: {
          p_restaurant_id: string;
          p_menu_id: string;
          p_section_id: string;
          p_item_id: string;
          p_ordered_ids: string[];
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type DbClient = SupabaseClient<MenuHierarchyDatabase>;

function hierarchyClient(client: BaseDbClient): DbClient {
  return client as unknown as DbClient;
}

function toJson(value: unknown): Json {
  return value as Json;
}

function parseRecord(value: Json | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseLabels(value: Json | null, fallbackDisplayName?: string): CanonicalMenuLabel[] {
  if (Array.isArray(value)) {
    const labels = value
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        const record = entry as Record<string, unknown>;
        if (typeof record.displayName !== 'string') return null;
        const displayName = record.displayName.trim();
        if (!displayName) return null;
        return buildCanonicalMenuLabel({
          displayName,
          description: typeof record.description === 'string' ? record.description : null,
          languageCode:
            typeof record.languageCode === 'string'
              ? record.languageCode
              : DEFAULT_MENU_LANGUAGE_CODE,
        });
      })
      .filter((label): label is CanonicalMenuLabel => Boolean(label));
    if (labels.length > 0) return labels;
  }
  return fallbackDisplayName ? [buildCanonicalMenuLabel({ displayName: fallbackDisplayName })] : [];
}

function normalizedText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstCommonText(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  const order: string[] = [];
  values.forEach((value) => {
    const normalized = normalizedText(value);
    if (!normalized) return;
    if (!counts.has(normalized)) order.push(normalized);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });
  return order.sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0))[0] ?? null;
}

function sectionGroupFromRows(row: SectionRow, sectionItems: readonly ItemRow[]) {
  const legacyCategory =
    normalizedText(row.legacy_category) ??
    firstCommonText(sectionItems.map((item) => item.category));
  const legacySubcategory =
    normalizedText(row.legacy_subcategory) ??
    firstCommonText(sectionItems.map((item) => item.subcategory));
  return {
    legacyCategory,
    legacySubcategory,
    displayName: legacyCategory
      ? legacySubcategory
        ? `${legacyCategory} - ${legacySubcategory}`
        : legacyCategory
      : 'Section',
  };
}

function primaryLabel(labels: readonly CanonicalMenuLabel[], fallback: string): string {
  return labels[0]?.displayName?.trim() || fallback;
}

function primaryDescription(labels: readonly CanonicalMenuLabel[]): string | null {
  return labels[0]?.description ?? null;
}

function parseAttributes(value: Json | null): CanonicalMenuItemAttributes {
  return parseRecord(value) as CanonicalMenuItemAttributes;
}

function mapOption(row: OptionRow): CanonicalRestaurantMenuOption {
  const attributes = parseAttributes(row.google_attributes);
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    menuItemId: row.menu_item_id,
    externalOptionId: row.external_option_id,
    labels: parseLabels(row.labels, row.external_option_id ?? 'Option'),
    attributes,
    media: {
      googleMediaKeys: row.google_media_keys ?? attributes.mediaKeys ?? [],
      localMedia: {},
    },
    displayOrder: row.display_order,
    active: row.active,
    legacySource: parseRecord(row.legacy_source),
  };
}

function mapExtensions(row: ExtensionRow | undefined): NabatableMenuItemExtensions {
  return {
    drinkProfile: parseRecord(row?.drink_profile ?? null),
    recommendationMetadata: parseRecord(row?.recommendation_metadata ?? null),
    availabilityPolicy: parseRecord(row?.availability_policy ?? null),
    customizationControls: parseRecord(row?.customization_controls ?? null),
    sourceMetadata: parseRecord(row?.source_metadata ?? null),
  };
}

function mapItem(
  row: ItemRow,
  options: readonly OptionRow[],
  extension: ExtensionRow | undefined,
): CanonicalRestaurantMenuItem {
  const labels = parseLabels(row.labels, row.item_name);
  const attributes = parseAttributes(row.google_attributes);
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    menuId: row.menu_id,
    sectionId: row.section_id,
    itemKind: row.item_kind as MenuItemKind,
    externalItemId: row.external_item_id,
    legacySource: parseRecord(row.legacy_source),
    labels,
    attributes,
    media: {
      googleMediaKeys: row.google_media_keys ?? attributes.mediaKeys ?? [],
      localImageUrl: row.image_url,
      localMedia: parseRecord(row.local_media),
    },
    extensions: mapExtensions(extension),
    options: options
      .filter((option) => option.menu_item_id === row.id)
      .sort((left, right) => left.display_order - right.display_order)
      .map(mapOption),
    displayOrder: row.display_order,
    active: row.active,
  };
}

function mapSection(
  row: SectionRow,
  items: readonly ItemRow[],
  options: readonly OptionRow[],
  extensions: readonly ExtensionRow[],
): CanonicalRestaurantMenuSection {
  const sectionItems = items
    .filter((item) => item.section_id === row.id)
    .sort((left, right) => left.display_order - right.display_order);
  const group = sectionGroupFromRows(row, sectionItems);
  const labels = parseLabels(row.labels, group.displayName);
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    menuId: row.menu_id,
    labels,
    displayOrder: row.display_order,
    active: row.active,
    legacyCategory: normalizedText(row.legacy_category) ?? group.legacyCategory,
    legacySubcategory: normalizedText(row.legacy_subcategory) ?? group.legacySubcategory,
    legacySource: parseRecord(row.legacy_source),
    items: sectionItems.map((item) =>
      mapItem(
        item,
        options,
        extensions.find((extension) => extension.menu_item_id === item.id),
      ),
    ),
  };
}

function mapMenu(
  row: MenuRow,
  sections: readonly SectionRow[],
  items: readonly ItemRow[],
  options: readonly OptionRow[],
  extensions: readonly ExtensionRow[],
): CanonicalRestaurantMenu {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    labels: parseLabels(row.labels, `${row.menu_kind} menu`),
    sourceUrl: row.source_url,
    cuisines: row.cuisines as CanonicalRestaurantMenu['cuisines'],
    defaultLanguageCode: row.default_language_code,
    menuKind: row.menu_kind as MenuKind,
    displayOrder: row.display_order,
    active: row.active,
    legacySource: parseRecord(row.legacy_source),
    sections: sections
      .filter((section) => section.menu_id === row.id)
      .sort((left, right) => left.display_order - right.display_order)
      .map((section) => mapSection(section, items, options, extensions)),
  };
}

export async function listRestaurantMenuHierarchy(
  restaurantId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<{ menus: CanonicalRestaurantMenu[] }> {
  const client = hierarchyClient(baseClient);
  const [{ data: menus, error: menusError }, { data: sections, error: sectionsError }] =
    await Promise.all([
      client
        .from('restaurant_menus')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true }),
      client
        .from('restaurant_menu_sections')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true }),
    ]);

  if (menusError) throw menusError;
  if (sectionsError) throw sectionsError;

  const [{ data: items, error: itemsError }, { data: options, error: optionsError }] =
    await Promise.all([
      client
        .from('restaurant_menu_items')
        .select(
          'id, restaurant_id, menu_id, section_id, item_kind, external_item_id, item_name, category, subcategory, base_price, currency, display_order, active, labels, google_attributes, google_media_keys, local_media, image_url, legacy_source, created_at, updated_at',
        )
        .eq('restaurant_id', restaurantId)
        .not('menu_id', 'is', null)
        .order('display_order', { ascending: true }),
      client
        .from('restaurant_menu_item_options')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true }),
    ]);

  if (itemsError) throw itemsError;
  if (optionsError) throw optionsError;

  const itemIds = (items ?? []).map((item) => item.id);
  const { data: extensions, error: extensionsError } =
    itemIds.length > 0
      ? await client
          .from('restaurant_menu_item_extensions')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .in('menu_item_id', itemIds)
      : { data: [], error: null };

  if (extensionsError) throw extensionsError;

  const menuRows = (menus ?? []) as MenuRow[];
  const sectionRows = (sections ?? []) as SectionRow[];
  const itemRows = (items ?? []) as ItemRow[];
  const optionRows = (options ?? []) as OptionRow[];
  const extensionRows = (extensions ?? []) as ExtensionRow[];

  return {
    menus: menuRows.map((menu) => mapMenu(menu, sectionRows, itemRows, optionRows, extensionRows)),
  };
}

// --- write helpers --------------------------------------------------------------------------

/** Throws the domain error for known database failures, otherwise the original error. */
function fail(error: unknown): never {
  throw toMenuHierarchyError(error);
}

/**
 * Labels as stored. The table check (`is_google_menu_label_array`) rejects a present,
 * non-string `description`, while the canonical schema normalises a missing description to
 * `null`, so a null description is dropped instead of written.
 */
function labelsForDb(labels: readonly CanonicalMenuLabel[]): Json {
  return labels.map(({ description, ...label }) =>
    typeof description === 'string' ? { ...label, description } : label,
  ) as Json;
}

function extensionsForDb(
  extensions: Partial<Record<keyof NabatableMenuItemExtensions, unknown>>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if (extensions.drinkProfile !== undefined) columns.drink_profile = extensions.drinkProfile;
  if (extensions.recommendationMetadata !== undefined) {
    columns.recommendation_metadata = extensions.recommendationMetadata;
  }
  if (extensions.availabilityPolicy !== undefined) {
    columns.availability_policy = extensions.availabilityPolicy;
  }
  if (extensions.customizationControls !== undefined) {
    columns.customization_controls = extensions.customizationControls;
  }
  if (extensions.sourceMetadata !== undefined) columns.source_metadata = extensions.sourceMetadata;
  return columns;
}

function extensionsMergeForDb(merge: MenuItemExtensionsMerge): Record<string, unknown> {
  return extensionsForDb(merge);
}

function optionForDb(input: RestaurantMenuOptionInput): Record<string, unknown> {
  return {
    external_option_id: input.externalOptionId ?? null,
    labels: labelsForDb(input.labels),
    google_attributes: input.attributes,
    google_media_keys: input.media.googleMediaKeys,
    active: input.active,
    legacy_source: input.legacySource,
    ...(typeof input.displayOrder === 'number' ? { display_order: input.displayOrder } : {}),
  };
}

type ItemSnapshot = {
  item: ItemRow;
  extension: ExtensionRow | null;
  options: OptionRow[];
  replayed?: boolean;
};

function parseItemSnapshot(data: unknown): ItemSnapshot {
  const snapshot = data as Partial<ItemSnapshot> | null;
  if (!snapshot?.item) {
    throw new MenuHierarchyError('not_found');
  }
  return {
    item: snapshot.item,
    extension: snapshot.extension ?? null,
    options: Array.isArray(snapshot.options) ? snapshot.options : [],
    replayed: snapshot.replayed === true,
  };
}

function mapItemSnapshot(snapshot: ItemSnapshot): CanonicalRestaurantMenuItem {
  return mapItem(snapshot.item, snapshot.options, snapshot.extension ?? undefined);
}

async function readItem(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  itemId: string,
  client: DbClient,
): Promise<void> {
  const { error } = await client
    .from('restaurant_menu_items')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('menu_id', menuId)
    .eq('section_id', sectionId)
    .eq('id', itemId)
    .single();
  if (error) fail(error);
}

// --- menus ------------------------------------------------------------------------------------

export async function createRestaurantMenu(
  restaurantId: string,
  input: RestaurantMenuInput,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenu> {
  const client = hierarchyClient(baseClient);
  const { data, error } = await client
    .from('restaurant_menus')
    .insert({
      restaurant_id: restaurantId,
      labels: labelsForDb(input.labels),
      source_url: input.sourceUrl,
      cuisines: input.cuisines,
      default_language_code: input.defaultLanguageCode,
      menu_kind: input.menuKind,
      display_order: input.displayOrder,
      active: input.active,
      legacy_source: toJson(input.legacySource),
    })
    .select('*')
    .single();
  if (error) fail(error);
  return mapMenu(data as MenuRow, [], [], [], []);
}

export async function updateRestaurantMenu(
  restaurantId: string,
  menuId: string,
  input: RestaurantMenuPatch,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenu> {
  const client = hierarchyClient(baseClient);
  const patch: Update<MenuRow> = {};
  if (input.labels) patch.labels = labelsForDb(input.labels);
  if ('sourceUrl' in input) patch.source_url = input.sourceUrl;
  if (input.cuisines) patch.cuisines = input.cuisines;
  if (input.defaultLanguageCode) patch.default_language_code = input.defaultLanguageCode;
  if (input.menuKind) patch.menu_kind = input.menuKind;
  if (typeof input.displayOrder === 'number') patch.display_order = input.displayOrder;
  if (typeof input.active === 'boolean') patch.active = input.active;
  if (input.legacySource) patch.legacy_source = toJson(input.legacySource);

  const { data, error } = await client
    .from('restaurant_menus')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('id', menuId)
    .select('*')
    .single();
  if (error) fail(error);
  return mapMenu(data as MenuRow, [], [], [], []);
}

export async function deleteRestaurantMenu(
  restaurantId: string,
  menuId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<void> {
  const client = hierarchyClient(baseClient);
  const rpc = client.rpc as unknown as (
    fn: 'delete_restaurant_menu_hierarchy',
    args: { p_restaurant_id: string; p_menu_id: string },
  ) => Promise<{ error: unknown }>;
  const { error } = await rpc('delete_restaurant_menu_hierarchy', {
    p_restaurant_id: restaurantId,
    p_menu_id: menuId,
  });
  if (error) fail(error);
}

// --- sections ---------------------------------------------------------------------------------

export async function createRestaurantMenuSection(
  restaurantId: string,
  menuId: string,
  input: RestaurantMenuSectionInput,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuSection> {
  const client = hierarchyClient(baseClient);
  const section: Record<string, unknown> = {
    labels: labelsForDb(input.labels),
    active: input.active,
    legacy_category: input.legacyCategory ?? null,
    legacy_subcategory: input.legacySubcategory ?? null,
    legacy_source: input.legacySource,
  };
  if (typeof input.displayOrder === 'number') section.display_order = input.displayOrder;

  const { data, error } = await client.rpc('create_restaurant_menu_section_v1', {
    p_restaurant_id: restaurantId,
    p_menu_id: menuId,
    p_section: toJson(section),
  });
  if (error) fail(error);
  return mapSection(data as SectionRow, [], [], []);
}

export async function updateRestaurantMenuSection(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  input: RestaurantMenuSectionPatch,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuSection> {
  const client = hierarchyClient(baseClient);
  const patch: Update<SectionRow> = {};
  if (input.labels) patch.labels = labelsForDb(input.labels);
  if (typeof input.displayOrder === 'number') patch.display_order = input.displayOrder;
  if (typeof input.active === 'boolean') patch.active = input.active;
  if ('legacyCategory' in input) patch.legacy_category = input.legacyCategory;
  if ('legacySubcategory' in input) patch.legacy_subcategory = input.legacySubcategory;
  if (input.legacySource) patch.legacy_source = toJson(input.legacySource);

  const { data, error } = await client
    .from('restaurant_menu_sections')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('menu_id', menuId)
    .eq('id', sectionId)
    .select('*')
    .single();
  if (error) fail(error);
  return mapSection(data as SectionRow, [], [], []);
}

export async function deleteRestaurantMenuSection(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<void> {
  const client = hierarchyClient(baseClient);
  const rpc = client.rpc as unknown as (
    fn: 'delete_restaurant_menu_section_hierarchy',
    args: { p_restaurant_id: string; p_menu_id: string; p_section_id: string },
  ) => Promise<{ error: unknown }>;
  const { error } = await rpc('delete_restaurant_menu_section_hierarchy', {
    p_restaurant_id: restaurantId,
    p_menu_id: menuId,
    p_section_id: sectionId,
  });
  if (error) fail(error);
}

// --- items ------------------------------------------------------------------------------------

export type CreateRestaurantMenuItemResult = {
  item: CanonicalRestaurantMenuItem;
  /** True when an earlier request with the same idempotency key already created the item. */
  replayed: boolean;
};

/**
 * Creates the item, its extensions and any initial options in one transaction
 * (`create_restaurant_menu_item_v1`). With `input.idempotencyKey`, a retry returns the item
 * the first request created. Without `input.displayOrder` the item is appended.
 */
export async function createRestaurantMenuItemIdempotent(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  input: RestaurantMenuItemInput,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CreateRestaurantMenuItemResult> {
  const client = hierarchyClient(baseClient);
  const item: Record<string, unknown> = {
    item_kind: input.itemKind,
    external_item_id: input.externalItemId,
    item_name: primaryLabel(input.labels, input.externalItemId),
    short_description: primaryDescription(input.labels),
    active: input.active,
    labels: labelsForDb(input.labels),
    google_attributes: input.attributes,
    google_media_keys: input.media.googleMediaKeys,
    local_media: input.media.localMedia,
    image_url: input.media.localImageUrl ?? null,
    legacy_source: input.legacySource,
  };
  if (typeof input.displayOrder === 'number') item.display_order = input.displayOrder;

  const { data, error } = await client.rpc('create_restaurant_menu_item_v1', {
    p_restaurant_id: restaurantId,
    p_menu_id: menuId,
    p_section_id: sectionId,
    p_item: toJson(item),
    p_extensions: toJson(extensionsForDb(input.extensions)),
    p_options: toJson((input.options ?? []).map(optionForDb)),
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) fail(error);
  const snapshot = parseItemSnapshot(data);
  return { item: mapItemSnapshot(snapshot), replayed: snapshot.replayed === true };
}

export async function createRestaurantMenuItem(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  input: RestaurantMenuItemInput,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuItem> {
  const { item } = await createRestaurantMenuItemIdempotent(
    restaurantId,
    menuId,
    sectionId,
    input,
    baseClient,
  );
  return item;
}

/**
 * Updates an item and its extensions under one row lock (`update_restaurant_menu_item_v1`).
 * `attributes` / `extensions` replace stored values; `attributesMerge` / `extensionsMerge`
 * merge only the keys sent. Returns the canonical item with options and extensions.
 */
export async function updateRestaurantMenuItem(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  itemId: string,
  input: RestaurantMenuItemPatch,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuItem> {
  const client = hierarchyClient(baseClient);
  const set: Record<string, unknown> = {};
  if (input.itemKind) set.item_kind = input.itemKind;
  if (input.externalItemId) set.external_item_id = input.externalItemId;
  if (input.labels) {
    set.labels = labelsForDb(input.labels);
    set.item_name = primaryLabel(input.labels, input.externalItemId ?? 'Menu item');
    set.short_description = primaryDescription(input.labels);
  }
  if (input.attributes) set.google_attributes = input.attributes;
  if (input.media) {
    set.google_media_keys = input.media.googleMediaKeys;
    set.local_media = input.media.localMedia;
    set.image_url = input.media.localImageUrl ?? null;
  }
  if (typeof input.displayOrder === 'number') set.display_order = input.displayOrder;
  if (typeof input.active === 'boolean') set.active = input.active;
  if (input.legacySource) set.legacy_source = input.legacySource;

  const { data, error } = await client.rpc('update_restaurant_menu_item_v1', {
    p_restaurant_id: restaurantId,
    p_menu_id: menuId,
    p_section_id: sectionId,
    p_item_id: itemId,
    p_set: toJson(set),
    p_attributes_merge: input.attributesMerge ? toJson(input.attributesMerge) : null,
    p_extensions: input.extensions ? toJson(extensionsForDb(input.extensions)) : null,
    p_extensions_merge: input.extensionsMerge
      ? toJson(extensionsMergeForDb(input.extensionsMerge))
      : null,
  });
  if (error) fail(error);
  return mapItemSnapshot(parseItemSnapshot(data));
}

/** One statement: options, extensions and GBP identities cascade from the item row. */
export async function deleteRestaurantMenuItem(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  itemId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<void> {
  const client = hierarchyClient(baseClient);
  const { data, error } = await client
    .from('restaurant_menu_items')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('menu_id', menuId)
    .eq('section_id', sectionId)
    .eq('id', itemId)
    .select('id');
  if (error) fail(error);
  if (!data || data.length === 0) throw new MenuHierarchyError('not_found');
}

// --- options ----------------------------------------------------------------------------------

export async function createRestaurantMenuOption(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  itemId: string,
  input: RestaurantMenuOptionInput,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuOption> {
  const client = hierarchyClient(baseClient);
  const { data, error } = await client.rpc('create_restaurant_menu_item_option_v1', {
    p_restaurant_id: restaurantId,
    p_menu_id: menuId,
    p_section_id: sectionId,
    p_item_id: itemId,
    p_option: toJson(optionForDb(input)),
  });
  if (error) fail(error);
  return mapOption(data as OptionRow);
}

export async function updateRestaurantMenuOption(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  itemId: string,
  optionId: string,
  input: RestaurantMenuOptionPatch,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuOption> {
  const client = hierarchyClient(baseClient);
  await readItem(restaurantId, menuId, sectionId, itemId, client);
  const patch: Update<OptionRow> = {};
  if ('externalOptionId' in input) patch.external_option_id = input.externalOptionId;
  if (input.labels) patch.labels = labelsForDb(input.labels);
  if (input.attributes) patch.google_attributes = toJson(input.attributes);
  if (input.media) patch.google_media_keys = input.media.googleMediaKeys;
  if (typeof input.displayOrder === 'number') patch.display_order = input.displayOrder;
  if (typeof input.active === 'boolean') patch.active = input.active;
  if (input.legacySource) patch.legacy_source = toJson(input.legacySource);

  const { data, error } = await client
    .from('restaurant_menu_item_options')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('menu_item_id', itemId)
    .eq('id', optionId)
    .select('*')
    .single();
  if (error) fail(error);
  return mapOption(data as OptionRow);
}

export async function deleteRestaurantMenuOption(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  itemId: string,
  optionId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<void> {
  const client = hierarchyClient(baseClient);
  await readItem(restaurantId, menuId, sectionId, itemId, client);
  const { data, error } = await client
    .from('restaurant_menu_item_options')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('menu_item_id', itemId)
    .eq('id', optionId)
    .select('id');
  if (error) fail(error);
  if (!data || data.length === 0) throw new MenuHierarchyError('not_found');
}

// --- reorder ----------------------------------------------------------------------------------

export type { MenuChildOrder, MenuReorderTarget };

function parseChildOrder(data: unknown): MenuChildOrder[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, displayOrder } = entry as { id?: unknown; displayOrder?: unknown };
    return typeof id === 'string' && typeof displayOrder === 'number' ? [{ id, displayOrder }] : [];
  });
}

/**
 * Renumbers one parent's children 0..n-1 in the given order, in one transaction. The ids must
 * be exactly the parent's current children in this restaurant; otherwise `order_stale`.
 */
export async function reorderRestaurantMenuChildren(
  restaurantId: string,
  target: MenuReorderTarget,
  orderedIds: readonly string[],
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<MenuChildOrder[]> {
  const client = hierarchyClient(baseClient);
  const ids = [...orderedIds];
  const { data, error } =
    target.level === 'sections'
      ? await client.rpc('reorder_restaurant_menu_sections_v1', {
          p_restaurant_id: restaurantId,
          p_menu_id: target.menuId,
          p_ordered_ids: ids,
        })
      : target.level === 'items'
        ? await client.rpc('reorder_restaurant_menu_items_v1', {
            p_restaurant_id: restaurantId,
            p_menu_id: target.menuId,
            p_section_id: target.sectionId,
            p_ordered_ids: ids,
          })
        : await client.rpc('reorder_restaurant_menu_item_options_v1', {
            p_restaurant_id: restaurantId,
            p_menu_id: target.menuId,
            p_section_id: target.sectionId,
            p_item_id: target.itemId,
            p_ordered_ids: ids,
          });
  if (error) fail(error);
  return parseChildOrder(data);
}
