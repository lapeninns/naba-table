import { GOOGLE_FOOD_MENU_CUISINES } from '@/lib/google-food-menu-cuisines';

import {
  buildLabel,
  buildMoney,
  cleanText,
  slugify,
  uniqueSorted,
} from './food-menus-serialization';

import type {
  BuildGoogleFoodMenusProjectionInput,
  FoodMenusLocalItem,
  FoodMenusLocalModifierOption,
  GoogleFoodMenuAllergen,
  GoogleFoodMenuDietaryRestriction,
  GoogleFoodMenuItem,
  GoogleFoodMenuItemAttributes,
  GoogleFoodMenuItemOption,
  GoogleFoodMenuPreparationMethod,
  GoogleFoodMenusProjectedIdentity,
  GoogleFoodMenusProjection,
  GoogleFoodMenusProjectionSkippedItem,
  GoogleFoodMenuSpiciness,
  GoogleNutritionAmount,
  GoogleNutritionFacts,
} from './food-menus';
import type { GoogleFoodMenuCuisine } from '@/lib/google-food-menu-cuisines';

const DEFAULT_LANGUAGE_CODE = 'en-GB';
const DEFAULT_MENU_NAME = 'Food menu';
const GOOGLE_FOOD_MENU_CUISINE_SET = new Set<string>(GOOGLE_FOOD_MENU_CUISINES);

type ProjectedSection = {
  sectionKey: string;
  label: string;
  sortOrder: number;
  items: FoodMenusLocalItem[];
};

export function getSkippedReason(
  item: FoodMenusLocalItem,
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

export function mapSpiciness(
  value: string | null | undefined,
): GoogleFoodMenuSpiciness | undefined {
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

export function mapAllergen(value: string): GoogleFoodMenuAllergen | null {
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

export function mapDietaryRestriction(value: string): GoogleFoodMenuDietaryRestriction | null {
  const normalized = value.toLowerCase();
  if (normalized.includes('vegan')) return 'VEGAN';
  if (normalized.includes('vegetarian') || normalized === 'veggie') return 'VEGETARIAN';
  if (normalized.includes('halal')) return 'HALAL';
  if (normalized.includes('kosher')) return 'KOSHER';
  if (normalized.includes('organic')) return 'ORGANIC';
  return null;
}

export function mapPreparationMethod(
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

export function uniqueSupportedCuisines(
  values: ReadonlyArray<string | null | undefined>,
): GoogleFoodMenuCuisine[] {
  return uniqueSorted(
    values.filter((value): value is GoogleFoodMenuCuisine =>
      Boolean(value && GOOGLE_FOOD_MENU_CUISINE_SET.has(value)),
    ),
  );
}

export function buildAttributes(
  item: Pick<
    FoodMenusLocalItem,
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

export function buildOption(
  item: FoodMenusLocalItem,
  option: FoodMenusLocalModifierOption,
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

export function buildItem(item: FoodMenusLocalItem, languageCode: string): GoogleFoodMenuItem {
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

export function getSectionLabel(item: FoodMenusLocalItem): string {
  const category = cleanText(item.category) ?? 'Menu';
  const subcategory = cleanText(item.subcategory);
  return subcategory ? `${category} - ${subcategory}` : category;
}

export function getSectionKey(item: FoodMenusLocalItem): string {
  return `${slugify(item.category, 'menu')}/${slugify(item.subcategory, 'default')}`;
}

export function groupSections(items: FoodMenusLocalItem[]): ProjectedSection[] {
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

export function sortMenuItems(left: FoodMenusLocalItem, right: FoodMenusLocalItem): number {
  return left.displayOrder - right.displayOrder || left.itemName.localeCompare(right.itemName);
}

export function buildStableKey(item: FoodMenusLocalItem): string {
  return `foodMenu.item.${getSectionKey(item)}.${slugify(item.externalItemId, item.id)}`;
}

export function buildOptionIdentityPaths(
  item: FoodMenusLocalItem,
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
  const cuisines = uniqueSupportedCuisines(input.cuisines ?? []);

  return {
    foodMenus: {
      name: input.foodMenusName,
      menus: [
        {
          labels: [buildLabel(cleanText(input.menuLabel) ?? DEFAULT_MENU_NAME, null, languageCode)],
          ...(sourceUrl ? { sourceUrl } : {}),
          sections: googleSections,
          ...(cuisines.length ? { cuisines } : {}),
        },
      ],
    },
    identities,
    skippedItems,
  };
}
