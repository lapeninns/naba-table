import {
  arraysEqual,
  cleanText,
  getPrimaryLabel,
  normalizeStringValues,
  uniqueSorted,
} from './food-menus-serialization';

import type {
  FoodMenusLocalItem,
  GoogleFoodMenuAllergen,
  GoogleFoodMenuDietaryRestriction,
  GoogleFoodMenuItemAttributes,
  GoogleFoodMenuPreparationMethod,
  GoogleFoodMenuSpiciness,
  GoogleNutritionAmount,
  GoogleNutritionFacts,
} from './food-menus';

export function dietaryRestrictionToTag(value: GoogleFoodMenuDietaryRestriction): string | null {
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

export function allergenToTag(value: GoogleFoodMenuAllergen): string | null {
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

export function preparationMethodsEqual(
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
  FoodMenusLocalItem,
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
