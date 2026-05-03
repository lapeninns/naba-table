import { hashCanonicalJson } from '@/server/dual-sync/hashing';

import type { DrinkItemDetail } from '@/server/drinks-menu/types';
import type {
  MenuItemDetail,
  MenuModifierGroupInput,
  MenuModifierOption,
} from '@/server/menu/types';

const DEFAULT_LANGUAGE_CODE = 'en-GB';
const DEFAULT_MENU_NAME = 'Food menu';
const LABEL_DISPLAY_NAME_LIMIT = 140;
const LABEL_DESCRIPTION_LIMIT = 1000;

export type GoogleFoodMenusResource = {
  name: string;
  menus: GoogleFoodMenu[];
};

export type GoogleFoodMenu = {
  labels: GoogleMenuLabel[];
  sourceUrl?: string;
  sections: GoogleFoodMenuSection[];
  cuisines?: GoogleFoodMenuCuisine[];
};

export type GoogleFoodMenuSection = {
  labels: GoogleMenuLabel[];
  items: GoogleFoodMenuItem[];
};

export type GoogleFoodMenuItem = {
  labels: GoogleMenuLabel[];
  attributes: GoogleFoodMenuItemAttributes;
  options?: GoogleFoodMenuItemOption[];
};

export type GoogleFoodMenuItemOption = {
  labels: GoogleMenuLabel[];
  attributes: GoogleFoodMenuItemAttributes;
};

export type GoogleFoodMenuItemAttributes = {
  price?: GoogleMoney;
  spiciness?: GoogleFoodMenuSpiciness;
  allergen?: GoogleFoodMenuAllergen[];
  dietaryRestriction?: GoogleFoodMenuDietaryRestriction[];
  ingredients?: Array<{ labels: GoogleMenuLabel[] }>;
  preparationMethods?: GoogleFoodMenuPreparationMethod[];
  portionSize?: {
    quantity: number;
    unit: GoogleMenuLabel[];
  };
  mediaKeys?: string[];
  nutritionFacts?: GoogleNutritionFacts;
  servesNumPeople?: number;
  servesNum?: number;
};

export type GoogleNutritionAmount = {
  unit?: string;
  quantity?: number;
  lowerAmount?: number;
  upperAmount?: number;
};

export type GoogleNutritionFacts = Partial<{
  calories: GoogleNutritionAmount;
  totalFat: GoogleNutritionAmount;
  saturatedFat: GoogleNutritionAmount;
  cholesterol: GoogleNutritionAmount;
  sodium: GoogleNutritionAmount;
  totalCarbohydrate: GoogleNutritionAmount;
  sugars: GoogleNutritionAmount;
  dietaryFiber: GoogleNutritionAmount;
  protein: GoogleNutritionAmount;
}>;

export type GoogleMenuLabel = {
  displayName: string;
  description?: string;
  languageCode: string;
};

export type GoogleMoney = {
  currencyCode: string;
  units: string;
  nanos: number;
};

export type GoogleFoodMenuSpiciness = 'MILD' | 'MEDIUM' | 'HOT';

export type GoogleFoodMenuAllergen =
  | 'DAIRY'
  | 'EGG'
  | 'FISH'
  | 'PEANUT'
  | 'SHELLFISH'
  | 'SOY'
  | 'TREE_NUT'
  | 'WHEAT';

export type GoogleFoodMenuDietaryRestriction =
  | 'HALAL'
  | 'KOSHER'
  | 'ORGANIC'
  | 'VEGAN'
  | 'VEGETARIAN';

export type GoogleFoodMenuPreparationMethod =
  | 'BAKED'
  | 'BARBECUED'
  | 'BASTED'
  | 'BLANCHED'
  | 'BOILED'
  | 'BRAISED'
  | 'CODDLED'
  | 'FERMENTED'
  | 'FRIED'
  | 'GRILLED'
  | 'KNEADED'
  | 'MARINATED'
  | 'PAN_FRIED'
  | 'PICKLED'
  | 'PRESSURE_COOKED'
  | 'ROASTED'
  | 'SAUTEED'
  | 'SEARED'
  | 'SIMMERED'
  | 'SMOKED'
  | 'STEAMED'
  | 'STEEPED'
  | 'STIR_FRIED'
  | 'OTHER_METHOD';

export type GoogleFoodMenuCuisine =
  | 'BREAK_FAST'
  | 'BRUNCH'
  | 'CHICKEN'
  | 'FAST_FOOD'
  | 'HAMBURGER'
  | 'INDIAN'
  | 'PIZZA'
  | 'SEAFOOD'
  | 'VEGETARIAN'
  | 'OTHER_CUISINE';

export type BuildGoogleFoodMenusProjectionInput = {
  foodMenusName: string;
  items: MenuItemDetail[];
  menuLabel?: string | null;
  sourceUrl?: string | null;
  languageCode?: string | null;
  includeUnavailable?: boolean;
  cuisines?: GoogleFoodMenuCuisine[];
};

export type GoogleFoodMenusProjectedIdentity = {
  stableKey: string;
  localItemId: string;
  externalItemId: string;
  itemName: string;
  sectionKey: string;
  sectionLabel: string;
  googlePath: string;
  googleOptionPaths: Array<{
    externalModifierGroupId: string;
    externalModifierOptionId: string;
    googlePath: string;
  }>;
};

export type GoogleFoodMenusProjectionSkippedItem = {
  localItemId: string;
  externalItemId: string;
  reason: 'inactive' | 'sold_out' | 'unavailable';
};

export type GoogleFoodMenusProjection = {
  foodMenus: GoogleFoodMenusResource;
  identities: GoogleFoodMenusProjectedIdentity[];
  skippedItems: GoogleFoodMenusProjectionSkippedItem[];
};

export type GoogleFoodMenusImportMatchConfidence =
  | 'previous_identity'
  | 'section_name_price'
  | 'section_name'
  | 'none';

export type GoogleFoodMenusImportTargetKind = 'food' | 'drink';

export type GoogleFoodMenusImportMenuMetadataPatch = Partial<{
  menuLabel: string | null;
  sourceUrl: string | null;
  cuisines: GoogleFoodMenuCuisine[];
  languageCode: string | null;
}>;

export type GoogleFoodMenusImportItemSuggestedPatch = Partial<
  Pick<
    MenuItemDetail,
    | 'externalItemId'
    | 'itemName'
    | 'category'
    | 'subcategory'
    | 'shortDescription'
    | 'basePrice'
    | 'currency'
    | 'spiceLevel'
    | 'preparationMethod'
    | 'portionSize'
    | 'keyIngredients'
    | 'imageUrl'
    | 'caloriesKcal'
    | 'proteinG'
    | 'fatG'
    | 'saturatedFatG'
    | 'carbsG'
    | 'sugarG'
    | 'fiberG'
    | 'sodiumMg'
    | 'servesNum'
    | 'dietaryTags'
    | 'allergensContains'
  >
> & {
  modifierGroups?: MenuModifierGroupInput[];
};

export type GoogleFoodMenusImportSuggestedPatch =
  | GoogleFoodMenusImportItemSuggestedPatch
  | GoogleFoodMenusImportMenuMetadataPatch;

