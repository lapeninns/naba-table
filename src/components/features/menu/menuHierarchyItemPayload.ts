import {
  LANGUAGE_CODE,
  NONE_VALUE,
  NUTRITION_UNITS,
  buildLabelList,
  parseAdditionalLabels,
  splitTokens,
} from './menuHierarchySharedDomain';

import type { ItemFormState, OptionFormState } from './menuHierarchyItemFormState';
import type { GoogleNutritionUnit } from '@/lib/google-food-menu-labels';
import type {
  CanonicalMenuItemAttributes,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  MenuKind,
  NabatableMenuItemExtensions,
  RestaurantMenuItemInput,
  RestaurantMenuItemPatch,
  RestaurantMenuOptionInput,
  RestaurantMenuOptionPatch,
} from '@/server/menu-hierarchy/types';

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function nutritionAmount(value: string, upperValue: string, unit: GoogleNutritionUnit) {
  const amount = value.trim() ? Number(value) : null;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return undefined;
  const upperAmount = upperValue.trim() ? Number(upperValue) : null;
  return {
    lowerAmount: amount,
    ...(typeof upperAmount === 'number' && Number.isFinite(upperAmount) && upperAmount >= amount
      ? { upperAmount }
      : {}),
    unit,
  };
}

function buildGoogleNutritionFacts(
  state: Pick<
    ItemFormState,
    | 'calories'
    | 'totalFat'
    | 'cholesterol'
    | 'sodium'
    | 'totalCarbohydrate'
    | 'protein'
    | 'caloriesUpper'
    | 'totalFatUpper'
    | 'cholesterolUpper'
    | 'sodiumUpper'
    | 'totalCarbohydrateUpper'
    | 'proteinUpper'
  >,
): CanonicalMenuItemAttributes['nutritionFacts'] {
  return {
    ...(nutritionAmount(state.calories, state.caloriesUpper, NUTRITION_UNITS.calorie)
      ? { calories: nutritionAmount(state.calories, state.caloriesUpper, NUTRITION_UNITS.calorie) }
      : {}),
    ...(nutritionAmount(state.totalFat, state.totalFatUpper, NUTRITION_UNITS.gram)
      ? { totalFat: nutritionAmount(state.totalFat, state.totalFatUpper, NUTRITION_UNITS.gram) }
      : {}),
    ...(nutritionAmount(state.cholesterol, state.cholesterolUpper, NUTRITION_UNITS.milligram)
      ? {
          cholesterol: nutritionAmount(
            state.cholesterol,
            state.cholesterolUpper,
            NUTRITION_UNITS.milligram,
          ),
        }
      : {}),
    ...(nutritionAmount(state.sodium, state.sodiumUpper, NUTRITION_UNITS.milligram)
      ? { sodium: nutritionAmount(state.sodium, state.sodiumUpper, NUTRITION_UNITS.milligram) }
      : {}),
    ...(nutritionAmount(state.totalCarbohydrate, state.totalCarbohydrateUpper, NUTRITION_UNITS.gram)
      ? {
          totalCarbohydrate: nutritionAmount(
            state.totalCarbohydrate,
            state.totalCarbohydrateUpper,
            NUTRITION_UNITS.gram,
          ),
        }
      : {}),
    ...(nutritionAmount(state.protein, state.proteinUpper, NUTRITION_UNITS.gram)
      ? { protein: nutritionAmount(state.protein, state.proteinUpper, NUTRITION_UNITS.gram) }
      : {}),
  };
}

function buildPortionSize(
  state: Pick<
    ItemFormState,
    | 'portionQuantity'
    | 'portionUnitName'
    | 'portionUnitDescription'
    | 'portionUnitLanguageCode'
    | 'portionAdditionalUnits'
  >,
): CanonicalMenuItemAttributes['portionSize'] {
  const unitName = state.portionUnitName.trim();
  if (!unitName) return undefined;
  const quantity = optionalNumber(state.portionQuantity);
  return {
    quantity: typeof quantity === 'number' && quantity > 0 ? quantity : 1,
    unit: [
      {
        displayName: unitName,
        description: state.portionUnitDescription.trim() || null,
        languageCode: state.portionUnitLanguageCode.trim() || LANGUAGE_CODE,
      },
      ...parseAdditionalLabels(state.portionAdditionalUnits),
    ],
  };
}

function buildGoogleAttributePayload(
  state: Pick<
    ItemFormState,
    | 'price'
    | 'currencyCode'
    | 'spiciness'
    | 'allergens'
    | 'dietaryRestrictions'
    | 'ingredients'
    | 'preparationMethods'
    | 'googleMediaKeys'
    | 'serves'
    | 'calories'
    | 'totalFat'
    | 'cholesterol'
    | 'sodium'
    | 'totalCarbohydrate'
    | 'protein'
    | 'caloriesUpper'
    | 'totalFatUpper'
    | 'cholesterolUpper'
    | 'sodiumUpper'
    | 'totalCarbohydrateUpper'
    | 'proteinUpper'
    | 'portionQuantity'
    | 'portionUnitName'
    | 'portionUnitDescription'
    | 'portionUnitLanguageCode'
    | 'portionAdditionalUnits'
  >,
  existing?: CanonicalRestaurantMenuItem | CanonicalRestaurantMenuOption | null,
): CanonicalMenuItemAttributes {
  const amount = state.price.trim() ? Number(state.price) : null;
  const googleMediaKeys = splitTokens(state.googleMediaKeys);
  return {
    price: {
      currencyCode: state.currencyCode.trim() || 'GBP',
      amount: Number.isFinite(amount) ? amount : null,
    },
    spiciness:
      state.spiciness === NONE_VALUE
        ? null
        : (state.spiciness as CanonicalMenuItemAttributes['spiciness']),
    allergen: state.allergens as CanonicalMenuItemAttributes['allergen'],
    dietaryRestriction:
      state.dietaryRestrictions as CanonicalMenuItemAttributes['dietaryRestriction'],
    ingredients: splitTokens(state.ingredients).map((ingredient) => ({
      labels: [{ displayName: ingredient, description: null, languageCode: LANGUAGE_CODE }],
    })),
    preparationMethods:
      state.preparationMethods as CanonicalMenuItemAttributes['preparationMethods'],
    mediaKeys: googleMediaKeys,
    nutritionFacts: {
      ...(existing?.attributes.nutritionFacts ?? {}),
      ...buildGoogleNutritionFacts(state),
    },
    ...(buildPortionSize(state) ? { portionSize: buildPortionSize(state) } : {}),
    servesNumPeople: state.serves.trim() ? Number(state.serves) : null,
  };
}

