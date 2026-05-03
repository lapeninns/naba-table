import { DrinkItemUpsertInputSchema } from '@/server/drinks-menu/types';

import type { DrinkItemDetail, DrinkItemUpsertInput } from '@/server/drinks-menu/types';

export type DrinkModifierOptionFormState = {
  externalModifierOptionId: string;
  optionName: string;
  priceDelta: string;
  defaultSelected: boolean;
  availabilityStatus: 'available' | 'unavailable';
  displayOrder: string;
};

export type DrinkModifierGroupFormState = {
  externalModifierGroupId: string;
  groupName: string;
  required: boolean;
  minSelect: string;
  maxSelect: string;
  displayOrder: string;
  options: DrinkModifierOptionFormState[];
};

export type DrinkItemFormState = {
  externalDrinkId: string;
  drinkName: string;
  category: string;
  subcategory: string;
  shortDescription: string;
  fullDescription: string;
  basePrice: string;
  currency: string;
  serviceTime: string;
  availabilityStatus: 'available' | 'unavailable';
  drinkType: string;
  alcoholic: boolean;
  abv: string;
  volumeMl: string;
  servingSize: string;
  servedStyle: string;
  temperature: string;
  baseSpirit: string;
  beerStyle: string;
  wineType: string;
  grapeVarietal: string;
  region: string;
  country: string;
  roastLevel: string;
  caffeineLevel: string;
  sweetnessLevel: string;
  bitternessLevel: string;
  acidityLevel: string;
  bodyLevel: string;
  flavorProfile: string;
  keyIngredients: string;
  garnish: string;
  containsDairy: boolean;
  containsNuts: boolean;
  containsGluten: boolean;
  containsCaffeine: boolean;
  dietaryTags: string;
  allergensContains: string;
  allergensMayContain: string;
  canBeMadeNonAlcoholic: boolean;
  canBeMadeDecaf: boolean;
  customizationRules: string;
  pairings: string;
  signatureScore: string;
  popularityScore: string;
  recommendationTags: string;
  seasonal: boolean;
  limitedTime: boolean;
  soldOut: boolean;
  active: boolean;
  displayOrder: string;
  imageUrl: string;
  caloriesKcal: string;
  proteinG: string;
  fatG: string;
  saturatedFatG: string;
  carbsG: string;
  sugarG: string;
  fiberG: string;
  sodiumMg: string;
  servesNum: string;
  modifierGroups: DrinkModifierGroupFormState[];
};

function listToField(values: string[]): string {
  return values.join(', ');
}

function fieldToList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nullableNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? Number.parseFloat(trimmed) : null;
}

function nullableInteger(value: string): number | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? Number.parseInt(trimmed, 10) : null;
}

export function createEmptyDrinkItemFormState(): DrinkItemFormState {
  return {
    externalDrinkId: '',
    drinkName: '',
    category: '',
    subcategory: '',
    shortDescription: '',
    fullDescription: '',
    basePrice: '0.00',
    currency: 'GBP',
    serviceTime: '',
    availabilityStatus: 'available',
    drinkType: '',
    alcoholic: false,
    abv: '',
    volumeMl: '',
    servingSize: '',
    servedStyle: '',
    temperature: '',
    baseSpirit: '',
    beerStyle: '',
    wineType: '',
    grapeVarietal: '',
    region: '',
    country: '',
    roastLevel: '',
    caffeineLevel: '',
    sweetnessLevel: '',
    bitternessLevel: '',
    acidityLevel: '',
    bodyLevel: '',
    flavorProfile: '',
    keyIngredients: '',
    garnish: '',
    containsDairy: false,
    containsNuts: false,
    containsGluten: false,
    containsCaffeine: false,
    dietaryTags: '',
    allergensContains: '',
    allergensMayContain: '',
    canBeMadeNonAlcoholic: false,
    canBeMadeDecaf: false,
    customizationRules: '',
    pairings: '',
    signatureScore: '',
    popularityScore: '',
    recommendationTags: '',
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    active: true,
    displayOrder: '0',
    imageUrl: '',
    caloriesKcal: '',
    proteinG: '',
    fatG: '',
    saturatedFatG: '',
    carbsG: '',
    sugarG: '',
    fiberG: '',
    sodiumMg: '',
    servesNum: '',
    modifierGroups: [],
  };
}

