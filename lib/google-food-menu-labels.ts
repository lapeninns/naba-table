import { GOOGLE_FOOD_MENU_CUISINES } from '@/lib/google-food-menu-cuisines';

export const GOOGLE_FOOD_MENU_SPICINESS = ['MILD', 'MEDIUM', 'HOT'] as const;
export const GOOGLE_FOOD_MENU_ALLERGENS = [
  'DAIRY',
  'EGG',
  'FISH',
  'PEANUT',
  'SHELLFISH',
  'SOY',
  'TREE_NUT',
  'WHEAT',
] as const;
export const GOOGLE_FOOD_MENU_DIETARY_RESTRICTIONS = [
  'HALAL',
  'KOSHER',
  'ORGANIC',
  'VEGAN',
  'VEGETARIAN',
] as const;
export const GOOGLE_FOOD_MENU_PREPARATION_METHODS = [
  'BAKED',
  'BARBECUED',
  'BASTED',
  'BLANCHED',
  'BOILED',
  'BRAISED',
  'CODDLED',
  'FERMENTED',
  'FRIED',
  'GRILLED',
  'KNEADED',
  'MARINATED',
  'PAN_FRIED',
  'PICKLED',
  'PRESSURE_COOKED',
  'ROASTED',
  'SAUTEED',
  'SEARED',
  'SIMMERED',
  'SMOKED',
  'STEAMED',
  'STEEPED',
  'STIR_FRIED',
  'OTHER_METHOD',
] as const;
export type GoogleFoodMenuPreparationMethod = (typeof GOOGLE_FOOD_MENU_PREPARATION_METHODS)[number];

export const GOOGLE_FOOD_MENU_COMMON_PREPARATION_METHODS = [
  'BAKED',
  'FRIED',
  'GRILLED',
  'PAN_FRIED',
  'ROASTED',
  'SAUTEED',
  'STEAMED',
] as const satisfies readonly GoogleFoodMenuPreparationMethod[];
export const GOOGLE_NUTRITION_UNITS = ['CALORIE', 'GRAM', 'MILLIGRAM'] as const;

export type GoogleNutritionUnit = (typeof GOOGLE_NUTRITION_UNITS)[number];

export function formatGoogleFoodMenuEnumLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function toSelectOptions<TValue extends string>(
  values: readonly TValue[],
  labelFn: (value: TValue) => string = formatGoogleFoodMenuEnumLabel,
) {
  return values.map((value) => ({ value, label: labelFn(value) }));
}

export const GOOGLE_FOOD_MENU_CUISINE_OPTIONS = GOOGLE_FOOD_MENU_CUISINES.filter(
  (cuisine) => cuisine !== 'CUISINE_UNSPECIFIED',
);
