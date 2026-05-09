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
  type CanonicalMenuItemAttributes,
  type CanonicalRestaurantMenu,
  type CanonicalRestaurantMenuItem,
  type CanonicalRestaurantMenuOption,
  type CanonicalRestaurantMenuSection,
  type MenuItemKind,
  type MenuKind,
  type NabatableMenuItemExtensions,
  type RestaurantMenuItemInput,
} from '@/server/menu-hierarchy/types';

import {
  preparationMethodsToText,
  type FoodMenusLocalItem,
  type FoodMenusLocalModifierGroup,
  type FoodMenusLocalModifierOption,
  type GoogleFoodMenuAllergen,
  type GoogleFoodMenuDietaryRestriction,
  type GoogleFoodMenuPreparationMethod,
  type GoogleFoodMenuSpiciness,
  type GoogleFoodMenusImportItemSuggestedPatch,
  type GoogleFoodMenusImportTargetKind,
} from './food-menus';

import type { FoodMenusImportReviewDecisionAction } from './food-menus-sync';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

type CanonicalLocation = {
  menu: CanonicalRestaurantMenu;
  section: CanonicalRestaurantMenuSection;
  item: CanonicalRestaurantMenuItem;
};

const DEFAULT_CREATED_AT = '1970-01-01T00:00:00.000Z';

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

function primaryLabelText(
  entity:
    | Pick<CanonicalRestaurantMenu, 'labels'>
    | Pick<CanonicalRestaurantMenuSection, 'labels'>
    | Pick<CanonicalRestaurantMenuItem, 'labels'>
    | Pick<CanonicalRestaurantMenuOption, 'labels'>,
  fallback: string,
): string {
  return cleanText(entity.labels[0]?.displayName) ?? fallback;
}

function primaryDescription(entity: Pick<CanonicalRestaurantMenuItem, 'labels'>): string | null {
  return cleanText(entity.labels[0]?.description);
}

function amountValue(value: {
  quantity?: number | null;
  lowerAmount?: number | null;
  upperAmount?: number | null;
}) {
  return typeof value.lowerAmount === 'number'
    ? value.lowerAmount
    : typeof value.quantity === 'number'
      ? value.quantity
      : typeof value.upperAmount === 'number'
        ? value.upperAmount
        : null;
}

function nutritionValue(
  value:
    | {
        unit?: string | null;
        quantity?: number | null;
        lowerAmount?: number | null;
        upperAmount?: number | null;
      }
    | undefined,
  targetUnit: 'g' | 'mg' | 'kcal',
): number | null {
  if (!value) return null;
  const amount = amountValue(value);
  if (amount === null) return null;
  const unit = cleanText(value.unit)?.toLowerCase() ?? '';
  if (targetUnit === 'kcal') {
    return !unit || /^(k?cal|calorie|calories|kilocalorie|kilocalories)$/.test(unit)
      ? Math.round(amount)
      : null;
  }
  if (targetUnit === 'g') {
    if (/^(g|gram|grams)$/.test(unit)) return Number(amount.toFixed(2));
    if (/^(mg|milligram|milligrams)$/.test(unit)) return Number((amount / 1000).toFixed(2));
    return null;
  }
  if (/^(mg|milligram|milligrams)$/.test(unit)) return Number(amount.toFixed(2));
  if (/^(g|gram|grams)$/.test(unit)) return Number((amount * 1000).toFixed(2));
  return null;
}

function spicinessToText(value: GoogleFoodMenuSpiciness | null | undefined): string | null {
  switch (value) {
    case 'MILD':
      return 'Mild';
    case 'MEDIUM':
      return 'Medium';
    case 'HOT':
      return 'Hot';
    default:
      return null;
  }
}

function textToSpiciness(value: string | null | undefined): GoogleFoodMenuSpiciness | null {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('hot') || normalized.includes('spicy')) return 'HOT';
  if (normalized.includes('medium')) return 'MEDIUM';
  if (normalized.includes('mild')) return 'MILD';
  return null;
}

