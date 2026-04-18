import { MenuItemUpsertInputSchema } from '@/server/menu/types';

import type { MenuItemDetail, MenuItemUpsertInput } from '@/server/menu/types';

export type MenuModifierOptionFormState = {
  externalModifierOptionId: string;
  optionName: string;
  priceDelta: string;
  defaultSelected: boolean;
  availabilityStatus: 'available' | 'unavailable';
  displayOrder: string;
};

export type MenuModifierGroupFormState = {
  externalModifierGroupId: string;
  groupName: string;
  required: boolean;
  minSelect: string;
  maxSelect: string;
  displayOrder: string;
  options: MenuModifierOptionFormState[];
};

export type MenuItemFormState = {
  externalItemId: string;
  itemName: string;
  category: string;
  subcategory: string;
  shortDescription: string;
  fullDescription: string;
  basePrice: string;
  currency: string;
  serviceTime: string;
  availabilityStatus: 'available' | 'unavailable';
  keyIngredients: string;
  mainProteinOrBase: string;
  cookingStyle: string;
  preparationMethod: string;
  flavorProfile: string;
  texture: string;
  spiceLevel: string;
  spiceAdjustable: boolean;
  portionSize: string;
  shareable: boolean;
  recommendationTags: string;
  pairings: string;
  signatureScore: string;
  popularityScore: string;
  dietaryTags: string;
  allergensContains: string;
  allergensMayContain: string;
  removableIngredients: string;
  substitutionsAllowed: boolean;
  canBeMadeVegetarian: boolean;
  canBeMadeVegan: boolean;
  canBeMadeGlutenFree: boolean;
  customizationRules: string;
  servingNotes: string;
  active: boolean;
  seasonal: boolean;
  limitedTime: boolean;
  soldOut: boolean;
  displayOrder: string;
  imageUrl: string;
  modifierGroups: MenuModifierGroupFormState[];
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

function integerString(value: number | null | undefined, fallback = 0): string {
  return String(value ?? fallback);
}

export function createEmptyMenuItemFormState(): MenuItemFormState {
  return {
    externalItemId: '',
    itemName: '',
    category: '',
    subcategory: '',
    shortDescription: '',
    fullDescription: '',
    basePrice: '0.00',
    currency: 'GBP',
    serviceTime: '',
    availabilityStatus: 'available',
    keyIngredients: '',
    mainProteinOrBase: '',
    cookingStyle: '',
    preparationMethod: '',
    flavorProfile: '',
    texture: '',
    spiceLevel: '',
    spiceAdjustable: false,
    portionSize: '',
    shareable: false,
    recommendationTags: '',
    pairings: '',
    signatureScore: '',
    popularityScore: '',
    dietaryTags: '',
    allergensContains: '',
    allergensMayContain: '',
    removableIngredients: '',
    substitutionsAllowed: false,
    canBeMadeVegetarian: false,
    canBeMadeVegan: false,
    canBeMadeGlutenFree: false,
    customizationRules: '',
    servingNotes: '',
    active: true,
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    displayOrder: '0',
    imageUrl: '',
    modifierGroups: [],
  };
}

export function createMenuItemFormState(item: MenuItemDetail | null): MenuItemFormState {
  if (!item) {
    return createEmptyMenuItemFormState();
  }

  return {
    externalItemId: item.externalItemId,
    itemName: item.itemName,
    category: item.category,
    subcategory: item.subcategory ?? '',
    shortDescription: item.shortDescription ?? '',
    fullDescription: item.fullDescription ?? '',
    basePrice: item.basePrice.toFixed(2),
    currency: item.currency,
    serviceTime: item.serviceTime ?? '',
    availabilityStatus: item.availabilityStatus,
    keyIngredients: listToField(item.keyIngredients),
    mainProteinOrBase: item.mainProteinOrBase ?? '',
    cookingStyle: item.cookingStyle ?? '',
    preparationMethod: item.preparationMethod ?? '',
    flavorProfile: item.flavorProfile ?? '',
    texture: item.texture ?? '',
    spiceLevel: item.spiceLevel ?? '',
    spiceAdjustable: item.spiceAdjustable,
    portionSize: item.portionSize ?? '',
    shareable: item.shareable,
    recommendationTags: listToField(item.recommendationTags),
    pairings: listToField(item.pairings),
    signatureScore: item.signatureScore === null ? '' : String(item.signatureScore),
    popularityScore: item.popularityScore === null ? '' : String(item.popularityScore),
    dietaryTags: listToField(item.dietaryTags),
    allergensContains: listToField(item.allergensContains),
    allergensMayContain: listToField(item.allergensMayContain),
    removableIngredients: listToField(item.removableIngredients),
    substitutionsAllowed: item.substitutionsAllowed,
    canBeMadeVegetarian: item.canBeMadeVegetarian,
    canBeMadeVegan: item.canBeMadeVegan,
    canBeMadeGlutenFree: item.canBeMadeGlutenFree,
    customizationRules: item.customizationRules ?? '',
    servingNotes: item.servingNotes ?? '',
    active: item.active,
    seasonal: item.seasonal,
    limitedTime: item.limitedTime,
    soldOut: item.soldOut,
    displayOrder: String(item.displayOrder),
    imageUrl: item.imageUrl ?? '',
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

export function createEmptyModifierGroupFormState(): MenuModifierGroupFormState {
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

export function createEmptyModifierOptionFormState(): MenuModifierOptionFormState {
  return {
    externalModifierOptionId: '',
    optionName: '',
    priceDelta: '0.00',
    defaultSelected: false,
    availabilityStatus: 'available',
    displayOrder: '0',
  };
}

export function buildMenuItemPayload(form: MenuItemFormState): MenuItemUpsertInput {
  return MenuItemUpsertInputSchema.parse({
    externalItemId: form.externalItemId,
    itemName: form.itemName,
    category: form.category,
    subcategory: nullable(form.subcategory),
    shortDescription: nullable(form.shortDescription),
    fullDescription: nullable(form.fullDescription),
    basePrice: Number.parseFloat(form.basePrice),
    currency: form.currency.trim().toUpperCase() || 'GBP',
    serviceTime: nullable(form.serviceTime),
    availabilityStatus: form.availabilityStatus,
    keyIngredients: fieldToList(form.keyIngredients),
    mainProteinOrBase: nullable(form.mainProteinOrBase),
    cookingStyle: nullable(form.cookingStyle),
    preparationMethod: nullable(form.preparationMethod),
    flavorProfile: nullable(form.flavorProfile),
    texture: nullable(form.texture),
    spiceLevel: nullable(form.spiceLevel),
    spiceAdjustable: form.spiceAdjustable,
    portionSize: nullable(form.portionSize),
    shareable: form.shareable,
    recommendationTags: fieldToList(form.recommendationTags),
    pairings: fieldToList(form.pairings),
    signatureScore: nullable(form.signatureScore) ? Number.parseInt(form.signatureScore, 10) : null,
    popularityScore: nullable(form.popularityScore) ? Number.parseInt(form.popularityScore, 10) : null,
    dietaryTags: fieldToList(form.dietaryTags),
    allergensContains: fieldToList(form.allergensContains),
    allergensMayContain: fieldToList(form.allergensMayContain),
    removableIngredients: fieldToList(form.removableIngredients),
    substitutionsAllowed: form.substitutionsAllowed,
    canBeMadeVegetarian: form.canBeMadeVegetarian,
    canBeMadeVegan: form.canBeMadeVegan,
    canBeMadeGlutenFree: form.canBeMadeGlutenFree,
    customizationRules: nullable(form.customizationRules),
    servingNotes: nullable(form.servingNotes),
    active: form.active,
    seasonal: form.seasonal,
    limitedTime: form.limitedTime,
    soldOut: form.soldOut,
    displayOrder: Number.parseInt(form.displayOrder, 10),
    imageUrl: nullable(form.imageUrl),
    modifierGroups: form.modifierGroups.map((group, groupIndex) => ({
      externalModifierGroupId: group.externalModifierGroupId,
      groupName: group.groupName,
      required: group.required,
      minSelect: Number.parseInt(group.minSelect, 10),
      maxSelect: Number.parseInt(group.maxSelect, 10),
      displayOrder: Number.parseInt(group.displayOrder || integerString(groupIndex), 10),
      options: group.options.map((option, optionIndex) => ({
        externalModifierOptionId: option.externalModifierOptionId,
        optionName: option.optionName,
        priceDelta: Number.parseFloat(option.priceDelta),
        defaultSelected: option.defaultSelected,
        availabilityStatus: option.availabilityStatus,
        displayOrder: Number.parseInt(option.displayOrder || integerString(optionIndex), 10),
      })),
    })),
  });
}
