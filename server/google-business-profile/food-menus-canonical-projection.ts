import { uniqueSupportedCuisines } from './food-menus-local-projection';
import {
  buildLabel,
  buildMoney,
  cleanText,
  googleMoneyToNumber,
  normalizeComparableText,
  slugify,
  uniqueSorted,
} from './food-menus-serialization';

import type {
  BuildCanonicalGoogleFoodMenusProjectionInput,
  GoogleFoodMenuItem,
  GoogleFoodMenuItemAttributes,
  GoogleFoodMenusProjectedIdentity,
  GoogleFoodMenusProjection,
  GoogleFoodMenusProjectionSkippedItem,
  GoogleMenuLabel,
  GoogleNutritionFacts,
} from './food-menus';
import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';

const DEFAULT_LANGUAGE_CODE = 'en-GB';
const DEFAULT_MENU_NAME = 'Food menu';

type GoogleFoodMenusOptionDisplayMode = 'expanded_items' | 'single_from_parent';

export function sortedByDisplayOrder<T extends { displayOrder: number; id?: string | null }>(
  values: readonly T[],
  labelFor: (value: T) => string,
): T[] {
  return [...values].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      labelFor(left).localeCompare(labelFor(right)) ||
      (left.id ?? '').localeCompare(right.id ?? ''),
  );
}

export function primaryCanonicalLabel(
  entity:
    | Pick<CanonicalRestaurantMenu, 'labels'>
    | Pick<CanonicalRestaurantMenuSection, 'labels'>
    | Pick<CanonicalRestaurantMenuItem, 'labels'>
    | Pick<CanonicalRestaurantMenuOption, 'labels'>,
  fallback: string,
): GoogleMenuLabel {
  const label = entity.labels[0];
  return buildLabel(
    label?.displayName ?? fallback,
    label?.description ?? null,
    label?.languageCode ?? DEFAULT_LANGUAGE_CODE,
  );
}

export function primaryCanonicalLabelText(
  entity:
    | Pick<CanonicalRestaurantMenu, 'labels'>
    | Pick<CanonicalRestaurantMenuSection, 'labels'>
    | Pick<CanonicalRestaurantMenuItem, 'labels'>
    | Pick<CanonicalRestaurantMenuOption, 'labels'>,
  fallback: string,
): string {
  return cleanText(entity.labels[0]?.displayName) ?? fallback;
}

export function canonicalProjectionOptionDisplayMode(
  item: CanonicalRestaurantMenuItem,
): GoogleFoodMenusOptionDisplayMode | null {
  const projection =
    item.legacySource.googleFoodMenusProjection &&
    typeof item.legacySource.googleFoodMenusProjection === 'object' &&
    !Array.isArray(item.legacySource.googleFoodMenusProjection)
      ? item.legacySource.googleFoodMenusProjection
      : null;
  const optionDisplay =
    projection && 'optionDisplay' in projection ? projection.optionDisplay : null;
  return optionDisplay === 'expanded_items' || optionDisplay === 'single_from_parent'
    ? optionDisplay
    : null;
}

export function canonicalNutritionFacts(
  nutritionFacts: CanonicalRestaurantMenuItem['attributes']['nutritionFacts'] | null | undefined,
): GoogleNutritionFacts {
  return Object.fromEntries(
    Object.entries(nutritionFacts ?? {})
      .map(([key, value]) => [
        key,
        value
          ? {
              ...(cleanText(value.unit) ? { unit: cleanText(value.unit)! } : {}),
              ...(typeof value.quantity === 'number' ? { quantity: value.quantity } : {}),
              ...(typeof value.lowerAmount === 'number' ? { lowerAmount: value.lowerAmount } : {}),
              ...(typeof value.upperAmount === 'number' ? { upperAmount: value.upperAmount } : {}),
            }
          : null,
      ])
      .filter(([, value]) => Boolean(value)),
  ) as GoogleNutritionFacts;
}

export function canonicalMediaKeys(item: {
  readonly attributes: { mediaKeys?: readonly string[] };
  readonly media: { googleMediaKeys?: readonly string[] };
}): string[] {
  return uniqueSorted(
    [...(item.media.googleMediaKeys ?? []), ...(item.attributes.mediaKeys ?? [])]
      .map((value) => cleanText(value))
      .filter((value): value is string =>
        Boolean(value && !/^(https?:|data:|blob:|\/)/i.test(value)),
      ),
  );
}

