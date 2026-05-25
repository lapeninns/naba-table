import {
  createRestaurantMenu,
  createRestaurantMenuItem,
  createRestaurantMenuOption,
  createRestaurantMenuSection,
  deleteRestaurantMenuItem,
  listRestaurantMenuHierarchy,
  updateRestaurantMenuItem,
  updateRestaurantMenuOption,
} from '@/server/menu-hierarchy/repository';
import {
  DEFAULT_MENU_LANGUAGE_CODE,
  buildCanonicalMenuLabel,
  type CanonicalRestaurantMenu,
  type CanonicalRestaurantMenuItem,
  type CanonicalRestaurantMenuSection,
  type NabatableMenuItemExtensions,
} from '@/server/menu-hierarchy/types';

import {
  type FoodMenusLocalItem,
  type FoodMenusLocalModifierGroup,
  type GoogleFoodMenusImportItemSuggestedPatch,
  type GoogleFoodMenusImportTargetKind,
} from './food-menus';
import {
  canonicalItemToLocal,
  cleanText,
  defaultMenuLabel,
  inputFromSuggestedPatch,
  itemPatchFromSuggestedPatch,
  menuKindForTarget,
  primaryLabelText,
} from './food-menus-canonical-domain';

import type { FoodMenusImportReviewDecisionAction } from './food-menus-import-decision-domain';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

type CanonicalLocation = {
  menu: CanonicalRestaurantMenu;
  section: CanonicalRestaurantMenuSection;
  item: CanonicalRestaurantMenuItem;
};

export async function listCanonicalFoodMenusImportItems(
  restaurantId: string,
  client: DbClient,
): Promise<FoodMenusLocalItem[]> {
  const hierarchy = await listRestaurantMenuHierarchy(restaurantId, client);
  return hierarchy.menus
    .filter((menu) => menu.active)
    .flatMap((menu) =>
      menu.sections
        .filter((section) => section.active)
        .flatMap((section) =>
          section.items
            .filter((item) => item.active)
            .map((item) => canonicalItemToLocal(menu, section, item)),
        ),
    );
}

function findCanonicalLocation(
  hierarchy: { menus: CanonicalRestaurantMenu[] },
  itemId: string,
): CanonicalLocation | null {
  for (const menu of hierarchy.menus) {
    for (const section of menu.sections) {
      for (const item of section.items) {
        if (item.id === itemId) return { menu, section, item };
      }
    }
  }
  return null;
}

async function readCanonicalLocation(
  restaurantId: string,
  itemId: string,
  client: DbClient,
): Promise<CanonicalLocation> {
  const location = findCanonicalLocation(
    await listRestaurantMenuHierarchy(restaurantId, client),
    itemId,
  );
  if (!location || !location.item.id || !location.menu.id || !location.section.id) {
    const error = new Error('Matched canonical menu item was not found.');
    error.name = 'GBP_FOOD_MENUS_MENU_ITEM_NOT_FOUND';
    throw error;
  }
  return location;
}

async function syncCanonicalOptions({
  restaurantId,
  menuId,
  sectionId,
  item,
  modifierGroups,
  basePrice,
  client,
}: {
  restaurantId: string;
  menuId: string;
  sectionId: string;
  item: CanonicalRestaurantMenuItem;
  modifierGroups: readonly FoodMenusLocalModifierGroup[];
  basePrice: number;
  client: DbClient;
}) {
  if (!item.id) return;
  const existingByExternalId = new Map(
    item.options
      .filter((option) => option.externalOptionId)
      .map((option) => [option.externalOptionId!, option]),
  );
  const flattened = modifierGroups.flatMap((group) =>
    group.options.map((option) => ({ group, option })),
  );
  for (const [index, { group, option }] of flattened.entries()) {
    const optionPrice = Number((basePrice + option.priceDelta).toFixed(2));
    const payload = {
      externalOptionId: option.externalModifierOptionId,
      labels: [buildCanonicalMenuLabel({ displayName: option.optionName })],
      attributes: {
        price: { amount: optionPrice, currencyCode: 'GBP' },
        allergen: [],
        dietaryRestriction: [],
        ingredients: [],
        preparationMethods: [],
        mediaKeys: [],
        nutritionFacts: {},
      },
      media: { googleMediaKeys: [], localMedia: {} },
      displayOrder: option.displayOrder ?? index,
      active: option.availabilityStatus !== 'unavailable',
      legacySource: { sourceSystem: 'google_foodmenus_import_review', groupName: group.groupName },
    };
    const existing = existingByExternalId.get(option.externalModifierOptionId);
    if (existing?.id) {
      await updateRestaurantMenuOption(
        restaurantId,
        menuId,
        sectionId,
        item.id,
        existing.id,
        payload,
        client,
      );
    } else {
      await createRestaurantMenuOption(restaurantId, menuId, sectionId, item.id, payload, client);
    }
  }
}

export async function applyCanonicalFoodMenusSuggestedPatch({
  client,
  restaurantId,
  localItemId,
  suggestedPatch,
  reviewId,
}: {
  client: DbClient;
  restaurantId: string;
  localItemId: string;
  suggestedPatch: GoogleFoodMenusImportItemSuggestedPatch;
  reviewId: string;
}): Promise<CanonicalRestaurantMenuItem> {
  const { menu, section, item } = await readCanonicalLocation(restaurantId, localItemId, client);
  const updated = await updateRestaurantMenuItem(
    restaurantId,
    menu.id!,
    section.id!,
    item.id!,
    itemPatchFromSuggestedPatch(item, suggestedPatch, {
      sourceSystem: 'google_foodmenus_import_review',
      importReviewId: reviewId,
      editedFrom: 'google_foodmenus',
    }),
    client,
  );
  if (suggestedPatch.modifierGroups) {
    await syncCanonicalOptions({
      restaurantId,
      menuId: menu.id!,
      sectionId: section.id!,
      item: { ...item, ...updated },
      modifierGroups: suggestedPatch.modifierGroups,
      basePrice: suggestedPatch.basePrice ?? item.attributes.price?.amount ?? 0,
      client,
    });
  }
  return (await readCanonicalLocation(restaurantId, localItemId, client)).item;
}

