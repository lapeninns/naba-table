import type {
  GoogleFoodMenuAllergen,
  GoogleFoodMenuDietaryRestriction,
  GoogleFoodMenuPreparationMethod,
  GoogleFoodMenuSpiciness,
} from './food-menus';
import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';

export function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

export function primaryLabelText(
  entity:
    | Pick<CanonicalRestaurantMenu, 'labels'>
    | Pick<CanonicalRestaurantMenuSection, 'labels'>
    | Pick<CanonicalRestaurantMenuItem, 'labels'>
    | Pick<CanonicalRestaurantMenuOption, 'labels'>,
  fallback: string,
): string {
  return cleanText(entity.labels[0]?.displayName) ?? fallback;
}

export function primaryDescription(
  entity: Pick<CanonicalRestaurantMenuItem, 'labels'>,
): string | null {
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

export function nutritionValue(
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

export function spicinessToText(value: GoogleFoodMenuSpiciness | null | undefined): string | null {
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

export function textToSpiciness(value: string | null | undefined): GoogleFoodMenuSpiciness | null {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('hot') || normalized.includes('spicy')) return 'HOT';
  if (normalized.includes('medium')) return 'MEDIUM';
  if (normalized.includes('mild')) return 'MILD';
  return null;
}

export function allergenToTag(value: GoogleFoodMenuAllergen): string {
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

export function tagToAllergen(value: string): GoogleFoodMenuAllergen | null {
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

export function dietaryRestrictionToTag(value: GoogleFoodMenuDietaryRestriction): string {
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

export function tagToDietaryRestriction(value: string): GoogleFoodMenuDietaryRestriction | null {
  const normalized = value.toLowerCase();
  if (normalized.includes('vegan')) return 'VEGAN';
  if (normalized.includes('vegetarian') || normalized === 'veggie') return 'VEGETARIAN';
  if (normalized.includes('halal')) return 'HALAL';
  if (normalized.includes('kosher')) return 'KOSHER';
  if (normalized.includes('organic')) return 'ORGANIC';
  return null;
}

export function textToPreparationMethod(
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

export function uniqueSorted<T extends string>(values: ReadonlyArray<T | null | undefined>): T[] {
  return Array.from(new Set(values.filter((value): value is T => Boolean(value)))).sort(
    (left, right) => left.localeCompare(right),
  );
}

export function nutritionAmount(
  value: number | null | undefined,
  unit: 'CALORIE' | 'GRAM' | 'MILLIGRAM',
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? { lowerAmount: value, unit }
    : undefined;
}