function allergenToTag(value: GoogleFoodMenuAllergen): string {
  switch (value) {
    case 'DAIRY':
      return 'Milk';
    case 'EGG':
      return 'Egg';
    case 'FISH':
      return 'Fish';
    case 'PEANUT':
      return 'Peanut';
    case 'SHELLFISH':
      return 'Shellfish';
    case 'SOY':
      return 'Soya';
    case 'TREE_NUT':
      return 'Nuts';
    case 'WHEAT':
      return 'Wheat';
  }
}

function tagToAllergen(value: string): GoogleFoodMenuAllergen | null {
  const normalized = value.toLowerCase();
  if (/(milk|dairy|cheese|cream|butter|yoghurt|yogurt)/.test(normalized)) return 'DAIRY';
  if (/\begg\b/.test(normalized)) return 'EGG';
  if (/\bfish\b/.test(normalized)) return 'FISH';
  if (/\bpeanut/.test(normalized)) return 'PEANUT';
  if (/(shellfish|crustacean|prawn|shrimp|lobster|crab)/.test(normalized)) return 'SHELLFISH';
  if (/\bsoy\b|\bsoya\b/.test(normalized)) return 'SOY';
  if (/(tree nut|nut|almond|cashew|hazelnut|walnut|pistachio)/.test(normalized)) return 'TREE_NUT';
  if (/(wheat|gluten)/.test(normalized)) return 'WHEAT';
  return null;
}

function dietaryRestrictionToTag(value: GoogleFoodMenuDietaryRestriction): string {
  switch (value) {
    case 'HALAL':
      return 'Halal';
    case 'KOSHER':
      return 'Kosher';
    case 'ORGANIC':
      return 'Organic';
    case 'VEGAN':
      return 'Vegan';
    case 'VEGETARIAN':
      return 'Vegetarian';
  }
}

function tagToDietaryRestriction(value: string): GoogleFoodMenuDietaryRestriction | null {
  const normalized = value.toLowerCase();
  if (normalized.includes('vegan')) return 'VEGAN';
  if (normalized.includes('vegetarian') || normalized === 'veggie') return 'VEGETARIAN';
  if (normalized.includes('halal')) return 'HALAL';
  if (normalized.includes('kosher')) return 'KOSHER';
  if (normalized.includes('organic')) return 'ORGANIC';
  return null;
}

function textToPreparationMethod(
  value: string | null | undefined,
): GoogleFoodMenuPreparationMethod | null {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('barbecue') || normalized.includes('bbq')) return 'BARBECUED';
  if (normalized.includes('pan fried') || normalized.includes('pan-fried')) return 'PAN_FRIED';
  if (normalized.includes('stir fried') || normalized.includes('stir-fried')) return 'STIR_FRIED';
  if (normalized.includes('baked')) return 'BAKED';
  if (normalized.includes('boiled')) return 'BOILED';
  if (normalized.includes('braised')) return 'BRAISED';
  if (normalized.includes('fried')) return 'FRIED';
  if (normalized.includes('grilled')) return 'GRILLED';
  if (normalized.includes('roasted')) return 'ROASTED';
  if (normalized.includes('sauteed') || normalized.includes('sautéed')) return 'SAUTEED';
  if (normalized.includes('smoked')) return 'SMOKED';
  if (normalized.includes('steamed')) return 'STEAMED';
  return 'OTHER_METHOD';
}

function uniqueSorted<T extends string>(values: ReadonlyArray<T | null | undefined>): T[] {
  return Array.from(new Set(values.filter((value): value is T => Boolean(value)))).sort(
    (left, right) => left.localeCompare(right),
  );
}

function sectionLabel(section: CanonicalRestaurantMenuSection): string {
  const category = cleanText(section.legacyCategory);
  const subcategory = cleanText(section.legacySubcategory);
  if (category) return subcategory ? `${category} - ${subcategory}` : category;
  return primaryLabelText(section, 'Menu');
}