export function createDrinkItemFormState(item: DrinkItemDetail | null): DrinkItemFormState {
  if (!item) {
    return createEmptyDrinkItemFormState();
  }

  return {
    externalDrinkId: item.externalDrinkId,
    drinkName: item.drinkName,
    category: item.category,
    subcategory: item.subcategory ?? '',
    shortDescription: item.shortDescription ?? '',
    fullDescription: item.fullDescription ?? '',
    basePrice: item.basePrice.toFixed(2),
    currency: item.currency,
    serviceTime: item.serviceTime ?? '',
    availabilityStatus: item.availabilityStatus,
    drinkType: item.drinkType ?? '',
    alcoholic: item.alcoholic,
    abv: item.abv === null ? '' : item.abv.toFixed(2),
    volumeMl: item.volumeMl === null ? '' : String(item.volumeMl),
    servingSize: item.servingSize ?? '',
    servedStyle: item.servedStyle ?? '',
    temperature: item.temperature ?? '',
    baseSpirit: item.baseSpirit ?? '',
    beerStyle: item.beerStyle ?? '',
    wineType: item.wineType ?? '',
    grapeVarietal: item.grapeVarietal ?? '',
    region: item.region ?? '',
    country: item.country ?? '',
    roastLevel: item.roastLevel ?? '',
    caffeineLevel: item.caffeineLevel ?? '',
    sweetnessLevel: item.sweetnessLevel ?? '',
    bitternessLevel: item.bitternessLevel ?? '',
    acidityLevel: item.acidityLevel ?? '',
    bodyLevel: item.bodyLevel ?? '',
    flavorProfile: item.flavorProfile ?? '',
    keyIngredients: listToField(item.keyIngredients),
    garnish: item.garnish ?? '',
    containsDairy: item.containsDairy,
    containsNuts: item.containsNuts,
    containsGluten: item.containsGluten,
    containsCaffeine: item.containsCaffeine,
    dietaryTags: listToField(item.dietaryTags),
    allergensContains: listToField(item.allergensContains),
    allergensMayContain: listToField(item.allergensMayContain),
    canBeMadeNonAlcoholic: item.canBeMadeNonAlcoholic,
    canBeMadeDecaf: item.canBeMadeDecaf,
    customizationRules: item.customizationRules ?? '',
    pairings: listToField(item.pairings),
    signatureScore: item.signatureScore === null ? '' : String(item.signatureScore),
    popularityScore: item.popularityScore === null ? '' : String(item.popularityScore),
    recommendationTags: listToField(item.recommendationTags),
    seasonal: item.seasonal,
    limitedTime: item.limitedTime,
    soldOut: item.soldOut,
    active: item.active,
    displayOrder: String(item.displayOrder),
    imageUrl: item.imageUrl ?? '',
    caloriesKcal: item.caloriesKcal === null ? '' : String(item.caloriesKcal),
    proteinG: item.proteinG === null ? '' : String(item.proteinG),
    fatG: item.fatG === null ? '' : String(item.fatG),
    saturatedFatG: item.saturatedFatG === null ? '' : String(item.saturatedFatG),
    carbsG: item.carbsG === null ? '' : String(item.carbsG),
    sugarG: item.sugarG === null ? '' : String(item.sugarG),
    fiberG: item.fiberG === null ? '' : String(item.fiberG),
    sodiumMg: item.sodiumMg === null ? '' : String(item.sodiumMg),
    servesNum: item.servesNum === null ? '' : String(item.servesNum),
    modifierGroups: item.modifierGroups.map((group) => ({
      externalModifierGroupId: group.externalModifierGroupId,
      groupName: group.groupName,
      required: group.required,
      minSelect: String(group.minSelect),
      maxSelect: String(group.maxSelect),
      displayOrder: String(group.displayOrder),
      options: group.options.map((option) => ({
        externalModifierOptionId: option.externalModifierOptionId,
        optionName: option.optionName,
        priceDelta: option.priceDelta.toFixed(2),
        defaultSelected: option.defaultSelected,
        availabilityStatus: option.availabilityStatus,
        displayOrder: String(option.displayOrder),
      })),
    })),
  };
}

export function createEmptyDrinkModifierGroupFormState(): DrinkModifierGroupFormState {
  return {
    externalModifierGroupId: '',
    groupName: '',
    required: false,
    minSelect: '0',
    maxSelect: '1',
    displayOrder: '0',
    options: [],
  };
}

