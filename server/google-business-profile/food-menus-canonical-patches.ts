import {
  DEFAULT_MENU_LANGUAGE_CODE,
  buildCanonicalMenuLabel,
  type CanonicalMenuItemAttributes,
  type CanonicalRestaurantMenuItem,
  type MenuItemKind,
  type MenuKind,
  type NabatableMenuItemExtensions,
  type RestaurantMenuItemInput,
} from '@/server/menu-hierarchy/types';

import {
  nutritionAmount,
  primaryDescription,
  primaryLabelText,
  tagToAllergen,
  tagToDietaryRestriction,
  textToPreparationMethod,
  textToSpiciness,
  uniqueSorted,
} from './food-menus-canonical-normalization';

import type {
  GoogleFoodMenusImportItemSuggestedPatch,
  GoogleFoodMenusImportTargetKind,
} from './food-menus';

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

export function itemPatchFromSuggestedPatch(
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

export function menuKindForTarget(targetKind: GoogleFoodMenusImportTargetKind): MenuKind {
  return targetKind === 'drink' ? 'drinks' : 'food';
}

function itemKindForTarget(targetKind: GoogleFoodMenusImportTargetKind): MenuItemKind {
  return targetKind === 'drink' ? 'drink' : 'food';
}

export function defaultMenuLabel(targetKind: GoogleFoodMenusImportTargetKind): string {
  return targetKind === 'drink' ? 'Drinks' : 'Food';
}

export function inputFromSuggestedPatch({
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