function canonicalOptionsToModifierGroup(
  restaurantId: string,
  item: CanonicalRestaurantMenuItem,
  basePrice: number,
): FoodMenusLocalModifierGroup[] {
  const options = item.options
    .filter((option) => option.active)
    .map((option, optionIndex): FoodMenusLocalModifierOption => {
      const optionPrice = option.attributes.price?.amount;
      return {
        id: option.id,
        restaurantId,
        menuItemId: item.id,
        externalModifierOptionId:
          option.externalOptionId ?? option.id ?? `canonical-option-${optionIndex + 1}`,
        optionName: primaryLabelText(option, option.externalOptionId ?? 'Option'),
        priceDelta:
          typeof optionPrice === 'number' ? Number((optionPrice - basePrice).toFixed(2)) : 0,
        defaultSelected: false,
        availabilityStatus: option.active ? 'available' : 'unavailable',
        displayOrder: option.displayOrder,
      };
    });
  return options.length
    ? [
        {
          id: `${item.id ?? item.externalItemId}-options`,
          restaurantId,
          menuItemId: item.id,
          externalModifierGroupId: 'canonical-options',
          groupName: 'Options',
          required: false,
          minSelect: 0,
          maxSelect: Math.max(1, options.length),
          displayOrder: 0,
          options,
        },
      ]
    : [];
}

function canonicalItemToLocal(
  menu: CanonicalRestaurantMenu,
  section: CanonicalRestaurantMenuSection,
  item: CanonicalRestaurantMenuItem,
): FoodMenusLocalItem {
  const basePrice = item.attributes.price?.amount ?? 0;
  const currency = item.attributes.price?.currencyCode ?? 'GBP';
  const nutritionFacts = item.attributes.nutritionFacts ?? {};
  const soldOut = item.extensions.availabilityPolicy.soldOut === true;
  const sectionName = sectionLabel(section);
  const [categoryFallback, ...subcategoryFallbackParts] = sectionName.split(/\s+-\s+/);
  return {
    id: item.id ?? item.externalItemId,
    restaurantId: item.restaurantId,
    externalItemId: item.externalItemId,
    itemName: primaryLabelText(item, item.externalItemId),
    category: cleanText(section.legacyCategory) ?? cleanText(categoryFallback) ?? 'Menu',
    subcategory:
      cleanText(section.legacySubcategory) ?? cleanText(subcategoryFallbackParts.join(' - ')),
    shortDescription: primaryDescription(item),
    fullDescription: null,
    basePrice,
    currency,
    serviceTime: null,
    availabilityStatus: soldOut || !item.active ? 'unavailable' : 'available',
    keyIngredients: (item.attributes.ingredients ?? []).flatMap((ingredient) =>
      ingredient.labels.map((label) => label.displayName),
    ),
    mainProteinOrBase: null,
    cookingStyle: null,
    preparationMethod: preparationMethodsToText(item.attributes.preparationMethods),
    flavorProfile: null,
    texture: null,
    spiceLevel: spicinessToText(item.attributes.spiciness),
    spiceAdjustable: false,
    portionSize: item.attributes.portionSize
      ? primaryLabelText({ labels: item.attributes.portionSize.unit }, 'Portion')
      : null,
    shareable: false,
    recommendationTags: uniqueSorted([
      ...((item.extensions.recommendationMetadata.recommendationTags as string[] | undefined) ??
        []),
      item.extensions.recommendationMetadata.signature === true ? 'signature' : null,
      item.extensions.recommendationMetadata.featured === true ? 'featured' : null,
    ]),
    pairings: [],
    signatureScore:
      typeof item.extensions.recommendationMetadata.popularityScore === 'number'
        ? item.extensions.recommendationMetadata.popularityScore
        : null,
    popularityScore:
      typeof item.extensions.recommendationMetadata.popularityScore === 'number'
        ? item.extensions.recommendationMetadata.popularityScore
        : null,
    dietaryTags: uniqueSorted(
      (item.attributes.dietaryRestriction ?? []).map(dietaryRestrictionToTag),
    ),
    allergensContains: uniqueSorted((item.attributes.allergen ?? []).map(allergenToTag)),
    allergensMayContain: [],
    removableIngredients: [],
    substitutionsAllowed: false,
    canBeMadeVegetarian: item.attributes.dietaryRestriction?.includes('VEGETARIAN') ?? false,
    canBeMadeVegan: item.attributes.dietaryRestriction?.includes('VEGAN') ?? false,
    canBeMadeGlutenFree: false,
    customizationRules: null,
    servingNotes: null,
    active: item.active,
    seasonal: item.extensions.availabilityPolicy.availabilityStatus === 'seasonal',
    limitedTime: false,
    soldOut,
    displayOrder: item.displayOrder,
    imageUrl: item.media.localImageUrl ?? null,
    caloriesKcal: nutritionValue(nutritionFacts.calories, 'kcal'),
    proteinG: nutritionValue(nutritionFacts.protein, 'g'),
    fatG: nutritionValue(nutritionFacts.totalFat, 'g'),
    saturatedFatG: nutritionValue(nutritionFacts.saturatedFat, 'g'),
    carbsG: nutritionValue(nutritionFacts.totalCarbohydrate, 'g'),
    sugarG: nutritionValue(nutritionFacts.sugars, 'g'),
    fiberG: nutritionValue(nutritionFacts.dietaryFiber, 'g'),
    sodiumMg: nutritionValue(nutritionFacts.sodium, 'mg'),
    servesNum: item.attributes.servesNumPeople ?? item.attributes.servesNum ?? null,
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT,
    modifierGroups: canonicalOptionsToModifierGroup(item.restaurantId, item, basePrice),
    targetKind: item.itemKind,
  };
}

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