export function buildCanonicalAttributes(
  item: CanonicalRestaurantMenuItem | CanonicalRestaurantMenuOption,
): GoogleFoodMenuItemAttributes {
  const attributes = item.attributes;
  const priceAmount = attributes.price?.amount;
  const mediaKeys = canonicalMediaKeys(item);
  const nutritionFacts = canonicalNutritionFacts(attributes.nutritionFacts);
  return {
    ...(typeof priceAmount === 'number'
      ? { price: buildMoney(priceAmount, attributes.price?.currencyCode ?? 'GBP') }
      : {}),
    ...(attributes.spiciness ? { spiciness: attributes.spiciness } : {}),
    ...(attributes.allergen?.length ? { allergen: uniqueSorted(attributes.allergen) } : {}),
    ...(attributes.dietaryRestriction?.length
      ? { dietaryRestriction: uniqueSorted(attributes.dietaryRestriction) }
      : {}),
    ...(attributes.ingredients?.length
      ? {
          ingredients: attributes.ingredients.map((ingredient) => ({
            labels: ingredient.labels.map((label) =>
              buildLabel(label.displayName, label.description, label.languageCode),
            ),
          })),
        }
      : {}),
    ...(attributes.preparationMethods?.length
      ? { preparationMethods: uniqueSorted(attributes.preparationMethods) }
      : {}),
    ...(attributes.portionSize
      ? {
          portionSize: {
            quantity: attributes.portionSize.quantity,
            unit: attributes.portionSize.unit.map((label) =>
              buildLabel(label.displayName, label.description, label.languageCode),
            ),
          },
        }
      : {}),
    ...(mediaKeys.length ? { mediaKeys } : {}),
    ...(Object.keys(nutritionFacts).length ? { nutritionFacts } : {}),
    ...(typeof attributes.servesNumPeople === 'number'
      ? { servesNumPeople: attributes.servesNumPeople }
      : {}),
    ...(typeof attributes.servesNum === 'number' ? { servesNum: attributes.servesNum } : {}),
  };
}

export function mergeExpandedOptionAttributes(
  parentAttributes: GoogleFoodMenuItemAttributes,
  optionAttributes: GoogleFoodMenuItemAttributes,
): GoogleFoodMenuItemAttributes {
  return {
    ...parentAttributes,
    ...optionAttributes,
    ...(optionAttributes.allergen?.length
      ? { allergen: optionAttributes.allergen }
      : parentAttributes.allergen?.length
        ? { allergen: parentAttributes.allergen }
        : {}),
    ...(optionAttributes.dietaryRestriction?.length
      ? { dietaryRestriction: optionAttributes.dietaryRestriction }
      : parentAttributes.dietaryRestriction?.length
        ? { dietaryRestriction: parentAttributes.dietaryRestriction }
        : {}),
    ...(optionAttributes.ingredients?.length
      ? { ingredients: optionAttributes.ingredients }
      : parentAttributes.ingredients?.length
        ? { ingredients: parentAttributes.ingredients }
        : {}),
    ...(optionAttributes.preparationMethods?.length
      ? { preparationMethods: optionAttributes.preparationMethods }
      : parentAttributes.preparationMethods?.length
        ? { preparationMethods: parentAttributes.preparationMethods }
        : {}),
    ...(optionAttributes.mediaKeys?.length
      ? { mediaKeys: optionAttributes.mediaKeys }
      : parentAttributes.mediaKeys?.length
        ? { mediaKeys: parentAttributes.mediaKeys }
        : {}),
    ...(optionAttributes.nutritionFacts && Object.keys(optionAttributes.nutritionFacts).length > 0
      ? { nutritionFacts: optionAttributes.nutritionFacts }
      : parentAttributes.nutritionFacts && Object.keys(parentAttributes.nutritionFacts).length > 0
        ? { nutritionFacts: parentAttributes.nutritionFacts }
        : {}),
  };
}

export function canonicalSkippedReason(
  item: CanonicalRestaurantMenuItem,
): GoogleFoodMenusProjectionSkippedItem['reason'] | null {
  if (item.extensions.availabilityPolicy.soldOut === true) {
    return 'sold_out';
  }
  return item.active ? null : 'inactive';
}

