import type {
  FoodMenusLocalItem,
  GoogleFoodMenuCuisine,
  GoogleFoodMenusImportItemSuggestedPatch,
} from './food-menus';

export type FoodMenusImportReviewDecisionAction =
  | 'apply_to_nabatable'
  | 'create_new_item'
  | 'ignore_google_change'
  | 'apply_menu_metadata'
  | 'mark_inactive'
  | 'mark_sold_out'
  | 'delete_local';

export type ParsedFoodMenusSuggestedPatch = GoogleFoodMenusImportItemSuggestedPatch;

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function parseSuggestedPatch(value: unknown): ParsedFoodMenusSuggestedPatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const patch: ParsedFoodMenusSuggestedPatch = {};
  if (typeof record.externalItemId === 'string' && record.externalItemId.trim()) {
    patch.externalItemId = record.externalItemId.trim();
  }
  if (typeof record.itemName === 'string' && record.itemName.trim()) {
    patch.itemName = record.itemName.trim();
  }
  if (typeof record.category === 'string' && record.category.trim()) {
    patch.category = record.category.trim();
  }
  if (typeof record.subcategory === 'string' || record.subcategory === null) {
    patch.subcategory =
      typeof record.subcategory === 'string' ? record.subcategory.trim() || null : null;
  }
  if (typeof record.shortDescription === 'string' || record.shortDescription === null) {
    patch.shortDescription =
      typeof record.shortDescription === 'string' ? record.shortDescription.trim() || null : null;
  }
  if (isNonNegativeFiniteNumber(record.basePrice)) {
    patch.basePrice = record.basePrice;
  }
  if (typeof record.currency === 'string' && record.currency.trim()) {
    patch.currency = record.currency.trim().toUpperCase();
  }
  if (typeof record.spiceLevel === 'string' || record.spiceLevel === null) {
    patch.spiceLevel =
      typeof record.spiceLevel === 'string' ? record.spiceLevel.trim() || null : null;
  }
  if (typeof record.preparationMethod === 'string' || record.preparationMethod === null) {
    patch.preparationMethod =
      typeof record.preparationMethod === 'string' ? record.preparationMethod.trim() || null : null;
  }
  if (typeof record.portionSize === 'string' || record.portionSize === null) {
    patch.portionSize =
      typeof record.portionSize === 'string' ? record.portionSize.trim() || null : null;
  }
  if (Array.isArray(record.keyIngredients)) {
    patch.keyIngredients = record.keyIngredients.filter(
      (entry): entry is string => typeof entry === 'string',
    );
  }
  if (typeof record.imageUrl === 'string' || record.imageUrl === null) {
    patch.imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() || null : null;
  }
  for (const key of [
    'caloriesKcal',
    'proteinG',
    'fatG',
    'saturatedFatG',
    'carbsG',
    'sugarG',
    'fiberG',
    'sodiumMg',
    'servesNum',
  ] as const) {
    const value = record[key];
    if (value === null) {
      patch[key] = value;
    } else if (key === 'servesNum') {
      if (isPositiveInteger(value)) {
        patch[key] = value;
      }
    } else if (isNonNegativeFiniteNumber(value)) {
      patch[key] = value;
    }
  }
  if (Array.isArray(record.dietaryTags)) {
    patch.dietaryTags = record.dietaryTags.filter(
      (entry): entry is string => typeof entry === 'string',
    );
  }
  if (Array.isArray(record.allergensContains)) {
    patch.allergensContains = record.allergensContains.filter(
      (entry): entry is string => typeof entry === 'string',
    );
  }
  if (Array.isArray(record.modifierGroups)) {
    patch.modifierGroups = record.modifierGroups.flatMap(
      (group): NonNullable<FoodMenusLocalItem['modifierGroups']> => {
        if (!group || typeof group !== 'object' || Array.isArray(group)) {
          return [];
        }
        const groupRecord = group as Record<string, unknown>;
        if (
          typeof groupRecord.externalModifierGroupId !== 'string' ||
          !groupRecord.externalModifierGroupId.trim() ||
          typeof groupRecord.groupName !== 'string' ||
          !groupRecord.groupName.trim()
        ) {
          return [];
        }
        const minSelect =
          typeof groupRecord.minSelect === 'number' &&
          Number.isInteger(groupRecord.minSelect) &&
          groupRecord.minSelect >= 0
            ? groupRecord.minSelect
            : 0;
        const maxSelect =
          typeof groupRecord.maxSelect === 'number' &&
          Number.isInteger(groupRecord.maxSelect) &&
          groupRecord.maxSelect >= minSelect
            ? groupRecord.maxSelect
            : Math.max(1, minSelect);

        return [
          {
            externalModifierGroupId: groupRecord.externalModifierGroupId.trim(),
            groupName: groupRecord.groupName.trim(),
            required: groupRecord.required === true,
            minSelect,
            maxSelect,
            displayOrder:
              typeof groupRecord.displayOrder === 'number' &&
              Number.isInteger(groupRecord.displayOrder) &&
              groupRecord.displayOrder >= 0
                ? groupRecord.displayOrder
                : 0,
            options: Array.isArray(groupRecord.options)
              ? groupRecord.options.flatMap((option, optionIndex) => {
                  if (!option || typeof option !== 'object' || Array.isArray(option)) {
                    return [];
                  }
                  const optionRecord = option as Record<string, unknown>;
                  if (
                    typeof optionRecord.externalModifierOptionId !== 'string' ||
                    !optionRecord.externalModifierOptionId.trim() ||
                    typeof optionRecord.optionName !== 'string' ||
                    !optionRecord.optionName.trim()
                  ) {
                    return [];
                  }
                  return [
                    {
                      externalModifierOptionId: optionRecord.externalModifierOptionId.trim(),
                      optionName: optionRecord.optionName.trim(),
                      priceDelta:
                        typeof optionRecord.priceDelta === 'number' &&
                        Number.isFinite(optionRecord.priceDelta) &&
                        optionRecord.priceDelta >= 0
                          ? optionRecord.priceDelta
                          : 0,
                      defaultSelected: optionRecord.defaultSelected === true,
                      availabilityStatus:
                        optionRecord.availabilityStatus === 'unavailable'
                          ? 'unavailable'
                          : 'available',
                      displayOrder:
                        typeof optionRecord.displayOrder === 'number' &&
                        Number.isInteger(optionRecord.displayOrder) &&
                        optionRecord.displayOrder >= 0
                          ? optionRecord.displayOrder
                          : optionIndex,
                    },
                  ];
                })
              : [],
          },
        ];
      },
    );
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function isCreateSuggestedPatch(
  patch: ReturnType<typeof parseSuggestedPatch>,
): patch is NonNullable<ReturnType<typeof parseSuggestedPatch>> &
  Pick<FoodMenusLocalItem, 'externalItemId' | 'itemName' | 'category' | 'basePrice'> {
  return Boolean(
    patch &&
    patch.externalItemId &&
    patch.itemName &&
    patch.category &&
    typeof patch.basePrice === 'number' &&
    Number.isFinite(patch.basePrice) &&
    patch.basePrice >= 0,
  );
}

export function parseMenuMetadataPatch(value: unknown): {
  readonly menuLabel?: string | null;
  readonly sourceUrl?: string | null;
  readonly cuisines?: GoogleFoodMenuCuisine[];
  readonly languageCode?: string | null;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const patch: {
    menuLabel?: string | null;
    sourceUrl?: string | null;
    cuisines?: GoogleFoodMenuCuisine[];
    languageCode?: string | null;
  } = {};
  if (typeof record.menuLabel === 'string' || record.menuLabel === null) {
    patch.menuLabel = typeof record.menuLabel === 'string' ? record.menuLabel.trim() || null : null;
  }
  if (typeof record.sourceUrl === 'string' || record.sourceUrl === null) {
    patch.sourceUrl = typeof record.sourceUrl === 'string' ? record.sourceUrl.trim() || null : null;
  }
  if (Array.isArray(record.cuisines)) {
    patch.cuisines = record.cuisines.filter(
      (entry): entry is GoogleFoodMenuCuisine => typeof entry === 'string',
    );
  }
  if (typeof record.languageCode === 'string' || record.languageCode === null) {
    patch.languageCode =
      typeof record.languageCode === 'string' ? record.languageCode.trim() || null : null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function hasPatchKey<T extends object, K extends PropertyKey>(
  patch: T,
  key: K,
): patch is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(patch, key);
}
