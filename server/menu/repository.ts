import { getServiceSupabaseClient } from '@/server/supabase';

import type {
  MenuFacetSet,
  MenuItemDetail,
  MenuItemSummary,
  MenuItemUpsertInput,
  MenuListFilters,
} from './types';
import type { Database, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type MenuItemRow = Tables<'restaurant_menu_items'>;
type ModifierGroupRow = Tables<'restaurant_menu_modifier_groups'>;
type ModifierOptionRow = Tables<'restaurant_menu_modifier_options'>;

function toNumber(value: string): number {
  return Number.parseFloat(value);
}

function normalizeStringList(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function mapMenuItemSummary(row: MenuItemRow, modifierGroupCount: number): MenuItemSummary {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    externalItemId: row.external_item_id,
    itemName: row.item_name,
    category: row.category,
    subcategory: row.subcategory ?? null,
    basePrice: toNumber(row.base_price),
    currency: row.currency,
    serviceTime: row.service_time ?? null,
    availabilityStatus: row.availability_status as MenuItemSummary['availabilityStatus'],
    active: row.active,
    soldOut: row.sold_out,
    displayOrder: row.display_order,
    imageUrl: row.image_url ?? null,
    modifierGroupCount,
    updatedAt: row.updated_at,
  };
}

function mapMenuItemDetail(
  item: MenuItemRow,
  groups: ModifierGroupRow[],
  options: ModifierOptionRow[],
): MenuItemDetail {
  return {
    id: item.id,
    restaurantId: item.restaurant_id,
    externalItemId: item.external_item_id,
    itemName: item.item_name,
    category: item.category,
    subcategory: item.subcategory ?? null,
    shortDescription: item.short_description ?? null,
    fullDescription: item.full_description ?? null,
    basePrice: toNumber(item.base_price),
    currency: item.currency,
    serviceTime: item.service_time ?? null,
    availabilityStatus: item.availability_status as MenuItemDetail['availabilityStatus'],
    keyIngredients: item.key_ingredients ?? [],
    mainProteinOrBase: item.main_protein_or_base ?? null,
    cookingStyle: item.cooking_style ?? null,
    preparationMethod: item.preparation_method ?? null,
    flavorProfile: item.flavor_profile ?? null,
    texture: item.texture ?? null,
    spiceLevel: item.spice_level ?? null,
    spiceAdjustable: item.spice_adjustable,
    portionSize: item.portion_size ?? null,
    shareable: item.shareable,
    recommendationTags: item.recommendation_tags ?? [],
    pairings: item.pairings ?? [],
    signatureScore: item.signature_score ?? null,
    popularityScore: item.popularity_score ?? null,
    dietaryTags: item.dietary_tags ?? [],
    allergensContains: item.allergens_contains ?? [],
    allergensMayContain: item.allergens_may_contain ?? [],
    removableIngredients: item.removable_ingredients ?? [],
    substitutionsAllowed: item.substitutions_allowed,
    canBeMadeVegetarian: item.can_be_made_vegetarian,
    canBeMadeVegan: item.can_be_made_vegan,
    canBeMadeGlutenFree: item.can_be_made_gluten_free,
    customizationRules: item.customization_rules ?? null,
    servingNotes: item.serving_notes ?? null,
    active: item.active,
    seasonal: item.seasonal,
    limitedTime: item.limited_time,
    soldOut: item.sold_out,
    displayOrder: item.display_order,
    imageUrl: item.image_url ?? null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    modifierGroups: groups.map((group) => ({
      id: group.id,
      restaurantId: group.restaurant_id,
      menuItemId: group.menu_item_id,
      externalModifierGroupId: group.external_modifier_group_id,
      groupName: group.group_name,
      required: group.required,
      minSelect: group.min_select,
      maxSelect: group.max_select,
      displayOrder: group.display_order,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      options: options
        .filter((option) => option.modifier_group_id === group.id)
        .map((option) => ({
          id: option.id,
          restaurantId: option.restaurant_id,
          modifierGroupId: option.modifier_group_id,
          externalModifierOptionId: option.external_modifier_option_id,
          optionName: option.option_name,
          priceDelta: toNumber(option.price_delta),
          defaultSelected: option.default_selected,
          availabilityStatus: option.availability_status as MenuItemDetail['availabilityStatus'],
          displayOrder: option.display_order,
          createdAt: option.created_at,
          updatedAt: option.updated_at,
        })),
    })),
  };
}

async function getMenuFacets(restaurantId: string, client: DbClient): Promise<MenuFacetSet> {
  const { data, error } = await client
    .from('restaurant_menu_items')
    .select('category, subcategory, service_time')
    .eq('restaurant_id', restaurantId);

  if (error) {
    throw error;
  }

  return {
    categories: normalizeStringList((data ?? []).map((row) => row.category)),
    subcategories: normalizeStringList((data ?? []).map((row) => row.subcategory)),
    serviceTimes: normalizeStringList((data ?? []).map((row) => row.service_time)),
  };
}

export async function listMenuItems(
  restaurantId: string,
  filters: MenuListFilters = {},
  client: DbClient = getServiceSupabaseClient(),
): Promise<{ items: MenuItemSummary[]; facets: MenuFacetSet }> {
  let query = client
    .from('restaurant_menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: true })
    .order('item_name', { ascending: true });

  if (filters.search?.trim()) {
    const escaped = filters.search.trim().replaceAll(',', '\\,');
    query = query.or(
      `item_name.ilike.%${escaped}%,category.ilike.%${escaped}%,subcategory.ilike.%${escaped}%`,
    );
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.subcategory) {
    query = query.eq('subcategory', filters.subcategory);
  }

  switch (filters.status) {
    case 'active':
      query = query.eq('active', true);
      break;
    case 'inactive':
      query = query.eq('active', false);
      break;
    case 'sold-out':
      query = query.eq('sold_out', true);
      break;
    case 'available':
      query = query.eq('availability_status', 'available');
      break;
    case 'unavailable':
      query = query.eq('availability_status', 'unavailable');
      break;
    default:
      break;
  }

  const [{ data: itemsData, error: itemsError }, facets] = await Promise.all([
    query,
    getMenuFacets(restaurantId, client),
  ]);

  if (itemsError) {
    throw itemsError;
  }

  const itemIds = (itemsData ?? []).map((item) => item.id);
  let modifierGroupCounts = new Map<string, number>();

  if (itemIds.length > 0) {
    const { data: groups, error: groupsError } = await client
      .from('restaurant_menu_modifier_groups')
      .select('id, menu_item_id')
      .eq('restaurant_id', restaurantId)
      .in('menu_item_id', itemIds);

    if (groupsError) {
      throw groupsError;
    }

    modifierGroupCounts = (groups ?? []).reduce((accumulator, group) => {
      accumulator.set(group.menu_item_id, (accumulator.get(group.menu_item_id) ?? 0) + 1);
      return accumulator;
    }, new Map<string, number>());
  }

  return {
    items: (itemsData ?? []).map((row) => mapMenuItemSummary(row, modifierGroupCounts.get(row.id) ?? 0)),
    facets,
  };
}

export async function getMenuItemDetail(
  restaurantId: string,
  itemId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<MenuItemDetail | null> {
  const { data: item, error: itemError } = await client
    .from('restaurant_menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', itemId)
    .maybeSingle();

  if (itemError) {
    throw itemError;
  }

  if (!item) {
    return null;
  }

  const { data: groups, error: groupsError } = await client
    .from('restaurant_menu_modifier_groups')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('menu_item_id', itemId)
    .order('display_order', { ascending: true });

  if (groupsError) {
    throw groupsError;
  }

  const groupIds = (groups ?? []).map((group) => group.id);
  const options =
    groupIds.length > 0
      ? await client
          .from('restaurant_menu_modifier_options')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .in('modifier_group_id', groupIds)
          .order('display_order', { ascending: true })
      : { data: [], error: null };

  if (options.error) {
    throw options.error;
  }

  return mapMenuItemDetail(item, groups ?? [], options.data ?? []);
}

export async function upsertMenuItem(
  restaurantId: string,
  item: MenuItemUpsertInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<MenuItemDetail> {
  const { data, error } = await client.rpc('upsert_restaurant_menu_item_with_modifiers', {
    p_restaurant_id: restaurantId,
    p_item: item,
  });

  if (error) {
    throw error;
  }

  const resolved = data as { id?: string } | null;
  if (!resolved?.id) {
    throw new Error('Menu item RPC did not return an item id');
  }

  const detail = await getMenuItemDetail(restaurantId, resolved.id, client);
  if (!detail) {
    throw new Error('Menu item was not found after upsert');
  }

  return detail;
}

export async function applyMenuImport(
  restaurantId: string,
  payload: {
    items: MenuItemUpsertInput[];
    modifierGroups: Array<{
      externalModifierGroupId: string;
      externalItemId: string;
      groupName: string;
      required: boolean;
      minSelect: number;
      maxSelect: number;
      displayOrder: number;
    }>;
    modifierOptions: Array<{
      externalModifierOptionId: string;
      externalModifierGroupId: string;
      optionName: string;
      priceDelta: number;
      defaultSelected: boolean;
      availabilityStatus: string;
      displayOrder: number;
    }>;
    replaceModifiers: boolean;
  },
  client: DbClient = getServiceSupabaseClient(),
): Promise<void> {
  const { error } = await client.rpc('import_restaurant_menu_bundle', {
    p_restaurant_id: restaurantId,
    p_items: payload.items,
    p_modifier_groups: payload.modifierGroups,
    p_modifier_options: payload.modifierOptions,
    p_replace_modifiers: payload.replaceModifiers,
  });

  if (error) {
    throw error;
  }
}

export async function getExistingMenuExternalIds(
  restaurantId: string,
  payload: {
    itemExternalIds: string[];
    modifierGroupExternalIds: string[];
    modifierOptionExternalIds: string[];
  },
  client: DbClient = getServiceSupabaseClient(),
): Promise<{
  itemExternalIds: Set<string>;
  modifierGroupExternalIds: Set<string>;
  modifierOptionExternalIds: Set<string>;
}> {
  const [items, groups, options] = await Promise.all([
    payload.itemExternalIds.length > 0
      ? client
          .from('restaurant_menu_items')
          .select('external_item_id')
          .eq('restaurant_id', restaurantId)
          .in('external_item_id', payload.itemExternalIds)
      : Promise.resolve({ data: [], error: null }),
    payload.modifierGroupExternalIds.length > 0
      ? client
          .from('restaurant_menu_modifier_groups')
          .select('external_modifier_group_id')
          .eq('restaurant_id', restaurantId)
          .in('external_modifier_group_id', payload.modifierGroupExternalIds)
      : Promise.resolve({ data: [], error: null }),
    payload.modifierOptionExternalIds.length > 0
      ? client
          .from('restaurant_menu_modifier_options')
          .select('external_modifier_option_id')
          .eq('restaurant_id', restaurantId)
          .in('external_modifier_option_id', payload.modifierOptionExternalIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (items.error) throw items.error;
  if (groups.error) throw groups.error;
  if (options.error) throw options.error;

  return {
    itemExternalIds: new Set((items.data ?? []).map((row) => row.external_item_id)),
    modifierGroupExternalIds: new Set((groups.data ?? []).map((row) => row.external_modifier_group_id)),
    modifierOptionExternalIds: new Set((options.data ?? []).map((row) => row.external_modifier_option_id)),
  };
}

export async function itemExistsForRestaurant(
  restaurantId: string,
  itemId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<boolean> {
  const { data, error } = await client
    .from('restaurant_menu_items')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

export async function menuItemExternalIdExistsForRestaurant(
  restaurantId: string,
  externalItemId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<boolean> {
  const { data, error } = await client
    .from('restaurant_menu_items')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('external_item_id', externalItemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}
