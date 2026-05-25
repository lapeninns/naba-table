import {
  type CanonicalRestaurantMenu,
  type CanonicalRestaurantMenuItem,
  type CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';

import {
  preparationMethodsToText,
  type FoodMenusLocalItem,
  type FoodMenusLocalModifierGroup,
  type FoodMenusLocalModifierOption,
} from './food-menus';
import {
  allergenToTag,
  cleanText,
  dietaryRestrictionToTag,
  nutritionValue,
  primaryDescription,
  primaryLabelText,
  spicinessToText,
  uniqueSorted,
} from './food-menus-canonical-normalization';

const DEFAULT_CREATED_AT = '1970-01-01T00:00:00.000Z';

export { cleanText, primaryLabelText };
export {
  defaultMenuLabel,
  inputFromSuggestedPatch,
  itemPatchFromSuggestedPatch,
  menuKindForTarget,
} from './food-menus-canonical-patches';

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

export function canonicalItemToLocal(
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