function nutritionAmount(value: number | null | undefined, unit: 'CALORIE' | 'GRAM' | 'MILLIGRAM') {
  return typeof value === 'number' && Number.isFinite(value)
    ? { lowerAmount: value, unit }
    : undefined;
}

function mergeAttributes(
  current: CanonicalMenuItemAttributes,
  patch: GoogleFoodMenusImportItemSuggestedPatch,
): CanonicalMenuItemAttributes {
  const attributes: CanonicalMenuItemAttributes = {
    ...current,
    price: {
      currencyCode: patch.currency ?? current.price?.currencyCode ?? 'GBP',
      amount: patch.basePrice ?? current.price?.amount ?? null,
    },
  };
  if ('spiceLevel' in patch) attributes.spiciness = textToSpiciness(patch.spiceLevel) ?? undefined;
  if (patch.dietaryTags) {
    attributes.dietaryRestriction = uniqueSorted(patch.dietaryTags.map(tagToDietaryRestriction));
  }
  if (patch.allergensContains) {
    attributes.allergen = uniqueSorted(patch.allergensContains.map(tagToAllergen));
  }
  if (patch.preparationMethod !== undefined) {
    const method = textToPreparationMethod(patch.preparationMethod);
    attributes.preparationMethods = method ? [method] : [];
  }
  if (patch.keyIngredients) {
    attributes.ingredients = patch.keyIngredients.map((ingredient) => ({
      labels: [buildCanonicalMenuLabel({ displayName: ingredient })],
    }));
  }
  if (patch.portionSize !== undefined) {
    attributes.portionSize = patch.portionSize
      ? { quantity: 1, unit: [buildCanonicalMenuLabel({ displayName: patch.portionSize })] }
      : undefined;
  }
  const nutritionFacts = {
    ...current.nutritionFacts,
    ...(patch.caloriesKcal !== undefined
      ? { calories: nutritionAmount(patch.caloriesKcal, 'CALORIE') }
      : {}),
    ...(patch.proteinG !== undefined ? { protein: nutritionAmount(patch.proteinG, 'GRAM') } : {}),
    ...(patch.fatG !== undefined ? { totalFat: nutritionAmount(patch.fatG, 'GRAM') } : {}),
    ...(patch.saturatedFatG !== undefined
      ? { saturatedFat: nutritionAmount(patch.saturatedFatG, 'GRAM') }
      : {}),
    ...(patch.carbsG !== undefined
      ? { totalCarbohydrate: nutritionAmount(patch.carbsG, 'GRAM') }
      : {}),
    ...(patch.sugarG !== undefined ? { sugars: nutritionAmount(patch.sugarG, 'GRAM') } : {}),
    ...(patch.fiberG !== undefined ? { dietaryFiber: nutritionAmount(patch.fiberG, 'GRAM') } : {}),
    ...(patch.sodiumMg !== undefined
      ? { sodium: nutritionAmount(patch.sodiumMg, 'MILLIGRAM') }
      : {}),
  };
  attributes.nutritionFacts = Object.fromEntries(
    Object.entries(nutritionFacts).filter(([, value]) => value !== undefined),
  ) as CanonicalMenuItemAttributes['nutritionFacts'];
  if (patch.servesNum !== undefined) attributes.servesNumPeople = patch.servesNum;
  return attributes;
}

