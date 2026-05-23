import {
  allergenToTag,
  dietaryRestrictionToTag,
  ingredientsLabelsToArray,
  mediaKeysToImageUrl,
  nutritionFactsFromGoogle,
  portionSizeFromGoogle,
  preparationMethodsEqual,
  preparationMethodsToText,
  servesNumToInt,
  spicinessToSpiceLevel,
} from './food-menus-import-mapping';
import { mapPreparationMethod } from './food-menus-local-projection';
import {
  buildItemModifierGroupsPatch,
  synthesizeOptionsModifierGroup,
} from './food-menus-modifier-import';
import {
  arraysEqual,
  cleanText,
  getPrimaryLabel,
  googleMoneyToNumber,
  normalizeStringValues,
  slugify,
  uniqueSorted,
} from './food-menus-serialization';

import type {
  FoodMenusLocalItem,
  GoogleFoodMenu,
  GoogleFoodMenuItem,
  GoogleFoodMenuPreparationMethod,
  GoogleFoodMenusImportItemSuggestedPatch,
  GoogleFoodMenusImportMenuMetadataPatch,
  GoogleFoodMenusImportSuggestedPatch,
  GoogleFoodMenuSettings,
} from './food-menus';

const DEFAULT_LANGUAGE_CODE = 'en-GB';
const DEFAULT_MENU_NAME = 'Food menu';

export function buildSuggestedPatch(
  localItem: FoodMenusLocalItem,
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

export function splitSectionLabelForCreate(sectionLabel: string | null): {
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
): FoodMenusLocalItem {
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

export function buildCreateSuggestedPatch(
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

export function buildMenuMetadataSuggestedPatch(
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