export type GoogleFoodMenusImportReviewItem = {
  googlePath: string | null;
  googleSectionLabel: string | null;
  googleItemName: string | null;
  targetKind: GoogleFoodMenusImportTargetKind;
  match:
    | {
        status: 'matched';
        confidence: Exclude<GoogleFoodMenusImportMatchConfidence, 'none'>;
        localItemId: string;
        externalItemId: string;
      }
    | {
        status: 'unmatched';
        confidence: 'none';
      }
    | {
        status: 'missing_from_google';
        confidence: 'none';
        localItemId: string;
        externalItemId: string;
      }
    | {
        status: 'menu_metadata';
        confidence: 'none';
      };
  suggestedPatch: GoogleFoodMenusImportSuggestedPatch | null;
  warnings: string[];
};

export type GoogleFoodMenusImportReview = {
  items: GoogleFoodMenusImportReviewItem[];
  localItemsMissingFromGoogle: Array<{
    localItemId: string;
    externalItemId: string;
    itemName: string;
    targetKind: GoogleFoodMenusImportTargetKind;
    reason: 'not_present_in_google';
  }>;
};

export type BuildGoogleFoodMenusImportReviewInput = {
  googleFoodMenus: GoogleFoodMenusResource;
  localItems: MenuItemDetail[];
  localDrinkItems?: DrinkItemDetail[];
  previousIdentities?: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
  settings?: GoogleFoodMenuSettings | null;
};

export type GoogleFoodMenuSettings = {
  menuLabel: string | null;
  sourceUrl: string | null;
  cuisines: GoogleFoodMenuCuisine[];
  languageCode: string | null;
};

export type CanonicalGoogleFoodMenusResource = {
  name: string;
  menus: Array<{
    labels: GoogleMenuLabel[];
    sourceUrl: string | null;
    cuisines: GoogleFoodMenuCuisine[];
    sections: Array<{
      labels: GoogleMenuLabel[];
      items: Array<{
        labels: GoogleMenuLabel[];
        attributes: {
          price: { currencyCode: string; amount: number | null };
          spiciness: GoogleFoodMenuSpiciness | null;
          allergen: GoogleFoodMenuAllergen[];
          dietaryRestriction: GoogleFoodMenuDietaryRestriction[];
          ingredients: string[];
          preparationMethods: GoogleFoodMenuPreparationMethod[];
          portionSize: string | null;
          mediaKeys: string[];
          nutritionFacts: {
            calories: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            totalFat: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            saturatedFat: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            cholesterol: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            sodium: { unit: string | null; lowerAmount: number | null; upperAmount: number | null };
            totalCarbohydrate: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            sugars: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            dietaryFiber: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            protein: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
          };
          servesNumPeople: number | null;
        };
        options: Array<{
          labels: GoogleMenuLabel[];
          attributes: CanonicalGoogleFoodMenusResource['menus'][number]['sections'][number]['items'][number]['attributes'];
        }>;
      }>;
    }>;
  }>;
};

type ProjectedSection = {
  sectionKey: string;
  label: string;
  sortOrder: number;
  items: MenuItemDetail[];
};

type ImportLocalItem = MenuItemDetail & {
  targetKind: GoogleFoodMenusImportTargetKind;
};

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return value.slice(0, limit - 1).trimEnd();
}

function slugify(value: string | null | undefined, fallback: string): string {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return fallback;
  }
  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function classifyMenuTarget(menu: GoogleFoodMenu): GoogleFoodMenusImportTargetKind {
  const label = normalizeComparableText(getPrimaryLabel(menu.labels)?.displayName);
  if (!label) {
    return 'food';
  }
  if (/\bfood\b/.test(label) && /\b(drinks?|beverages?)\b/.test(label)) {
    return 'food';
  }
  return /\b(drinks?|beverages?|bar|cocktails?|wine|beer|cellar)\b/.test(label) ? 'drink' : 'food';
}

function drinkItemToImportLocalItem(item: DrinkItemDetail): ImportLocalItem {
  return {
    id: item.id,
    restaurantId: item.restaurantId,
    externalItemId: item.externalDrinkId,
    itemName: item.drinkName,
    category: item.category,
    subcategory: item.subcategory,
    shortDescription: item.shortDescription,
    fullDescription: item.fullDescription,
    basePrice: item.basePrice,
    currency: item.currency,
    serviceTime: item.serviceTime,
    availabilityStatus: item.availabilityStatus,
    keyIngredients: item.keyIngredients,
    mainProteinOrBase: null,
    cookingStyle: item.servedStyle,
    preparationMethod: null,
    flavorProfile: item.flavorProfile,
    texture: null,
    spiceLevel: null,
    spiceAdjustable: false,
    portionSize: item.servingSize,
    shareable: false,
    recommendationTags: item.recommendationTags,
    pairings: item.pairings,
    signatureScore: item.signatureScore,
    popularityScore: item.popularityScore,
    dietaryTags: item.dietaryTags,
    allergensContains: item.allergensContains,
    allergensMayContain: item.allergensMayContain,
    removableIngredients: [],
    substitutionsAllowed: false,
    canBeMadeVegetarian: false,
    canBeMadeVegan: false,
    canBeMadeGlutenFree: false,
    customizationRules: item.customizationRules,
    servingNotes: null,
    active: item.active,
    seasonal: item.seasonal,
    limitedTime: item.limitedTime,
    soldOut: item.soldOut,
    displayOrder: item.displayOrder,
    imageUrl: item.imageUrl,
    caloriesKcal: item.caloriesKcal,
    proteinG: item.proteinG,
    fatG: item.fatG,
    saturatedFatG: item.saturatedFatG,
    carbsG: item.carbsG,
    sugarG: item.sugarG,
    fiberG: item.fiberG,
    sodiumMg: item.sodiumMg,
    servesNum: item.servesNum,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    modifierGroups: item.modifierGroups.map((group) => ({
      id: group.id,
      restaurantId: group.restaurantId,
      menuItemId: group.drinkItemId,
      externalModifierGroupId: group.externalModifierGroupId,
      groupName: group.groupName,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      displayOrder: group.displayOrder,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      options: group.options.map((option) => ({
        ...option,
        availabilityStatus: option.availabilityStatus,
      })),
    })),
    targetKind: 'drink',
  };
}

function menuItemToImportLocalItem(item: MenuItemDetail): ImportLocalItem {
  return { ...item, targetKind: 'food' };
}

function buildLabel(
  displayName: string,
  description: string | null | undefined,
  languageCode: string,
): GoogleMenuLabel {
  const cleanedName = cleanText(displayName) ?? 'Unnamed item';
  const cleanedDescription = cleanText(description);
  return {
    displayName: truncateText(cleanedName, LABEL_DISPLAY_NAME_LIMIT),
    ...(cleanedDescription
      ? { description: truncateText(cleanedDescription, LABEL_DESCRIPTION_LIMIT) }
      : {}),
    languageCode,
  };
}

function buildMoney(value: number, currencyCode: string): GoogleMoney {
  const cents = Math.max(0, Math.round(value * 100));
  const units = Math.trunc(cents / 100);
  const nanos = (cents % 100) * 10_000_000;
  return {
    currencyCode: currencyCode.trim().toUpperCase(),
    units: String(units),
    nanos,
  };
}

function googleMoneyToNumber(value: GoogleMoney | undefined): number | null {
  if (!value) {
    return null;
  }
  const units = Number.parseInt(value.units || '0', 10);
  const nanos = typeof value.nanos === 'number' ? value.nanos : 0;
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) {
    return null;
  }
  return Number((units + nanos / 1_000_000_000).toFixed(2));
}

function normalizeComparableText(value: string | null | undefined): string {
  return cleanText(value)?.toLowerCase() ?? '';
}