function mergeExtensions(
  current: NabatableMenuItemExtensions,
  patch: GoogleFoodMenusImportItemSuggestedPatch,
  source: Record<string, unknown>,
): NabatableMenuItemExtensions {
  return {
    ...current,
    sourceMetadata: {
      ...current.sourceMetadata,
      ...source,
    },
    availabilityPolicy: {
      ...current.availabilityPolicy,
      ...(patch.basePrice !== undefined || patch.itemName || patch.shortDescription
        ? { availabilityStatus: current.availabilityPolicy.availabilityStatus ?? 'available' }
        : {}),
    },
  };
}

function itemPatchFromSuggestedPatch(
  current: CanonicalRestaurantMenuItem,
  patch: GoogleFoodMenusImportItemSuggestedPatch,
  source: Record<string, unknown>,
) {
  return {
    ...(patch.externalItemId ? { externalItemId: patch.externalItemId } : {}),
    labels:
      patch.itemName !== undefined || patch.shortDescription !== undefined
        ? [
            buildCanonicalMenuLabel({
              displayName: patch.itemName ?? primaryLabelText(current, current.externalItemId),
              description:
                patch.shortDescription !== undefined
                  ? patch.shortDescription
                  : primaryDescription(current),
              languageCode: current.labels[0]?.languageCode ?? DEFAULT_MENU_LANGUAGE_CODE,
            }),
          ]
        : undefined,
    attributes: mergeAttributes(current.attributes, patch),
    media:
      patch.imageUrl !== undefined
        ? { ...current.media, localImageUrl: patch.imageUrl ?? undefined }
        : undefined,
    extensions: mergeExtensions(current.extensions, patch, source),
  };
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

function menuKindForTarget(targetKind: GoogleFoodMenusImportTargetKind): MenuKind {
  return targetKind === 'drink' ? 'drinks' : 'food';
}

function itemKindForTarget(targetKind: GoogleFoodMenusImportTargetKind): MenuItemKind {
  return targetKind === 'drink' ? 'drink' : 'food';
}

function defaultMenuLabel(targetKind: GoogleFoodMenusImportTargetKind): string {
  return targetKind === 'drink' ? 'Drinks' : 'Food';
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

function inputFromSuggestedPatch({
  restaurantId,
  targetKind,
  patch,
  reviewId,
}: {
  restaurantId: string;
  targetKind: GoogleFoodMenusImportTargetKind;
  patch: GoogleFoodMenusImportItemSuggestedPatch & {
    externalItemId: string;
    itemName: string;
    category: string;
    basePrice: number;
  };
  reviewId: string;
}): RestaurantMenuItemInput {
  return {
    itemKind: itemKindForTarget(targetKind),
    externalItemId: patch.externalItemId,
    labels: [
      buildCanonicalMenuLabel({
        displayName: patch.itemName,
        description: patch.shortDescription ?? null,
      }),
    ],
    attributes: mergeAttributes(
      {
        price: { amount: patch.basePrice, currencyCode: patch.currency ?? 'GBP' },
        allergen: [],
        dietaryRestriction: [],
        ingredients: [],
        preparationMethods: [],
        mediaKeys: [],
        nutritionFacts: {},
      },
      patch,
    ),
    media: { googleMediaKeys: [], localImageUrl: patch.imageUrl ?? undefined, localMedia: {} },
    extensions: {
      drinkProfile: {},
      recommendationMetadata: {},
      availabilityPolicy: { availabilityStatus: 'available', soldOut: false, orderable: true },
      customizationControls: {},
      sourceMetadata: {
        sourceSystem: 'google_foodmenus_import_review',
        sourceItemId: patch.externalItemId,
        importReviewId: reviewId,
        importedAt: new Date().toISOString(),
      },
    },
    displayOrder: 0,
    active: true,
    legacySource: {
      sourceSystem: 'google_foodmenus_import_review',
      sourceItemId: patch.externalItemId,
      restaurantId,
    },
  };
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