async function ensureDefaultMenuAndSection({
  restaurantId,
  targetKind,
  category,
  subcategory,
  client,
}: {
  restaurantId: string;
  targetKind: GoogleFoodMenusImportTargetKind;
  category: string;
  subcategory: string | null;
  client: DbClient;
}) {
  const hierarchy = await listRestaurantMenuHierarchy(restaurantId, client);
  const expectedMenuKind = menuKindForTarget(targetKind);
  const menu =
    hierarchy.menus.find(
      (candidate) =>
        candidate.active &&
        (candidate.menuKind === expectedMenuKind || candidate.menuKind === 'mixed'),
    ) ??
    (await createRestaurantMenu(
      restaurantId,
      {
        labels: [buildCanonicalMenuLabel({ displayName: defaultMenuLabel(targetKind) })],
        sourceUrl: null,
        cuisines: [],
        defaultLanguageCode: DEFAULT_MENU_LANGUAGE_CODE,
        menuKind: expectedMenuKind,
        displayOrder: hierarchy.menus.length,
        active: true,
        legacySource: { sourceSystem: 'google_foodmenus_import_review' },
      },
      client,
    ));
  const sectionName = subcategory ? `${category} - ${subcategory}` : category;
  const section =
    menu.sections.find(
      (candidate) =>
        candidate.active &&
        cleanText(candidate.legacyCategory) === category &&
        cleanText(candidate.legacySubcategory) === subcategory,
    ) ??
    menu.sections.find(
      (candidate) => candidate.active && primaryLabelText(candidate, '') === sectionName,
    ) ??
    (await createRestaurantMenuSection(
      restaurantId,
      menu.id!,
      {
        labels: [buildCanonicalMenuLabel({ displayName: sectionName })],
        displayOrder: menu.sections.length,
        active: true,
        legacyCategory: category,
        legacySubcategory: subcategory,
        legacySource: { sourceSystem: 'google_foodmenus_import_review' },
      },
      client,
    ));
  return { menu, section };
}

export async function createCanonicalFoodMenusItemFromPatch({
  client,
  restaurantId,
  targetKind,
  suggestedPatch,
  reviewId,
}: {
  client: DbClient;
  restaurantId: string;
  targetKind: GoogleFoodMenusImportTargetKind;
  suggestedPatch: GoogleFoodMenusImportItemSuggestedPatch & {
    externalItemId: string;
    itemName: string;
    category: string;
    basePrice: number;
  };
  reviewId: string;
}): Promise<CanonicalRestaurantMenuItem> {
  const category = cleanText(suggestedPatch.category) ?? 'Google menu';
  const subcategory = cleanText(suggestedPatch.subcategory);
  const { menu, section } = await ensureDefaultMenuAndSection({
    restaurantId,
    targetKind,
    category,
    subcategory,
    client,
  });
  const item = await createRestaurantMenuItem(
    restaurantId,
    menu.id!,
    section.id!,
    inputFromSuggestedPatch({ restaurantId, targetKind, patch: suggestedPatch, reviewId }),
    client,
  );
  if (suggestedPatch.modifierGroups) {
    await syncCanonicalOptions({
      restaurantId,
      menuId: menu.id!,
      sectionId: section.id!,
      item,
      modifierGroups: suggestedPatch.modifierGroups,
      basePrice: suggestedPatch.basePrice,
      client,
    });
    return (await readCanonicalLocation(restaurantId, item.id!, client)).item;
  }
  return item;
}

export async function decideCanonicalMissingLocalFoodMenusItem({
  client,
  restaurantId,
  localItemId,
  action,
  reviewId,
}: {
  client: DbClient;
  restaurantId: string;
  localItemId: string;
  action: Extract<
    FoodMenusImportReviewDecisionAction,
    'mark_inactive' | 'mark_sold_out' | 'delete_local'
  >;
  reviewId: string;
}): Promise<CanonicalRestaurantMenuItem | null> {
  const { menu, section, item } = await readCanonicalLocation(restaurantId, localItemId, client);
  if (action === 'delete_local') {
    await deleteRestaurantMenuItem(restaurantId, menu.id!, section.id!, item.id!, client);
    return null;
  }
  const extensions: NabatableMenuItemExtensions = {
    ...item.extensions,
    availabilityPolicy: {
      ...item.extensions.availabilityPolicy,
      ...(action === 'mark_sold_out'
        ? { soldOut: true, orderable: false, availabilityStatus: 'unavailable' }
        : { availabilityStatus: 'unavailable', orderable: false }),
    },
    sourceMetadata: {
      ...item.extensions.sourceMetadata,
      editedFrom: 'google_foodmenus_import_review',
      importReviewId: reviewId,
    },
  };
  const updated = await updateRestaurantMenuItem(
    restaurantId,
    menu.id!,
    section.id!,
    item.id!,
    {
      ...(action === 'mark_inactive' ? { active: false } : {}),
      extensions,
    },
    client,
  );
  return updated;
}
