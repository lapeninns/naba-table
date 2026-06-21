import {
  LANGUAGE_CODE,
  NONE_VALUE,
  primaryDescription,
  primaryLabel,
  serializeAdditionalLabels,
} from './menuHierarchySharedDomain';

import type { ItemFormState, OptionFormState } from './menuHierarchyItemFormState';
import type {
  CanonicalMenuItemAttributes,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  MenuKind,
} from '@/server/menu-hierarchy/types';

function recordNote(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function recordNumber(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function recordBoolean(record: Record<string, unknown> | undefined, key: string, fallback = false) {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function recordStringList(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').join(', ')
    : '';
}

function nutritionValue(
  amount: CanonicalMenuItemAttributes['nutritionFacts'][keyof CanonicalMenuItemAttributes['nutritionFacts']],
) {
  const value = amount?.lowerAmount ?? amount?.quantity;
  return typeof value === 'number' ? String(value) : '';
}

function nutritionUpperValue(
  amount: CanonicalMenuItemAttributes['nutritionFacts'][keyof CanonicalMenuItemAttributes['nutritionFacts']],
) {
  const value = amount?.upperAmount;
  return typeof value === 'number' ? String(value) : '';
}

function portionUnitLabel(attributes: CanonicalMenuItemAttributes | undefined) {
  return attributes?.portionSize?.unit[0] ?? null;
}

function serializeAdditionalPortionUnits(attributes: CanonicalMenuItemAttributes | undefined) {
  return serializeAdditionalLabels(attributes?.portionSize?.unit ?? []);
}

export function itemInitialState(
  item?: CanonicalRestaurantMenuItem | null,
  menuKind: MenuKind = 'food',
): ItemFormState {
  const attributes = item?.attributes;
  const nutritionFacts = attributes?.nutritionFacts ?? {};
  const portionUnit = portionUnitLabel(attributes);
  const drinkProfile = item?.extensions?.drinkProfile;
  const recommendationMetadata = item?.extensions?.recommendationMetadata;
  const availabilityPolicy = item?.extensions?.availabilityPolicy;
  const customizationControls = item?.extensions?.customizationControls;
  const sourceMetadata = item?.extensions?.sourceMetadata;
  return {
    displayName: item ? primaryLabel(item, 'Menu item') : '',
    description: item ? primaryDescription(item) : '',
    languageCode: item?.labels[0]?.languageCode ?? LANGUAGE_CODE,
    additionalLabels: item ? serializeAdditionalLabels(item.labels) : '',
    price: typeof attributes?.price?.amount === 'number' ? String(attributes.price.amount) : '',
    currencyCode: attributes?.price?.currencyCode ?? 'GBP',
    spiciness: attributes?.spiciness ?? NONE_VALUE,
    allergens: attributes?.allergen ?? [],
    dietaryRestrictions: attributes?.dietaryRestriction ?? [],
    preparationMethods: attributes?.preparationMethods ?? [],
    ingredients:
      attributes?.ingredients
        ?.map((ingredient) => ingredient.labels[0]?.displayName)
        .filter(Boolean)
        .join(', ') ?? '',
    serves:
      typeof attributes?.servesNumPeople === 'number' ? String(attributes.servesNumPeople) : '',
    calories: nutritionValue(nutritionFacts.calories),
    totalFat: nutritionValue(nutritionFacts.totalFat),
    cholesterol: nutritionValue(nutritionFacts.cholesterol),
    sodium: nutritionValue(nutritionFacts.sodium),
    totalCarbohydrate: nutritionValue(nutritionFacts.totalCarbohydrate),
    protein: nutritionValue(nutritionFacts.protein),
    caloriesUpper: nutritionUpperValue(nutritionFacts.calories),
    totalFatUpper: nutritionUpperValue(nutritionFacts.totalFat),
    cholesterolUpper: nutritionUpperValue(nutritionFacts.cholesterol),
    sodiumUpper: nutritionUpperValue(nutritionFacts.sodium),
    totalCarbohydrateUpper: nutritionUpperValue(nutritionFacts.totalCarbohydrate),
    proteinUpper: nutritionUpperValue(nutritionFacts.protein),
    portionQuantity:
      typeof attributes?.portionSize?.quantity === 'number'
        ? String(attributes.portionSize.quantity)
        : '',
    portionUnitName: portionUnit?.displayName ?? '',
    portionUnitDescription: portionUnit?.description ?? '',
    portionUnitLanguageCode: portionUnit?.languageCode ?? LANGUAGE_CODE,
    portionAdditionalUnits: serializeAdditionalPortionUnits(attributes),
    googleMediaKeys: item?.media.googleMediaKeys?.join('\n') ?? '',
    localImageUrl: item?.media.localImageUrl ?? '',
    active: item?.active ?? true,
    availabilityStatus: recordNote(availabilityPolicy, 'availabilityStatus') || NONE_VALUE,
    soldOut: recordBoolean(availabilityPolicy, 'soldOut'),
    orderable: recordBoolean(availabilityPolicy, 'orderable', true),
    servicePeriods: recordStringList(availabilityPolicy, 'servicePeriods'),
    availabilityNote: recordNote(availabilityPolicy, 'opsNote'),
    allowCustomizations: recordBoolean(customizationControls, 'allowCustomizations', true),
    modifierGroupIds: recordStringList(customizationControls, 'operationalModifierGroupIds'),
    maxSelections: recordNumber(customizationControls, 'maxSelections'),
    customizationNote: recordNote(customizationControls, 'opsNote'),
    abvPercent: recordNumber(drinkProfile, 'abvPercent') || recordNumber(drinkProfile, 'abv'),
    volumeMl: recordNumber(drinkProfile, 'volumeMl'),
    servingSize: recordNote(drinkProfile, 'servingSize'),
    drinkStyle: recordNote(drinkProfile, 'style'),
    drinkRegion: recordNote(drinkProfile, 'region'),
    drinkGrape: recordNote(drinkProfile, 'grape'),
    caffeineMg: recordNumber(drinkProfile, 'caffeineMg'),
    containsDairy: recordBoolean(drinkProfile, 'containsDairy'),
    containsNuts: recordBoolean(drinkProfile, 'containsNuts'),
    containsGluten: recordBoolean(drinkProfile, 'containsGluten'),
    containsCaffeine: recordBoolean(drinkProfile, 'containsCaffeine'),
    nonAlcoholic: recordBoolean(drinkProfile, 'nonAlcoholic'),
    decafAvailable: recordBoolean(drinkProfile, 'decafAvailable'),
    drinkProfileNote: menuKind === 'drinks' ? recordNote(drinkProfile, 'opsNote') : '',
    featured: recordBoolean(recommendationMetadata, 'featured'),
    signature: recordBoolean(recommendationMetadata, 'signature'),
    popularityScore: recordNumber(recommendationMetadata, 'popularityScore'),
    pairingNotes: recordNote(recommendationMetadata, 'pairingNotes'),
    recommendationTags: recordStringList(recommendationMetadata, 'recommendationTags'),
    sourceSystem: recordNote(sourceMetadata, 'sourceSystem'),
    sourceItemId: recordNote(sourceMetadata, 'sourceItemId'),
    importedAt: recordNote(sourceMetadata, 'importedAt'),
    sourceNote: recordNote(sourceMetadata, 'opsNote'),
  };
}

export function optionInitialState(option?: CanonicalRestaurantMenuOption | null): OptionFormState {
  const attributes = option?.attributes;
  const amount = option?.attributes.price?.amount;
  const nutritionFacts = attributes?.nutritionFacts ?? {};
  const portionUnit = portionUnitLabel(attributes);
  return {
    displayName: option ? primaryLabel(option, 'Option') : '',
    description: option ? primaryDescription(option) : '',
    languageCode: option?.labels[0]?.languageCode ?? LANGUAGE_CODE,
    additionalLabels: option ? serializeAdditionalLabels(option.labels) : '',
    price: typeof amount === 'number' ? String(amount) : '',
    currencyCode: option?.attributes.price?.currencyCode ?? 'GBP',
    spiciness: attributes?.spiciness ?? NONE_VALUE,
    allergens: attributes?.allergen ?? [],
    dietaryRestrictions: attributes?.dietaryRestriction ?? [],
    preparationMethods: attributes?.preparationMethods ?? [],
    ingredients:
      attributes?.ingredients
        ?.map((ingredient) => ingredient.labels[0]?.displayName)
        .filter(Boolean)
        .join(', ') ?? '',
    serves:
      typeof attributes?.servesNumPeople === 'number' ? String(attributes.servesNumPeople) : '',
    calories: nutritionValue(nutritionFacts.calories),
    totalFat: nutritionValue(nutritionFacts.totalFat),
    cholesterol: nutritionValue(nutritionFacts.cholesterol),
    sodium: nutritionValue(nutritionFacts.sodium),
    totalCarbohydrate: nutritionValue(nutritionFacts.totalCarbohydrate),
    protein: nutritionValue(nutritionFacts.protein),
    caloriesUpper: nutritionUpperValue(nutritionFacts.calories),
    totalFatUpper: nutritionUpperValue(nutritionFacts.totalFat),
    cholesterolUpper: nutritionUpperValue(nutritionFacts.cholesterol),
    sodiumUpper: nutritionUpperValue(nutritionFacts.sodium),
    totalCarbohydrateUpper: nutritionUpperValue(nutritionFacts.totalCarbohydrate),
    proteinUpper: nutritionUpperValue(nutritionFacts.protein),
    portionQuantity:
      typeof attributes?.portionSize?.quantity === 'number'
        ? String(attributes.portionSize.quantity)
        : '',
    portionUnitName: portionUnit?.displayName ?? '',
    portionUnitDescription: portionUnit?.description ?? '',
    portionUnitLanguageCode: portionUnit?.languageCode ?? LANGUAGE_CODE,
    portionAdditionalUnits: serializeAdditionalPortionUnits(attributes),
    googleMediaKeys: option?.media.googleMediaKeys?.join('\n') ?? '',
    localImageUrl: option?.media.localImageUrl ?? '',
    active: option?.active ?? true,
  };
}
