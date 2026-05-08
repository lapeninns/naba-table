import { getServiceSupabaseClient } from '@/server/supabase';

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
    Functions: Record<string, never>;
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
        return buildCanonicalMenuLabel({
          displayName: record.displayName,
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

function primaryLabel(labels: readonly CanonicalMenuLabel[], fallback: string): string {
  return labels[0]?.displayName?.trim() || fallback;
}

function primaryDescription(labels: readonly CanonicalMenuLabel[]): string | null {
  return labels[0]?.description ?? null;
}

function parseAttributes(value: Json | null): CanonicalMenuItemAttributes {
  return parseRecord(value) as CanonicalMenuItemAttributes;
}

function moneyAmount(attributes: CanonicalMenuItemAttributes): number {
  return attributes.price?.amount ?? 0;
}

function moneyCurrency(attributes: CanonicalMenuItemAttributes): string {
  return attributes.price?.currencyCode ?? 'GBP';
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
  const labels = parseLabels(
    row.labels,
    row.legacy_subcategory ?? row.legacy_category ?? 'Section',
  );
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    menuId: row.menu_id,
    labels,
    displayOrder: row.display_order,
    active: row.active,
    legacyCategory: row.legacy_category,
    legacySubcategory: row.legacy_subcategory,
    legacySource: parseRecord(row.legacy_source),
    items: items
      .filter((item) => item.section_id === row.id)
      .sort((left, right) => left.display_order - right.display_order)
      .map((item) =>
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

async function readSection(
  restaurantId: string,
  sectionId: string,
  client: DbClient,
): Promise<SectionRow> {
  const { data, error } = await client
    .from('restaurant_menu_sections')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', sectionId)
    .single();
  if (error) throw error;
  return data as SectionRow;
}

async function upsertItemExtensions({
  restaurantId,
  menuItemId,
  extensions,
  client,
}: {
  restaurantId: string;
  menuItemId: string;
  extensions: NabatableMenuItemExtensions;
  client: DbClient;
}): Promise<void> {
  const { error } = await client.from('restaurant_menu_item_extensions').upsert({
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    drink_profile: toJson(extensions.drinkProfile),
    recommendation_metadata: toJson(extensions.recommendationMetadata),
    availability_policy: toJson(extensions.availabilityPolicy),
    customization_controls: toJson(extensions.customizationControls),
    source_metadata: toJson(extensions.sourceMetadata),
  });
  if (error) throw error;
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
      labels: toJson(input.labels),
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
  if (error) throw error;
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
  if (input.labels) patch.labels = toJson(input.labels);
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
  if (error) throw error;
  return mapMenu(data as MenuRow, [], [], [], []);
}

export async function deleteRestaurantMenu(
  restaurantId: string,
  menuId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<void> {
  const client = hierarchyClient(baseClient);
  const { error } = await client
    .from('restaurant_menus')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', menuId);
  if (error) throw error;
}

export async function createRestaurantMenuSection(
  restaurantId: string,
  menuId: string,
  input: RestaurantMenuSectionInput,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuSection> {
  const client = hierarchyClient(baseClient);
  const { data, error } = await client
    .from('restaurant_menu_sections')
    .insert({
      restaurant_id: restaurantId,
      menu_id: menuId,
      labels: toJson(input.labels),
      display_order: input.displayOrder,
      active: input.active,
      legacy_category: input.legacyCategory,
      legacy_subcategory: input.legacySubcategory,
      legacy_source: toJson(input.legacySource),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapSection(data as SectionRow, [], [], []);
}

export async function updateRestaurantMenuSection(
  restaurantId: string,
  sectionId: string,
  input: RestaurantMenuSectionPatch,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuSection> {
  const client = hierarchyClient(baseClient);
  const patch: Update<SectionRow> = {};
  if (input.labels) patch.labels = toJson(input.labels);
  if (typeof input.displayOrder === 'number') patch.display_order = input.displayOrder;
  if (typeof input.active === 'boolean') patch.active = input.active;
  if ('legacyCategory' in input) patch.legacy_category = input.legacyCategory;
  if ('legacySubcategory' in input) patch.legacy_subcategory = input.legacySubcategory;
  if (input.legacySource) patch.legacy_source = toJson(input.legacySource);

  const { data, error } = await client
    .from('restaurant_menu_sections')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('id', sectionId)
    .select('*')
    .single();
  if (error) throw error;
  return mapSection(data as SectionRow, [], [], []);
}

export async function deleteRestaurantMenuSection(
  restaurantId: string,
  sectionId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<void> {
  const client = hierarchyClient(baseClient);
  const { error } = await client
    .from('restaurant_menu_sections')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', sectionId);
  if (error) throw error;
}

export async function createRestaurantMenuItem(
  restaurantId: string,
  menuId: string,
  sectionId: string,
  input: RestaurantMenuItemInput,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuItem> {
  const client = hierarchyClient(baseClient);
  const section = await readSection(restaurantId, sectionId, client);
  const labels = input.labels;
  const itemName = primaryLabel(labels, input.externalItemId);
  const category = section.legacy_category ?? primaryLabel(parseLabels(section.labels), 'Menu');
  const subcategory = section.legacy_subcategory ?? null;

  const { data, error } = await client
    .from('restaurant_menu_items')
    .insert({
      restaurant_id: restaurantId,
      menu_id: menuId,
      section_id: sectionId,
      item_kind: input.itemKind,
      external_item_id: input.externalItemId,
      item_name: itemName,
      category,
      subcategory,
      short_description: primaryDescription(labels),
      base_price: String(moneyAmount(input.attributes)),
      currency: moneyCurrency(input.attributes),
      display_order: input.displayOrder,
      active: input.active,
      labels: toJson(labels),
      google_attributes: toJson(input.attributes),
      google_media_keys: input.media.googleMediaKeys,
      local_media: toJson(input.media.localMedia),
      image_url: input.media.localImageUrl,
      legacy_source: toJson(input.legacySource),
    })
    .select(
      'id, restaurant_id, menu_id, section_id, item_kind, external_item_id, item_name, category, subcategory, base_price, currency, display_order, active, labels, google_attributes, google_media_keys, local_media, image_url, legacy_source, created_at, updated_at',
    )
    .single();
  if (error) throw error;
  await upsertItemExtensions({
    restaurantId,
    menuItemId: data.id,
    extensions: input.extensions,
    client,
  });
  return mapItem(data as ItemRow, [], undefined);
}

export async function updateRestaurantMenuItem(
  restaurantId: string,
  itemId: string,
  input: RestaurantMenuItemPatch,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuItem> {
  const client = hierarchyClient(baseClient);
  const patch: Update<ItemRow> = {};
  if (input.itemKind) patch.item_kind = input.itemKind;
  if (input.externalItemId) patch.external_item_id = input.externalItemId;
  if (input.labels) {
    patch.labels = toJson(input.labels);
    patch.item_name = primaryLabel(input.labels, input.externalItemId ?? 'Menu item');
    patch.short_description = primaryDescription(input.labels);
  }
  if (input.attributes) {
    patch.google_attributes = toJson(input.attributes);
    patch.base_price = String(moneyAmount(input.attributes));
    patch.currency = moneyCurrency(input.attributes);
  }
  if (input.media) {
    patch.google_media_keys = input.media.googleMediaKeys;
    patch.local_media = toJson(input.media.localMedia);
    patch.image_url = input.media.localImageUrl;
  }
  if (typeof input.displayOrder === 'number') patch.display_order = input.displayOrder;
  if (typeof input.active === 'boolean') patch.active = input.active;
  if (input.legacySource) patch.legacy_source = toJson(input.legacySource);

  const { data, error } = await client
    .from('restaurant_menu_items')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('id', itemId)
    .select(
      'id, restaurant_id, menu_id, section_id, item_kind, external_item_id, item_name, category, subcategory, base_price, currency, display_order, active, labels, google_attributes, google_media_keys, local_media, image_url, legacy_source, created_at, updated_at',
    )
    .single();
  if (error) throw error;
  if (input.extensions) {
    await upsertItemExtensions({
      restaurantId,
      menuItemId: data.id,
      extensions: input.extensions,
      client,
    });
  }
  return mapItem(data as ItemRow, [], undefined);
}

export async function deleteRestaurantMenuItem(
  restaurantId: string,
  itemId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<void> {
  const client = hierarchyClient(baseClient);
  const { error } = await client
    .from('restaurant_menu_items')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', itemId);
  if (error) throw error;
}

export async function createRestaurantMenuOption(
  restaurantId: string,
  itemId: string,
  input: RestaurantMenuOptionInput,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuOption> {
  const client = hierarchyClient(baseClient);
  const { data, error } = await client
    .from('restaurant_menu_item_options')
    .insert({
      restaurant_id: restaurantId,
      menu_item_id: itemId,
      external_option_id: input.externalOptionId,
      labels: toJson(input.labels),
      google_attributes: toJson(input.attributes),
      google_media_keys: input.media.googleMediaKeys,
      display_order: input.displayOrder,
      active: input.active,
      legacy_source: toJson(input.legacySource),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapOption(data as OptionRow);
}

export async function updateRestaurantMenuOption(
  restaurantId: string,
  optionId: string,
  input: RestaurantMenuOptionPatch,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<CanonicalRestaurantMenuOption> {
  const client = hierarchyClient(baseClient);
  const patch: Update<OptionRow> = {};
  if ('externalOptionId' in input) patch.external_option_id = input.externalOptionId;
  if (input.labels) patch.labels = toJson(input.labels);
  if (input.attributes) patch.google_attributes = toJson(input.attributes);
  if (input.media) patch.google_media_keys = input.media.googleMediaKeys;
  if (typeof input.displayOrder === 'number') patch.display_order = input.displayOrder;
  if (typeof input.active === 'boolean') patch.active = input.active;
  if (input.legacySource) patch.legacy_source = toJson(input.legacySource);

  const { data, error } = await client
    .from('restaurant_menu_item_options')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('id', optionId)
    .select('*')
    .single();
  if (error) throw error;
  return mapOption(data as OptionRow);
}

export async function deleteRestaurantMenuOption(
  restaurantId: string,
  optionId: string,
  baseClient: BaseDbClient = getServiceSupabaseClient(),
): Promise<void> {
  const client = hierarchyClient(baseClient);
  const { error } = await client
    .from('restaurant_menu_item_options')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', optionId);
  if (error) throw error;
}