export function canonicalOptionIdentityPaths(
  item: CanonicalRestaurantMenuItem,
  itemPath: string,
): GoogleFoodMenusProjectedIdentity['googleOptionPaths'] {
  return sortedByDisplayOrder(
    item.options.filter((option) => option.active),
    (option) => primaryCanonicalLabelText(option, option.externalOptionId ?? option.id ?? 'Option'),
  ).map((option, optionIndex) => ({
    externalModifierGroupId: 'canonical-options',
    externalModifierOptionId: option.externalOptionId ?? option.id ?? `option-${optionIndex + 1}`,
    googlePath: `${itemPath}.options[${optionIndex}]`,
  }));
}

export function formatFromPrice(attributes: GoogleFoodMenuItemAttributes): string | null {
  const price = attributes.price;
  const amount = googleMoneyToNumber(price);
  const currencyCode = cleanText(price?.currencyCode)?.toUpperCase() ?? 'GBP';
  if (amount === null) {
    return null;
  }
  const formatted = amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currencyCode === 'GBP' ? `£${formatted}` : `${currencyCode} ${formatted}`;
}

export function withFromPriceSuffix(
  displayName: string,
  attributes: GoogleFoodMenuItemAttributes,
): string {
  if (/\bfrom\s+(£|[A-Z]{3}\s+)?\d/i.test(displayName)) {
    return displayName;
  }
  const fromPrice = formatFromPrice(attributes);
  return fromPrice ? `${displayName} - from ${fromPrice}` : displayName;
}

export function expandedOptionItemName(parentName: string, optionName: string): string {
  return normalizeComparableText(optionName).includes(normalizeComparableText(parentName))
    ? optionName
    : `${optionName} ${parentName}`;
}

export function buildCanonicalItem(item: CanonicalRestaurantMenuItem): GoogleFoodMenuItem {
  const options = sortedByDisplayOrder(
    item.options.filter((option) => option.active),
    (option) => primaryCanonicalLabelText(option, option.externalOptionId ?? option.id ?? 'Option'),
  ).map((option) => ({
    labels: [primaryCanonicalLabel(option, option.externalOptionId ?? 'Option')],
    attributes: buildCanonicalAttributes(option),
  }));
  return {
    labels: [primaryCanonicalLabel(item, item.externalItemId)],
    attributes: buildCanonicalAttributes(item),
    ...(options.length ? { options } : {}),
  };
}

export function buildCanonicalParentOnlyItem(
  item: CanonicalRestaurantMenuItem,
): GoogleFoodMenuItem {
  const attributes = buildCanonicalAttributes(item);
  const label = primaryCanonicalLabel(item, item.externalItemId);
  return {
    labels: [
      {
        ...label,
        displayName: withFromPriceSuffix(label.displayName, attributes),
      },
    ],
    attributes,
  };
}

export function buildCanonicalExpandedOptionItem(
  parentItem: CanonicalRestaurantMenuItem,
  option: CanonicalRestaurantMenuOption,
): GoogleFoodMenuItem {
  const parentLabel = primaryCanonicalLabel(parentItem, parentItem.externalItemId);
  const optionLabel = primaryCanonicalLabel(option, option.externalOptionId ?? 'Option');
  const attributes = mergeExpandedOptionAttributes(
    buildCanonicalAttributes(parentItem),
    buildCanonicalAttributes(option),
  );
  return {
    labels: [
      {
        ...optionLabel,
        displayName: expandedOptionItemName(parentLabel.displayName, optionLabel.displayName),
        ...((optionLabel.description ?? parentLabel.description)
          ? { description: optionLabel.description ?? parentLabel.description }
          : {}),
      },
    ],
    attributes,
  };
}