function getPrimaryLabel(labels: GoogleMenuLabel[] | undefined): GoogleMenuLabel | null {
  return labels?.[0] ?? null;
}

function canonicalizeLabels(labels: GoogleMenuLabel[] | undefined): GoogleMenuLabel[] {
  return (labels ?? [])
    .map((label) => {
      const displayName = cleanText(label.displayName);
      if (!displayName) {
        return null;
      }
      const description = cleanText(label.description);
      return {
        displayName,
        ...(description ? { description } : {}),
        languageCode: cleanText(label.languageCode) ?? DEFAULT_LANGUAGE_CODE,
      };
    })
    .filter((label): label is GoogleMenuLabel => Boolean(label));
}

function canonicalizeNutritionAmount(value: GoogleNutritionAmount | null | undefined): {
  unit: string | null;
  lowerAmount: number | null;
  upperAmount: number | null;
} {
  const unit = cleanText(value?.unit)?.toUpperCase() ?? null;
  const lowerAmount =
    typeof value?.lowerAmount === 'number' && Number.isFinite(value.lowerAmount)
      ? Number(value.lowerAmount.toFixed(2))
      : typeof value?.quantity === 'number' && Number.isFinite(value.quantity)
        ? Number(value.quantity.toFixed(2))
        : null;
  const upperAmount =
    typeof value?.upperAmount === 'number' && Number.isFinite(value.upperAmount)
      ? Number(value.upperAmount.toFixed(2))
      : null;
  return { unit, lowerAmount, upperAmount };
}

function canonicalizeNutritionFacts(nutritionFacts: GoogleNutritionFacts | null | undefined) {
  return {
    calories: canonicalizeNutritionAmount(nutritionFacts?.calories),
    totalFat: canonicalizeNutritionAmount(nutritionFacts?.totalFat),
    saturatedFat: canonicalizeNutritionAmount(nutritionFacts?.saturatedFat),
    cholesterol: canonicalizeNutritionAmount(nutritionFacts?.cholesterol),
    sodium: canonicalizeNutritionAmount(nutritionFacts?.sodium),
    totalCarbohydrate: canonicalizeNutritionAmount(nutritionFacts?.totalCarbohydrate),
    sugars: canonicalizeNutritionAmount(nutritionFacts?.sugars),
    dietaryFiber: canonicalizeNutritionAmount(nutritionFacts?.dietaryFiber),
    protein: canonicalizeNutritionAmount(nutritionFacts?.protein),
  };
}

function hasNutritionFacts(nutritionFacts: ReturnType<typeof canonicalizeNutritionFacts>): boolean {
  return Object.values(nutritionFacts).some(
    (amount) => amount.unit !== null || amount.lowerAmount !== null || amount.upperAmount !== null,
  );
}

function canonicalizeAttributes(attributes: GoogleFoodMenuItemAttributes) {
  const amount = googleMoneyToNumber(attributes.price);
  const nutritionFacts = canonicalizeNutritionFacts(attributes.nutritionFacts);
  return {
    price: {
      currencyCode: cleanText(attributes.price?.currencyCode)?.toUpperCase() ?? 'GBP',
      amount,
    },
    spiciness: attributes.spiciness ?? null,
    allergen: uniqueSorted(attributes.allergen ?? []),
    dietaryRestriction: uniqueSorted(attributes.dietaryRestriction ?? []),
    ingredients: normalizeStringValues(
      (attributes.ingredients ?? []).flatMap((ingredient) =>
        (ingredient.labels ?? []).map((label) => label.displayName),
      ),
    ),
    preparationMethods: uniqueSorted(attributes.preparationMethods ?? []),
    portionSize: cleanText(getPrimaryLabel(attributes.portionSize?.unit)?.displayName),
    mediaKeys: normalizeStringValues(attributes.mediaKeys ?? []),
    nutritionFacts,
    servesNumPeople:
      typeof attributes.servesNumPeople === 'number' && Number.isFinite(attributes.servesNumPeople)
        ? Math.trunc(attributes.servesNumPeople)
        : typeof attributes.servesNum === 'number' && Number.isFinite(attributes.servesNum)
          ? Math.trunc(attributes.servesNum)
          : null,
  };
}

type CanonicalFoodMenuItemAttributes =
  CanonicalGoogleFoodMenusResource['menus'][number]['sections'][number]['items'][number]['attributes'];

function omitDefaultExtendedAttributeFields(attributesValue: CanonicalFoodMenuItemAttributes) {
  const { mediaKeys, nutritionFacts, servesNumPeople, ...attributes } = attributesValue;
  return mediaKeys.length === 0 && !hasNutritionFacts(nutritionFacts) && servesNumPeople === null
    ? attributes
    : attributesValue;
}

function omitDefaultExtendedAttributesForHash(value: CanonicalGoogleFoodMenusResource) {
  return {
    ...value,
    menus: value.menus.map((menu) => ({
      ...menu,
      sections: menu.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          return {
            ...item,
            attributes: omitDefaultExtendedAttributeFields(item.attributes),
            options: item.options.map((option) => ({
              ...option,
              attributes: omitDefaultExtendedAttributeFields(option.attributes),
            })),
          };
        }),
      })),
    })),
  };
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function normalizeStringValues(values: string[]): string[] {
  return uniqueSorted(
    values.map((value) => cleanText(value)).filter((value): value is string => Boolean(value)),
  );
}

function dietaryRestrictionToTag(value: GoogleFoodMenuDietaryRestriction): string | null {
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
    default:
      return null;
  }
}

function allergenToTag(value: GoogleFoodMenuAllergen): string | null {
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
    default:
      return null;
  }
}