export function buildItemPayload({
  state,
  menuKind,
  displayOrder,
  existing,
}: {
  state: ItemFormState;
  menuKind: MenuKind;
  displayOrder: number;
  existing?: CanonicalRestaurantMenuItem | null;
}): RestaurantMenuItemInput | RestaurantMenuItemPatch {
  const googleMediaKeys = splitTokens(state.googleMediaKeys);
  const attributes = buildGoogleAttributePayload(state, existing);
  const extensions: NabatableMenuItemExtensions = {
    drinkProfile: {
      ...(existing?.extensions.drinkProfile ?? {}),
      abvPercent: optionalNumber(state.abvPercent),
      volumeMl: optionalNumber(state.volumeMl),
      servingSize: optionalText(state.servingSize),
      style: optionalText(state.drinkStyle),
      region: optionalText(state.drinkRegion),
      grape: optionalText(state.drinkGrape),
      caffeineMg: optionalNumber(state.caffeineMg),
      containsDairy: state.containsDairy,
      containsNuts: state.containsNuts,
      containsGluten: state.containsGluten,
      containsCaffeine: state.containsCaffeine,
      nonAlcoholic: state.nonAlcoholic,
      decafAvailable: state.decafAvailable,
      opsNote: optionalText(state.drinkProfileNote),
    },
    recommendationMetadata: {
      ...(existing?.extensions.recommendationMetadata ?? {}),
      featured: state.featured,
      signature: state.signature,
      popularityScore: optionalNumber(state.popularityScore),
      pairingNotes: optionalText(state.pairingNotes),
      recommendationTags: splitTokens(state.recommendationTags),
    },
    availabilityPolicy: {
      ...(existing?.extensions.availabilityPolicy ?? {}),
      availabilityStatus:
        state.availabilityStatus === NONE_VALUE
          ? null
          : (state.availabilityStatus as 'available' | 'unavailable' | 'seasonal'),
      soldOut: state.soldOut,
      orderable: state.orderable,
      servicePeriods: splitTokens(state.servicePeriods),
      opsNote: optionalText(state.availabilityNote),
    },
    customizationControls: {
      ...(existing?.extensions.customizationControls ?? {}),
      allowCustomizations: state.allowCustomizations,
      operationalModifierGroupIds: splitTokens(state.modifierGroupIds),
      maxSelections: optionalNumber(state.maxSelections),
      opsNote: optionalText(state.customizationNote),
    },
    sourceMetadata: {
      ...(existing?.extensions.sourceMetadata ?? {}),
      sourceSystem: optionalText(state.sourceSystem),
      sourceItemId: optionalText(state.sourceItemId),
      importedAt: optionalText(state.importedAt),
      editedFrom: 'ops-menu-hierarchy-ui',
      opsNote: optionalText(state.sourceNote),
    },
  };

  return {
    itemKind: menuKind === 'drinks' ? 'drink' : 'food',
    externalItemId: existing?.externalItemId ?? `ops:${Date.now()}`,
    labels: buildLabelList({
      displayName: state.displayName,
      description: state.description,
      languageCode: state.languageCode,
      additionalLabels: state.additionalLabels,
    }),
    attributes,
    media: {
      googleMediaKeys,
      localImageUrl: state.localImageUrl.trim() || null,
      localMedia: existing?.media.localMedia ?? {},
    },
    extensions,
    displayOrder,
    active: state.active,
    legacySource: existing?.legacySource ?? { editedFrom: 'ops-menu-hierarchy-ui' },
  };
}

export function buildOptionPayload(
  state: OptionFormState,
  displayOrder: number,
  existing?: CanonicalRestaurantMenuOption | null,
): RestaurantMenuOptionInput | RestaurantMenuOptionPatch {
  return {
    externalOptionId: existing?.externalOptionId ?? `ops-option:${Date.now()}`,
    labels: buildLabelList({
      displayName: state.displayName,
      description: state.description,
      languageCode: state.languageCode,
      additionalLabels: state.additionalLabels,
    }),
    attributes: buildGoogleAttributePayload(state, existing),
    media: {
      googleMediaKeys: splitTokens(state.googleMediaKeys),
      localImageUrl: state.localImageUrl.trim() || null,
      localMedia: existing?.media.localMedia ?? {},
    },
    displayOrder,
    active: state.active,
    legacySource: existing?.legacySource ?? { editedFrom: 'ops-menu-hierarchy-ui' },
  };
}