export function createEmptyDrinkModifierOptionFormState(): DrinkModifierOptionFormState {
  return {
    externalModifierOptionId: '',
    optionName: '',
    priceDelta: '0.00',
    defaultSelected: false,
    availabilityStatus: 'available',
    displayOrder: '0',
  };
}

export function buildDrinkItemPayload(form: DrinkItemFormState): DrinkItemUpsertInput {
  return DrinkItemUpsertInputSchema.parse({
    externalDrinkId: form.externalDrinkId,
    drinkName: form.drinkName,
    category: form.category,
    subcategory: nullable(form.subcategory),
    shortDescription: nullable(form.shortDescription),
    fullDescription: nullable(form.fullDescription),
    basePrice: Number.parseFloat(form.basePrice),
    currency: form.currency.trim().toUpperCase() || 'GBP',
    serviceTime: nullable(form.serviceTime),
    availabilityStatus: form.availabilityStatus,
    drinkType: nullable(form.drinkType),
    alcoholic: form.alcoholic,
    abv: nullable(form.abv) ? Number.parseFloat(form.abv) : null,
    volumeMl: nullable(form.volumeMl) ? Number.parseInt(form.volumeMl, 10) : null,
    servingSize: nullable(form.servingSize),
    servedStyle: nullable(form.servedStyle),
    temperature: nullable(form.temperature),
    baseSpirit: nullable(form.baseSpirit),
    beerStyle: nullable(form.beerStyle),
    wineType: nullable(form.wineType),
    grapeVarietal: nullable(form.grapeVarietal),
    region: nullable(form.region),
    country: nullable(form.country),
    roastLevel: nullable(form.roastLevel),
    caffeineLevel: nullable(form.caffeineLevel),
    sweetnessLevel: nullable(form.sweetnessLevel),
    bitternessLevel: nullable(form.bitternessLevel),
    acidityLevel: nullable(form.acidityLevel),
    bodyLevel: nullable(form.bodyLevel),
    flavorProfile: nullable(form.flavorProfile),
    keyIngredients: fieldToList(form.keyIngredients),
    garnish: nullable(form.garnish),
    containsDairy: form.containsDairy,
    containsNuts: form.containsNuts,
    containsGluten: form.containsGluten,
    containsCaffeine: form.containsCaffeine,
    dietaryTags: fieldToList(form.dietaryTags),
    allergensContains: fieldToList(form.allergensContains),
    allergensMayContain: fieldToList(form.allergensMayContain),
    canBeMadeNonAlcoholic: form.canBeMadeNonAlcoholic,
    canBeMadeDecaf: form.canBeMadeDecaf,
    customizationRules: nullable(form.customizationRules),
    pairings: fieldToList(form.pairings),
    signatureScore: nullable(form.signatureScore) ? Number.parseInt(form.signatureScore, 10) : null,
    popularityScore: nullable(form.popularityScore)
      ? Number.parseInt(form.popularityScore, 10)
      : null,
    recommendationTags: fieldToList(form.recommendationTags),
    seasonal: form.seasonal,
    limitedTime: form.limitedTime,
    soldOut: form.soldOut,
    active: form.active,
    displayOrder: Number.parseInt(form.displayOrder, 10),
    imageUrl: nullable(form.imageUrl),
    caloriesKcal: nullableInteger(form.caloriesKcal),
    proteinG: nullableNumber(form.proteinG),
    fatG: nullableNumber(form.fatG),
    saturatedFatG: nullableNumber(form.saturatedFatG),
    carbsG: nullableNumber(form.carbsG),
    sugarG: nullableNumber(form.sugarG),
    fiberG: nullableNumber(form.fiberG),
    sodiumMg: nullableNumber(form.sodiumMg),
    servesNum: nullableInteger(form.servesNum),
    modifierGroups: form.modifierGroups.map((group) => ({
      externalModifierGroupId: group.externalModifierGroupId,
      groupName: group.groupName,
      required: group.required,
      minSelect: Number.parseInt(group.minSelect, 10),
      maxSelect: Number.parseInt(group.maxSelect, 10),
      displayOrder: Number.parseInt(group.displayOrder, 10),
      options: group.options.map((option) => ({
        externalModifierOptionId: option.externalModifierOptionId,
        optionName: option.optionName,
        priceDelta: Number.parseFloat(option.priceDelta),
        defaultSelected: option.defaultSelected,
        availabilityStatus: option.availabilityStatus,
        displayOrder: Number.parseInt(option.displayOrder, 10),
      })),
    })),
  });
}
