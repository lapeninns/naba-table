import {
  cleanText,
  getPrimaryLabel,
  googleMoneyToNumber,
  normalizeComparableText,
  slugify,
} from './food-menus-serialization';

import type {
  FoodMenusLocalItem,
  FoodMenusLocalModifierGroup,
  GoogleFoodMenuItem,
} from './food-menus';

export function normalizeModifierGroups(
  groups: ReadonlyArray<
    Pick<
      FoodMenusLocalModifierGroup,
      | 'externalModifierGroupId'
      | 'groupName'
      | 'required'
      | 'minSelect'
      | 'maxSelect'
      | 'displayOrder'
      | 'options'
    >
  >,
): FoodMenusLocalModifierGroup[] {
  return groups
    .map((group) => ({
      externalModifierGroupId: group.externalModifierGroupId,
      groupName: group.groupName,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      displayOrder: group.displayOrder,
      options: group.options
        .map((option) => ({
          externalModifierOptionId: option.externalModifierOptionId,
          optionName: option.optionName,
          priceDelta: Number(option.priceDelta.toFixed(2)),
          defaultSelected: option.defaultSelected,
          availabilityStatus: option.availabilityStatus,
          displayOrder: option.displayOrder,
        }))
        .sort((left, right) => left.displayOrder - right.displayOrder),
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

export function modifierGroupsEqual(
  left: ReadonlyArray<FoodMenusLocalModifierGroup>,
  right: ReadonlyArray<FoodMenusLocalModifierGroup>,
): boolean {
  return (
    JSON.stringify(normalizeModifierGroups(left)) === JSON.stringify(normalizeModifierGroups(right))
  );
}

export function findExistingOptionsGroup(
  item: FoodMenusLocalItem,
): FoodMenusLocalItem['modifierGroups'][number] | null {
  return (
    item.modifierGroups.find((group) => normalizeComparableText(group.groupName) === 'options') ??
    null
  );
}

export function synthesizeOptionsModifierGroup(
  item: FoodMenusLocalItem,
  googleItem: GoogleFoodMenuItem,
  googlePath: string,
): FoodMenusLocalModifierGroup | null {
  const options = googleItem.options ?? [];
  if (options.length === 0) {
    return null;
  }
  const existingOptionsGroup = findExistingOptionsGroup(item);
  const existingOptionsByName = new Map(
    (existingOptionsGroup?.options ?? []).map((option) => [
      normalizeComparableText(option.optionName),
      option,
    ]),
  );

  return {
    externalModifierGroupId:
      existingOptionsGroup?.externalModifierGroupId ?? `gbp-${slugify(googlePath, 'item')}-options`,
    groupName: 'Options',
    required: false,
    minSelect: 0,
    maxSelect: Math.max(1, options.length),
    displayOrder: existingOptionsGroup?.displayOrder ?? item.modifierGroups.length,
    options: options.map((option, optionIndex) => {
      const optionName =
        cleanText(getPrimaryLabel(option.labels)?.displayName) ?? `Option ${optionIndex + 1}`;
      const existingOption = existingOptionsByName.get(normalizeComparableText(optionName));
      const optionPrice = googleMoneyToNumber(option.attributes.price);
      const priceDelta =
        optionPrice === null ? 0 : Number((optionPrice - item.basePrice).toFixed(2));
      return {
        externalModifierOptionId:
          existingOption?.externalModifierOptionId ??
          `gbp-${slugify(`${googlePath}-option-${optionName}`, `option-${optionIndex + 1}`)}`,
        optionName,
        priceDelta,
        defaultSelected: existingOption?.defaultSelected ?? false,
        availabilityStatus: 'available',
        displayOrder: existingOption?.displayOrder ?? optionIndex,
      };
    }),
  };
}

export function buildItemModifierGroupsPatch(
  item: FoodMenusLocalItem,
  googleItem: GoogleFoodMenuItem,
  googlePath: string,
): FoodMenusLocalModifierGroup[] | null {
  const currentGroups = normalizeModifierGroups(item.modifierGroups);
  const existingOptionsGroup = findExistingOptionsGroup(item);
  const googleOptionsGroup = synthesizeOptionsModifierGroup(item, googleItem, googlePath);
  if (!googleOptionsGroup && !existingOptionsGroup) {
    return null;
  }
  const nextGroups = normalizeModifierGroups([
    ...item.modifierGroups.filter(
      (group) => normalizeComparableText(group.groupName) !== 'options',
    ),
    ...(googleOptionsGroup ? [googleOptionsGroup] : []),
  ]);
  return modifierGroupsEqual(currentGroups, nextGroups) ? null : nextGroups;
}