export function spicinessToSpiceLevel(
  value: GoogleFoodMenuSpiciness | null | undefined,
): string | null {
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

function titleCaseEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function preparationMethodsToText(
  values: GoogleFoodMenuPreparationMethod[] | null | undefined,
): string | null {
  const methods = uniqueSorted(values ?? []).filter((value) => value !== 'OTHER_METHOD');
  return methods.length > 0 ? methods.map(titleCaseEnum).join(', ') : null;
}

function preparationMethodsEqual(
  left: GoogleFoodMenuPreparationMethod[] | null | undefined,
  right: GoogleFoodMenuPreparationMethod[] | null | undefined,
): boolean {
  return arraysEqual(uniqueSorted(left ?? []), uniqueSorted(right ?? []));
}

export function portionSizeFromGoogle(
  value: GoogleFoodMenuItemAttributes['portionSize'] | null | undefined,
): string | null {
  const unit = cleanText(getPrimaryLabel(value?.unit)?.displayName);
  if (!unit) {
    return null;
  }
  const quantity =
    typeof value?.quantity === 'number' && Number.isFinite(value.quantity) ? value.quantity : null;
  return quantity === null || quantity === 1 ? unit : `${Number(quantity.toFixed(2))} ${unit}`;
}

export function ingredientsLabelsToArray(
  ingredients: GoogleFoodMenuItemAttributes['ingredients'] | null | undefined,
): string[] {
  return normalizeStringValues(
    (ingredients ?? []).flatMap((ingredient) =>
      (ingredient.labels ?? []).map((label) => label.displayName),
    ),
  );
}

export function mediaKeysToImageUrl(mediaKeys: string[] | null | undefined): string | null {
  return (
    (mediaKeys ?? [])
      .map((mediaKey) => cleanText(mediaKey))
      .find((mediaKey): mediaKey is string =>
        Boolean(mediaKey && /^https?:\/\//i.test(mediaKey)),
      ) ?? null
  );
}

export function servesNumToInt(servesNum: number | null | undefined): number | null {
  return typeof servesNum === 'number' && Number.isFinite(servesNum) && servesNum >= 0
    ? Math.trunc(servesNum)
    : null;
}

function nutritionQuantity(
  value: GoogleNutritionAmount | null | undefined,
  targetUnit: 'g' | 'mg' | 'kcal',
): number | null {
  const lowerAmount = value?.lowerAmount;
  const legacyQuantity = value?.quantity;
  const amount =
    typeof lowerAmount === 'number' && Number.isFinite(lowerAmount)
      ? lowerAmount
      : typeof legacyQuantity === 'number' && Number.isFinite(legacyQuantity)
        ? legacyQuantity
        : null;
  if (amount === null) {
    return null;
  }
  const unit = cleanText(value?.unit)?.toLowerCase() ?? '';
  if (targetUnit === 'kcal') {
    if (!unit || /^(k?cal|calorie|calories|kilocalorie|kilocalories)$/.test(unit)) {
      return Math.round(amount);
    }
    return null;
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

export function nutritionFactsFromGoogle(
  nutritionFacts: GoogleNutritionFacts | null | undefined,
): Pick<
  MenuItemDetail,
  | 'caloriesKcal'
  | 'proteinG'
  | 'fatG'
  | 'saturatedFatG'
  | 'carbsG'
  | 'sugarG'
  | 'fiberG'
  | 'sodiumMg'
> {
  return {
    caloriesKcal: nutritionQuantity(nutritionFacts?.calories, 'kcal'),
    proteinG: nutritionQuantity(nutritionFacts?.protein, 'g'),
    fatG: nutritionQuantity(nutritionFacts?.totalFat, 'g'),
    saturatedFatG: nutritionQuantity(nutritionFacts?.saturatedFat, 'g'),
    carbsG: nutritionQuantity(nutritionFacts?.totalCarbohydrate, 'g'),
    sugarG: nutritionQuantity(nutritionFacts?.sugars, 'g'),
    fiberG: nutritionQuantity(nutritionFacts?.dietaryFiber, 'g'),
    sodiumMg: nutritionQuantity(nutritionFacts?.sodium, 'mg'),
  };
}

function normalizeModifierGroups(
  groups: ReadonlyArray<
    Pick<
      MenuModifierGroupInput,
      | 'externalModifierGroupId'
      | 'groupName'
      | 'required'
      | 'minSelect'
      | 'maxSelect'
      | 'displayOrder'
      | 'options'
    >
  >,
): MenuModifierGroupInput[] {
  return groups
    .map((group) => ({
      externalModifierGroupId: group.externalModifierGroupId,
      groupName: group.groupName,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      displayOrder: group.displayOrder,
      options: group.options
        .map((option) => ({
          externalModifierOptionId: option.externalModifierOptionId,
          optionName: option.optionName,
          priceDelta: Number(option.priceDelta.toFixed(2)),
          defaultSelected: option.defaultSelected,
          availabilityStatus: option.availabilityStatus,
          displayOrder: option.displayOrder,
        }))
        .sort((left, right) => left.displayOrder - right.displayOrder),
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function modifierGroupsEqual(
  left: ReadonlyArray<MenuModifierGroupInput>,
  right: ReadonlyArray<MenuModifierGroupInput>,
): boolean {
  return (
    JSON.stringify(normalizeModifierGroups(left)) === JSON.stringify(normalizeModifierGroups(right))
  );
}

function findExistingOptionsGroup(
  item: MenuItemDetail,
): MenuItemDetail['modifierGroups'][number] | null {
  return (
    item.modifierGroups.find((group) => normalizeComparableText(group.groupName) === 'options') ??
    null
  );
}

function synthesizeOptionsModifierGroup(
  item: MenuItemDetail,
  googleItem: GoogleFoodMenuItem,
  googlePath: string,
): MenuModifierGroupInput | null {
  const options = googleItem.options ?? [];
  if (options.length === 0) {
    return null;
  }
  const existingOptionsGroup = findExistingOptionsGroup(item);
  const existingOptionsByName = new Map(
    (existingOptionsGroup?.options ?? []).map((option) => [
      normalizeComparableText(option.optionName),
      option,
    ]),
  );

  return {
    externalModifierGroupId:
      existingOptionsGroup?.externalModifierGroupId ?? `gbp-${slugify(googlePath, 'item')}-options`,
    groupName: 'Options',
    required: false,
    minSelect: 0,
    maxSelect: Math.max(1, options.length),
    displayOrder: existingOptionsGroup?.displayOrder ?? item.modifierGroups.length,
    options: options.map((option, optionIndex) => {
      const optionName =
        cleanText(getPrimaryLabel(option.labels)?.displayName) ?? `Option ${optionIndex + 1}`;
      const existingOption = existingOptionsByName.get(normalizeComparableText(optionName));
      const optionPrice = googleMoneyToNumber(option.attributes.price);
      const priceDelta =
        optionPrice === null ? 0 : Number((optionPrice - item.basePrice).toFixed(2));
      return {
        externalModifierOptionId:
          existingOption?.externalModifierOptionId ??
          `gbp-${slugify(`${googlePath}-option-${optionName}`, `option-${optionIndex + 1}`)}`,
        optionName,
        priceDelta,
        defaultSelected: existingOption?.defaultSelected ?? false,
        availabilityStatus: 'available',
        displayOrder: existingOption?.displayOrder ?? optionIndex,
      };
    }),
  };
}

function buildItemModifierGroupsPatch(
  item: MenuItemDetail,
  googleItem: GoogleFoodMenuItem,
  googlePath: string,
): MenuModifierGroupInput[] | null {
  const currentGroups = normalizeModifierGroups(item.modifierGroups);
  const existingOptionsGroup = findExistingOptionsGroup(item);
  const googleOptionsGroup = synthesizeOptionsModifierGroup(item, googleItem, googlePath);
  if (!googleOptionsGroup && !existingOptionsGroup) {
    return null;
  }
  const nextGroups = normalizeModifierGroups([
    ...item.modifierGroups.filter(
      (group) => normalizeComparableText(group.groupName) !== 'options',
    ),
    ...(googleOptionsGroup ? [googleOptionsGroup] : []),
  ]);
  return modifierGroupsEqual(currentGroups, nextGroups) ? null : nextGroups;
}

function getSkippedReason(
  item: MenuItemDetail,
): GoogleFoodMenusProjectionSkippedItem['reason'] | null {
  if (!item.active) {
    return 'inactive';
  }
  if (item.soldOut) {
    return 'sold_out';
  }
  if (item.availabilityStatus !== 'available') {
    return 'unavailable';
  }
  return null;
}

function mapSpiciness(value: string | null | undefined): GoogleFoodMenuSpiciness | undefined {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes('hot') || normalized.includes('spicy')) {
    return 'HOT';
  }
  if (normalized.includes('medium')) {
    return 'MEDIUM';
  }
  if (normalized.includes('mild')) {
    return 'MILD';
  }
  return undefined;
}

function mapAllergen(value: string): GoogleFoodMenuAllergen | null {
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

function mapDietaryRestriction(value: string): GoogleFoodMenuDietaryRestriction | null {
  const normalized = value.toLowerCase();
  if (normalized.includes('vegan')) return 'VEGAN';
  if (normalized.includes('vegetarian') || normalized === 'veggie') return 'VEGETARIAN';
  if (normalized.includes('halal')) return 'HALAL';
  if (normalized.includes('kosher')) return 'KOSHER';
  if (normalized.includes('organic')) return 'ORGANIC';
  return null;
}

function mapPreparationMethod(
  value: string | null | undefined,
): GoogleFoodMenuPreparationMethod | undefined {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes('barbecue') || normalized.includes('bbq')) return 'BARBECUED';
  if (normalized.includes('basted')) return 'BASTED';
  if (normalized.includes('blanched')) return 'BLANCHED';
  if (normalized.includes('pan fried') || normalized.includes('pan-fried')) return 'PAN_FRIED';
  if (normalized.includes('pressure cooked') || normalized.includes('pressure-cooked'))
    return 'PRESSURE_COOKED';
  if (normalized.includes('stir fried') || normalized.includes('stir-fried')) return 'STIR_FRIED';
  if (normalized.includes('baked')) return 'BAKED';
  if (normalized.includes('boiled')) return 'BOILED';
  if (normalized.includes('braised')) return 'BRAISED';
  if (normalized.includes('coddled')) return 'CODDLED';
  if (normalized.includes('fermented')) return 'FERMENTED';
  if (normalized.includes('fried')) return 'FRIED';
  if (normalized.includes('grilled')) return 'GRILLED';
  if (normalized.includes('kneaded')) return 'KNEADED';
  if (normalized.includes('marinated')) return 'MARINATED';
  if (normalized.includes('pickled')) return 'PICKLED';
  if (normalized.includes('roasted')) return 'ROASTED';
  if (normalized.includes('sauteed') || normalized.includes('sautéed')) return 'SAUTEED';
  if (normalized.includes('seared')) return 'SEARED';
  if (normalized.includes('simmered')) return 'SIMMERED';
  if (normalized.includes('smoked')) return 'SMOKED';
  if (normalized.includes('steamed')) return 'STEAMED';
  if (normalized.includes('steeped')) return 'STEEPED';
  return 'OTHER_METHOD';
}

function uniqueSorted<T extends string>(values: Array<T | null | undefined>): T[] {
  return Array.from(new Set(values.filter((value): value is T => Boolean(value)))).sort(
    (left, right) => left.localeCompare(right),
  );
}

function buildAttributes(
  item: Pick<
    MenuItemDetail,
    | 'basePrice'
    | 'currency'
    | 'spiceLevel'
    | 'allergensContains'
    | 'dietaryTags'
    | 'canBeMadeVegetarian'
    | 'canBeMadeVegan'
    | 'keyIngredients'
    | 'preparationMethod'
    | 'cookingStyle'
    | 'portionSize'
    | 'caloriesKcal'
    | 'proteinG'
    | 'fatG'
    | 'saturatedFatG'
    | 'carbsG'
    | 'sugarG'
    | 'fiberG'
    | 'sodiumMg'
    | 'servesNum'
  >,
  languageCode: string,
  priceDelta = 0,
): GoogleFoodMenuItemAttributes {
  const allergen = uniqueSorted(item.allergensContains.map(mapAllergen));
  const dietaryRestriction = uniqueSorted([
    ...item.dietaryTags.map(mapDietaryRestriction),
    item.canBeMadeVegan ? 'VEGAN' : null,
    item.canBeMadeVegetarian ? 'VEGETARIAN' : null,
  ]);
  const preparationMethods = uniqueSorted([
    mapPreparationMethod(item.preparationMethod),
    mapPreparationMethod(item.cookingStyle),
  ]);
  const ingredients = item.keyIngredients
    .map((ingredient) => cleanText(ingredient))
    .filter((ingredient): ingredient is string => Boolean(ingredient))
    .map((ingredient) => ({ labels: [buildLabel(ingredient, null, languageCode)] }));
  const portionSize = cleanText(item.portionSize);
  const nutritionFacts = {
    calories:
      item.caloriesKcal !== null
        ? ({ lowerAmount: item.caloriesKcal, unit: 'CALORIE' } satisfies GoogleNutritionAmount)
        : null,
    protein:
      item.proteinG !== null
        ? ({ lowerAmount: item.proteinG, unit: 'GRAM' } satisfies GoogleNutritionAmount)
        : null,
    totalFat:
      item.fatG !== null
        ? ({ lowerAmount: item.fatG, unit: 'GRAM' } satisfies GoogleNutritionAmount)
        : null,
    totalCarbohydrate:
      item.carbsG !== null
        ? ({ lowerAmount: item.carbsG, unit: 'GRAM' } satisfies GoogleNutritionAmount)
        : null,
    sodium:
      item.sodiumMg !== null
        ? ({ lowerAmount: item.sodiumMg, unit: 'MILLIGRAM' } satisfies GoogleNutritionAmount)
        : null,
  };
  const normalizedNutritionFacts = Object.fromEntries(
    Object.entries(nutritionFacts).filter((entry) => Boolean(entry[1])),
  ) as GoogleNutritionFacts;

  return {
    price: buildMoney(item.basePrice + priceDelta, item.currency),
    ...(mapSpiciness(item.spiceLevel) ? { spiciness: mapSpiciness(item.spiceLevel) } : {}),
    ...(allergen.length > 0 ? { allergen } : {}),
    ...(dietaryRestriction.length > 0 ? { dietaryRestriction } : {}),
    ...(ingredients.length > 0 ? { ingredients } : {}),
    ...(preparationMethods.length > 0 ? { preparationMethods } : {}),
    ...(portionSize
      ? { portionSize: { quantity: 1, unit: [buildLabel(portionSize, null, languageCode)] } }
      : {}),
    ...(Object.keys(normalizedNutritionFacts).length > 0
      ? { nutritionFacts: normalizedNutritionFacts }
      : {}),
    ...(item.servesNum !== null ? { servesNumPeople: item.servesNum } : {}),
  };
}

function buildOption(
  item: MenuItemDetail,
  option: MenuModifierOption,
  languageCode: string,
): GoogleFoodMenuItemOption | null {
  if (option.availabilityStatus !== 'available') {
    return null;
  }
  return {
    labels: [buildLabel(option.optionName, null, languageCode)],
    attributes: buildAttributes(item, languageCode, option.priceDelta),
  };
}

function buildItem(item: MenuItemDetail, languageCode: string): GoogleFoodMenuItem {
  const options = item.modifierGroups.flatMap((group) =>
    group.options
      .map((option) => buildOption(item, option, languageCode))
      .filter((option): option is GoogleFoodMenuItemOption => Boolean(option)),
  );

  return {
    labels: [
      buildLabel(item.itemName, item.shortDescription ?? item.fullDescription, languageCode),
    ],
    attributes: buildAttributes(item, languageCode),
    ...(options.length > 0 ? { options } : {}),
  };
}

function getSectionLabel(item: MenuItemDetail): string {
  const category = cleanText(item.category) ?? 'Menu';
  const subcategory = cleanText(item.subcategory);
  return subcategory ? `${category} - ${subcategory}` : category;
}

function getSectionKey(item: MenuItemDetail): string {
  return `${slugify(item.category, 'menu')}/${slugify(item.subcategory, 'default')}`;
}

function groupSections(items: MenuItemDetail[]): ProjectedSection[] {
  const sections = new Map<string, ProjectedSection>();
  for (const item of items) {
    const sectionKey = getSectionKey(item);
    const existing = sections.get(sectionKey);
    if (existing) {
      existing.items.push(item);
      existing.sortOrder = Math.min(existing.sortOrder, item.displayOrder);
      continue;
    }
    sections.set(sectionKey, {
      sectionKey,
      label: getSectionLabel(item),
      sortOrder: item.displayOrder,
      items: [item],
    });
  }

  return Array.from(sections.values())
    .map((section) => ({
      ...section,
      items: [...section.items].sort(sortMenuItems),
    }))
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label),
    );
}

function sortMenuItems(left: MenuItemDetail, right: MenuItemDetail): number {
  return left.displayOrder - right.displayOrder || left.itemName.localeCompare(right.itemName);
}

function buildStableKey(item: MenuItemDetail): string {
  return `foodMenu.item.${getSectionKey(item)}.${slugify(item.externalItemId, item.id)}`;
}

function buildOptionIdentityPaths(
  item: MenuItemDetail,
  itemPath: string,
): GoogleFoodMenusProjectedIdentity['googleOptionPaths'] {
  const paths: GoogleFoodMenusProjectedIdentity['googleOptionPaths'] = [];
  let optionIndex = 0;

  for (const group of item.modifierGroups) {
    for (const option of group.options) {
      if (option.availabilityStatus !== 'available') {
        continue;
      }
      paths.push({
        externalModifierGroupId: group.externalModifierGroupId,
        externalModifierOptionId: option.externalModifierOptionId,
        googlePath: `${itemPath}.options[${optionIndex}]`,
      });
      optionIndex += 1;
    }
  }

  return paths;
}

export function buildGoogleFoodMenusProjection(
  input: BuildGoogleFoodMenusProjectionInput,
): GoogleFoodMenusProjection {
  const languageCode = cleanText(input.languageCode) ?? DEFAULT_LANGUAGE_CODE;
  const sourceUrl = cleanText(input.sourceUrl);
  const skippedItems: GoogleFoodMenusProjectionSkippedItem[] = [];
  const exportableItems = input.items.filter((item) => {
    const reason = getSkippedReason(item);
    if (!reason || input.includeUnavailable) {
      return true;
    }
    skippedItems.push({
      localItemId: item.id,
      externalItemId: item.externalItemId,
      reason,
    });
    return false;
  });
  const identities: GoogleFoodMenusProjectedIdentity[] = [];
  const sections = groupSections(exportableItems);
  const googleSections = sections.map((section, sectionIndex) => ({
    labels: [buildLabel(section.label, null, languageCode)],
    items: section.items.map((item, itemIndex) => {
      const itemPath = `menus[0].sections[${sectionIndex}].items[${itemIndex}]`;
      identities.push({
        stableKey: buildStableKey(item),
        localItemId: item.id,
        externalItemId: item.externalItemId,
        itemName: item.itemName,
        sectionKey: section.sectionKey,
        sectionLabel: section.label,
        googlePath: itemPath,
        googleOptionPaths: buildOptionIdentityPaths(item, itemPath),
      });
      return buildItem(item, languageCode);
    }),
  }));

  return {
    foodMenus: {
      name: input.foodMenusName,
      menus: [
        {
          labels: [buildLabel(cleanText(input.menuLabel) ?? DEFAULT_MENU_NAME, null, languageCode)],
          ...(sourceUrl ? { sourceUrl } : {}),
          sections: googleSections,
          ...(input.cuisines && input.cuisines.length > 0
            ? { cuisines: uniqueSorted(input.cuisines) }
            : {}),
        },
      ],
    },
    identities,
    skippedItems,
  };
}

function findLocalItemByPreviousIdentity(
  googlePath: string,
  localItemsById: Map<string, ImportLocalItem>,
  previousIdentities: ReadonlyArray<GoogleFoodMenusProjectedIdentity>,
): ImportLocalItem | null {
  const identity = previousIdentities.find((entry) => entry.googlePath === googlePath);
  if (!identity) {
    return null;
  }
  return localItemsById.get(identity.localItemId) ?? null;
}

function findLocalItemByDisplayMatch(
  googleSectionLabel: string | null,
  googleItemName: string | null,
  googlePrice: number | null,
  localItems: ImportLocalItem[],
): { item: ImportLocalItem; confidence: 'section_name_price' | 'section_name' } | null {
  const sectionKey = normalizeComparableText(googleSectionLabel);
  const nameKey = normalizeComparableText(googleItemName);
  if (!sectionKey || !nameKey) {
    return null;
  }

  const sectionNameMatches = localItems.filter(
    (item) =>
      normalizeComparableText(getSectionLabel(item)) === sectionKey &&
      normalizeComparableText(item.itemName) === nameKey,
  );
  if (sectionNameMatches.length === 0) {
    return null;
  }

  if (googlePrice !== null) {
    const priceMatches = sectionNameMatches.filter(
      (item) => Math.abs(item.basePrice - googlePrice) < 0.01,
    );
    if (priceMatches.length === 1) {
      return { item: priceMatches[0]!, confidence: 'section_name_price' };
    }
  }

  if (sectionNameMatches.length === 1) {
    return { item: sectionNameMatches[0]!, confidence: 'section_name' };
  }

  return null;
}

function buildSuggestedPatch(
  localItem: ImportLocalItem,
  googleItem: GoogleFoodMenuItem,
  googlePath: string,
): GoogleFoodMenusImportSuggestedPatch | null {
  const label = getPrimaryLabel(googleItem.labels);
  const googleName = cleanText(label?.displayName);
  const googleDescription = cleanText(label?.description);
  const googlePrice = googleMoneyToNumber(googleItem.attributes.price);
  const googleCurrency =
    cleanText(googleItem.attributes.price?.currencyCode)?.toUpperCase() ?? null;
  const googleDietaryTags = normalizeStringValues(
    (googleItem.attributes.dietaryRestriction ?? [])
      .map(dietaryRestrictionToTag)
      .filter((value): value is string => Boolean(value)),
  );
  const googleAllergens = normalizeStringValues(
    (googleItem.attributes.allergen ?? [])
      .map(allergenToTag)
      .filter((value): value is string => Boolean(value)),
  );
  const googleSpiceLevel = spicinessToSpiceLevel(googleItem.attributes.spiciness);
  const googlePreparationMethod = preparationMethodsToText(
    googleItem.attributes.preparationMethods,
  );
  const localPreparationMethods = [
    mapPreparationMethod(localItem.preparationMethod),
    mapPreparationMethod(localItem.cookingStyle),
  ].filter((value): value is GoogleFoodMenuPreparationMethod => Boolean(value));
  const googlePortionSize = portionSizeFromGoogle(googleItem.attributes.portionSize);
  const googleIngredients = ingredientsLabelsToArray(googleItem.attributes.ingredients);
  const googleImageUrl = mediaKeysToImageUrl(googleItem.attributes.mediaKeys);
  const googleNutritionFacts = nutritionFactsFromGoogle(googleItem.attributes.nutritionFacts);
  const googleServesNum = servesNumToInt(
    googleItem.attributes.servesNumPeople ?? googleItem.attributes.servesNum,
  );
  const patch: GoogleFoodMenusImportItemSuggestedPatch = {};

  if (googleName && cleanText(localItem.itemName) !== googleName) {
    patch.itemName = googleName;
  }
  if (googleDescription !== cleanText(localItem.shortDescription)) {
    patch.shortDescription = googleDescription;
  }
  if (googlePrice !== null && Math.abs(localItem.basePrice - googlePrice) >= 0.01) {
    patch.basePrice = googlePrice;
  }
  if (googleCurrency && localItem.currency.toUpperCase() !== googleCurrency) {
    patch.currency = googleCurrency;
  }
  if (
    googleDietaryTags.length > 0 &&
    !arraysEqual(normalizeStringValues(localItem.dietaryTags), googleDietaryTags)
  ) {
    patch.dietaryTags = googleDietaryTags;
  }
  if (
    googleAllergens.length > 0 &&
    !arraysEqual(normalizeStringValues(localItem.allergensContains), googleAllergens)
  ) {
    patch.allergensContains = googleAllergens;
  }
  if (googleSpiceLevel && cleanText(localItem.spiceLevel) !== googleSpiceLevel) {
    patch.spiceLevel = googleSpiceLevel;
  }
  if (
    googlePreparationMethod &&
    !preparationMethodsEqual(googleItem.attributes.preparationMethods, localPreparationMethods)
  ) {
    patch.preparationMethod = googlePreparationMethod;
  }
  if (googlePortionSize && cleanText(localItem.portionSize) !== googlePortionSize) {
    patch.portionSize = googlePortionSize;
  }
  if (
    googleIngredients.length > 0 &&
    !arraysEqual(normalizeStringValues(localItem.keyIngredients), googleIngredients)
  ) {
    patch.keyIngredients = googleIngredients;
  }
  if (googleImageUrl && cleanText(localItem.imageUrl) !== googleImageUrl) {
    patch.imageUrl = googleImageUrl;
  }
  for (const key of [
    'caloriesKcal',
    'proteinG',
    'fatG',
    'saturatedFatG',
    'carbsG',
    'sugarG',
    'fiberG',
    'sodiumMg',
  ] as const) {
    const googleValue = googleNutritionFacts[key];
    if (googleValue !== null && localItem[key] !== googleValue) {
      patch[key] = googleValue;
    }
  }
  if (googleServesNum !== null && localItem.servesNum !== googleServesNum) {
    patch.servesNum = googleServesNum;
  }
  const modifierGroups = buildItemModifierGroupsPatch(localItem, googleItem, googlePath);
  if (modifierGroups) {
    patch.modifierGroups = modifierGroups;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function splitSectionLabelForCreate(sectionLabel: string | null): {
  category: string;
  subcategory: string | null;
} {
  const cleaned = cleanText(sectionLabel);
  if (!cleaned) {
    return { category: 'Google menu', subcategory: null };
  }
  const [category, ...rest] = cleaned.split(/\s+-\s+/);
  return {
    category: cleanText(category) ?? 'Google menu',
    subcategory: cleanText(rest.join(' - ')),
  };
}

function makeMinimalMenuItemForGoogleOptions(
  itemName: string,
  category: string,
  basePrice: number,
): MenuItemDetail {
  return {
    id: 'gbp-new-item',
    restaurantId: 'gbp-import-review',
    externalItemId: 'gbp-new-item',
    itemName,
    category,
    subcategory: null,
    shortDescription: null,
    fullDescription: null,
    basePrice,
    currency: 'GBP',
    serviceTime: null,
    availabilityStatus: 'available',
    keyIngredients: [],
    mainProteinOrBase: null,
    cookingStyle: null,
    preparationMethod: null,
    flavorProfile: null,
    texture: null,
    spiceLevel: null,
    spiceAdjustable: false,
    portionSize: null,
    shareable: false,
    recommendationTags: [],
    pairings: [],
    signatureScore: null,
    popularityScore: null,
    dietaryTags: [],
    allergensContains: [],
    allergensMayContain: [],
    removableIngredients: [],
    substitutionsAllowed: false,
    canBeMadeVegetarian: false,
    canBeMadeVegan: false,
    canBeMadeGlutenFree: false,
    customizationRules: null,
    servingNotes: null,
    active: true,
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    displayOrder: 0,
    imageUrl: null,
    caloriesKcal: null,
    proteinG: null,
    fatG: null,
    saturatedFatG: null,
    carbsG: null,
    sugarG: null,
    fiberG: null,
    sodiumMg: null,
    servesNum: null,
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    modifierGroups: [],
  };
}

function buildCreateSuggestedPatch(
  googleSectionLabel: string | null,
  googleItem: GoogleFoodMenuItem,
  googlePath: string,
): GoogleFoodMenusImportSuggestedPatch | null {
  const label = getPrimaryLabel(googleItem.labels);
  const googleName = cleanText(label?.displayName);
  const googlePrice = googleMoneyToNumber(googleItem.attributes.price);
  if (!googleName || googlePrice === null) {
    return null;
  }

  const { category, subcategory } = splitSectionLabelForCreate(googleSectionLabel);
  const shortDescription = cleanText(label?.description);
  const dietaryTags = normalizeStringValues(
    (googleItem.attributes.dietaryRestriction ?? [])
      .map(dietaryRestrictionToTag)
      .filter((value): value is string => Boolean(value)),
  );
  const allergensContains = normalizeStringValues(
    (googleItem.attributes.allergen ?? [])
      .map(allergenToTag)
      .filter((value): value is string => Boolean(value)),
  );
  const spiceLevel = spicinessToSpiceLevel(googleItem.attributes.spiciness);
  const preparationMethod = preparationMethodsToText(googleItem.attributes.preparationMethods);
  const portionSize = portionSizeFromGoogle(googleItem.attributes.portionSize);
  const keyIngredients = ingredientsLabelsToArray(googleItem.attributes.ingredients);
  const imageUrl = mediaKeysToImageUrl(googleItem.attributes.mediaKeys);
  const nutritionFacts = nutritionFactsFromGoogle(googleItem.attributes.nutritionFacts);
  const servesNum = servesNumToInt(
    googleItem.attributes.servesNumPeople ?? googleItem.attributes.servesNum,
  );
  const modifierGroups = synthesizeOptionsModifierGroup(
    {
      ...makeMinimalMenuItemForGoogleOptions(googleName, category, googlePrice),
      externalItemId: `gbp-${slugify(googlePath, 'item')}`,
    },
    googleItem,
    googlePath,
  );
  return {
    externalItemId: `gbp-${slugify(googlePath, 'item')}`,
    itemName: googleName,
    category,
    ...(subcategory ? { subcategory } : {}),
    ...(shortDescription ? { shortDescription } : {}),
    basePrice: googlePrice,
    currency: cleanText(googleItem.attributes.price?.currencyCode)?.toUpperCase() ?? 'GBP',
    ...(dietaryTags.length > 0 ? { dietaryTags } : {}),
    ...(allergensContains.length > 0 ? { allergensContains } : {}),
    ...(spiceLevel ? { spiceLevel } : {}),
    ...(preparationMethod ? { preparationMethod } : {}),
    ...(portionSize ? { portionSize } : {}),
    ...(keyIngredients.length > 0 ? { keyIngredients } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...Object.fromEntries(
      Object.entries(nutritionFacts).filter(
        (entry): entry is [keyof typeof nutritionFacts, number] => entry[1] !== null,
      ),
    ),
    ...(servesNum !== null ? { servesNum } : {}),
    ...(modifierGroups ? { modifierGroups: [modifierGroups] } : {}),
  };
}

function buildMenuMetadataSuggestedPatch(
  menu: GoogleFoodMenu | null,
  settings: GoogleFoodMenuSettings | null,
): GoogleFoodMenusImportMenuMetadataPatch | null {
  if (!menu) {
    return null;
  }
  const googleMenuLabel = cleanText(getPrimaryLabel(menu.labels)?.displayName);
  const googleSourceUrl = cleanText(menu.sourceUrl);
  const googleCuisines = uniqueSorted(menu.cuisines ?? []);
  const googleLanguageCode = cleanText(getPrimaryLabel(menu.labels)?.languageCode);
  const currentMenuLabel = cleanText(settings?.menuLabel) ?? DEFAULT_MENU_NAME;
  const currentSourceUrl = cleanText(settings?.sourceUrl);
  const currentCuisines = uniqueSorted(settings?.cuisines ?? []);
  const currentLanguageCode = cleanText(settings?.languageCode) ?? DEFAULT_LANGUAGE_CODE;
  const patch: GoogleFoodMenusImportMenuMetadataPatch = {};

  if (googleMenuLabel && googleMenuLabel !== currentMenuLabel) {
    patch.menuLabel = googleMenuLabel;
  }
  if (googleSourceUrl !== currentSourceUrl) {
    patch.sourceUrl = googleSourceUrl;
  }
  if (!arraysEqual(googleCuisines, currentCuisines)) {
    patch.cuisines = googleCuisines;
  }
  if (googleLanguageCode && googleLanguageCode !== currentLanguageCode) {
    patch.languageCode = googleLanguageCode;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function buildGoogleFoodMenusImportReview(
  input: BuildGoogleFoodMenusImportReviewInput,
): GoogleFoodMenusImportReview {
  const localFoodItems = input.localItems.map(menuItemToImportLocalItem);
  const localDrinkItems = (input.localDrinkItems ?? []).map(drinkItemToImportLocalItem);
  const localItemsByTarget = {
    food: localFoodItems,
    drink: localDrinkItems,
  } satisfies Record<GoogleFoodMenusImportTargetKind, ImportLocalItem[]>;
  const matchedLocalItemIds = new Set<string>();
  const items: GoogleFoodMenusImportReviewItem[] = [];
  const firstMenu = input.googleFoodMenus.menus[0] ?? null;
  const metadataPatch = buildMenuMetadataSuggestedPatch(firstMenu, input.settings ?? null);

  if (metadataPatch) {
    items.push({
      googlePath: 'menus[0].metadata',
      googleSectionLabel: null,
      googleItemName: cleanText(getPrimaryLabel(firstMenu?.labels)?.displayName) ?? 'Menu settings',
      targetKind: 'food',
      match: { status: 'menu_metadata', confidence: 'none' },
      suggestedPatch: metadataPatch,
      warnings: [],
    });
  }

  for (const [menuIndex, menu] of input.googleFoodMenus.menus.entries()) {
    const targetKind = classifyMenuTarget(menu);
    const localItems = localItemsByTarget[targetKind];
    const localItemsById = new Map(localItems.map((item) => [item.id, item]));
    for (const [sectionIndex, section] of menu.sections.entries()) {
      const googleSectionLabel = cleanText(getPrimaryLabel(section.labels)?.displayName);
      for (const [itemIndex, googleItem] of section.items.entries()) {
        const googlePath = `menus[${menuIndex}].sections[${sectionIndex}].items[${itemIndex}]`;
        const googleItemName = cleanText(getPrimaryLabel(googleItem.labels)?.displayName);
        const googlePrice = googleMoneyToNumber(googleItem.attributes.price);
        const warnings: string[] = [];
        let localItem = findLocalItemByPreviousIdentity(
          googlePath,
          localItemsById,
          input.previousIdentities ?? [],
        );
        let confidence: GoogleFoodMenusImportMatchConfidence = localItem
          ? 'previous_identity'
          : 'none';

        if (!localItem) {
          const displayMatch = findLocalItemByDisplayMatch(
            googleSectionLabel,
            googleItemName,
            googlePrice,
            localItems,
          );
          localItem = displayMatch?.item ?? null;
          confidence = displayMatch?.confidence ?? 'none';
        }

        if (!googleItemName) {
          warnings.push('Google item has no display name.');
        }
        if (googlePrice === null) {
          warnings.push('Google item has no parseable price.');
        }
        if (
          (googleItem.attributes.mediaKeys ?? []).length > 0 &&
          !mediaKeysToImageUrl(googleItem.attributes.mediaKeys)
        ) {
          warnings.push('Google item media keys need a public URL before image import.');
        }

        if (!localItem || confidence === 'none') {
          const suggestedPatch = buildCreateSuggestedPatch(
            googleSectionLabel,
            googleItem,
            googlePath,
          );
          if (!suggestedPatch) {
            warnings.push(
              'Google item needs a display name and parseable price before it can be created.',
            );
          }
          items.push({
            googlePath,
            googleSectionLabel,
            googleItemName,
            targetKind,
            match: { status: 'unmatched', confidence: 'none' },
            suggestedPatch,
            warnings,
          });
          continue;
        }

        matchedLocalItemIds.add(`${targetKind}:${localItem.id}`);
        items.push({
          googlePath,
          googleSectionLabel,
          googleItemName,
          targetKind,
          match: {
            status: 'matched',
            confidence,
            localItemId: localItem.id,
            externalItemId: localItem.externalItemId,
          },
          suggestedPatch: buildSuggestedPatch(localItem, googleItem, googlePath),
          warnings,
        });
      }
    }
  }

  const localItemsMissingFromGoogle = [...localFoodItems, ...localDrinkItems]
    .filter((item) => !matchedLocalItemIds.has(`${item.targetKind}:${item.id}`))
    .map((item) => ({
      localItemId: item.id,
      externalItemId: item.externalItemId,
      itemName: item.itemName,
      targetKind: item.targetKind,
      reason: 'not_present_in_google' as const,
    }));

  for (const item of localItemsMissingFromGoogle) {
    items.push({
      googlePath: null,
      googleSectionLabel: null,
      googleItemName: item.itemName,
      targetKind: item.targetKind,
      match: {
        status: 'missing_from_google',
        confidence: 'none',
        localItemId: item.localItemId,
        externalItemId: item.externalItemId,
      },
      suggestedPatch: null,
      warnings: ['This local item was not present in the latest Google FoodMenus pull.'],
    });
  }

  return {
    items,
    localItemsMissingFromGoogle,
  };
}

export function canonicalizeGoogleFoodMenusResource(
  foodMenus: GoogleFoodMenusResource,
): CanonicalGoogleFoodMenusResource {
  return {
    name: foodMenus.name.trim(),
    menus: foodMenus.menus.map((menu) => ({
      labels: canonicalizeLabels(menu.labels),
      sourceUrl: cleanText(menu.sourceUrl),
      cuisines: uniqueSorted(menu.cuisines ?? []),
      sections: menu.sections.map((section) => ({
        labels: canonicalizeLabels(section.labels),
        items: section.items.map((item) => ({
          labels: canonicalizeLabels(item.labels),
          attributes: canonicalizeAttributes(item.attributes),
          options: (item.options ?? []).map((option) => ({
            labels: canonicalizeLabels(option.labels),
            attributes: canonicalizeAttributes(option.attributes),
          })),
        })),
      })),
    })),
  };
}

export function hashGoogleFoodMenusResource(foodMenus: GoogleFoodMenusResource): string {
  return hashCanonicalJson(
    omitDefaultExtendedAttributesForHash(canonicalizeGoogleFoodMenusResource(foodMenus)),
  )!;
}