export function buildCanonicalGoogleFoodMenusProjection(
  input: BuildCanonicalGoogleFoodMenusProjectionInput,
): GoogleFoodMenusProjection {
  const identities: GoogleFoodMenusProjectedIdentity[] = [];
  const skippedItems: GoogleFoodMenusProjectionSkippedItem[] = [];
  const publishableMenus = sortedByDisplayOrder(
    input.menus.filter(
      (menu) => menu.active && (menu.menuKind === 'food' || menu.menuKind === 'mixed'),
    ),
    (menu) => primaryCanonicalLabelText(menu, menu.id ?? 'Menu'),
  );

  const menus = publishableMenus.map((menu, menuIndex) => {
    const sections = sortedByDisplayOrder(
      menu.sections.filter((section) => section.active || input.includeUnavailable),
      (section) => primaryCanonicalLabelText(section, section.id ?? 'Section'),
    ).map((section, sectionIndex) => {
      const sectionLabel = primaryCanonicalLabelText(section, section.id ?? 'Section');
      const exportableItems = sortedByDisplayOrder(section.items, (item) =>
        primaryCanonicalLabelText(item, item.externalItemId),
      ).filter((item) => {
        const reason = canonicalSkippedReason(item);
        if (!reason || input.includeUnavailable) return true;
        skippedItems.push({
          localItemId: item.id ?? item.externalItemId,
          externalItemId: item.externalItemId,
          reason,
        });
        return false;
      });
      const googleItems: GoogleFoodMenuItem[] = [];
      for (const item of exportableItems) {
        const mode = canonicalProjectionOptionDisplayMode(item);
        const activeOptions = sortedByDisplayOrder(
          item.options.filter((option) => option.active),
          (option) =>
            primaryCanonicalLabelText(option, option.externalOptionId ?? option.id ?? 'Option'),
        );

        if (mode === 'expanded_items') {
          for (const option of activeOptions) {
            const itemPath = `menus[${menuIndex}].sections[${sectionIndex}].items[${googleItems.length}]`;
            const parentStableKey = `foodMenu.menu.${slugify(menu.id ?? primaryCanonicalLabelText(menu, 'menu'), 'menu')}.section.${slugify(section.id ?? sectionLabel, 'section')}.item.${slugify(item.externalItemId, item.id ?? 'item')}`;
            const externalOptionId =
              option.externalOptionId ?? option.id ?? `option-${googleItems.length + 1}`;
            const googleItem = buildCanonicalExpandedOptionItem(item, option);
            identities.push({
              stableKey: `${parentStableKey}.optionItem.${slugify(externalOptionId, option.id ?? 'option')}`,
              localItemId: item.id ?? item.externalItemId,
              externalItemId: `${item.externalItemId}::option::${externalOptionId}`,
              itemName: primaryCanonicalLabelText(
                { labels: googleItem.labels },
                `${externalOptionId} ${item.externalItemId}`,
              ),
              sectionKey: slugify(section.id ?? sectionLabel, 'section'),
              sectionLabel,
              googlePath: itemPath,
              googleOptionPaths: [],
              projectionKind: 'option_item',
            });
            googleItems.push(googleItem);
          }
          continue;
        }

        const itemPath = `menus[${menuIndex}].sections[${sectionIndex}].items[${googleItems.length}]`;
        identities.push({
          stableKey: `foodMenu.menu.${slugify(menu.id ?? primaryCanonicalLabelText(menu, 'menu'), 'menu')}.section.${slugify(section.id ?? sectionLabel, 'section')}.item.${slugify(item.externalItemId, item.id ?? 'item')}`,
          localItemId: item.id ?? item.externalItemId,
          externalItemId: item.externalItemId,
          itemName: primaryCanonicalLabelText(item, item.externalItemId),
          sectionKey: slugify(section.id ?? sectionLabel, 'section'),
          sectionLabel,
          googlePath: itemPath,
          googleOptionPaths:
            mode === 'single_from_parent' ? [] : canonicalOptionIdentityPaths(item, itemPath),
        });
        googleItems.push(
          mode === 'single_from_parent'
            ? buildCanonicalParentOnlyItem(item)
            : buildCanonicalItem(item),
        );
      }
      return {
        labels: [primaryCanonicalLabel(section, section.id ?? 'Section')],
        items: googleItems,
      };
    });

    const cuisines = uniqueSupportedCuisines(menu.cuisines);
    return {
      labels: [primaryCanonicalLabel(menu, DEFAULT_MENU_NAME)],
      ...(cleanText(menu.sourceUrl) ? { sourceUrl: cleanText(menu.sourceUrl)! } : {}),
      sections,
      ...(cuisines.length ? { cuisines } : {}),
    };
  });

  return {
    foodMenus: {
      name: input.foodMenusName,
      menus,
    },
    identities,
    skippedItems,
  };
}
