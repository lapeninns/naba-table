import { hashCanonicalJson } from '@/server/dual-sync/hashing';

import type {
  CanonicalGoogleFoodMenusResource,
  GoogleFoodMenu,
  GoogleFoodMenuItem,
  GoogleFoodMenuItemAttributes,
  GoogleFoodMenuSection,
  GoogleFoodMenusResource,
  GoogleMenuLabel,
  GoogleMoney,
  GoogleNutritionAmount,
  GoogleNutritionFacts,
} from './food-menus';

const DEFAULT_LANGUAGE_CODE = 'en-GB';
const LABEL_DISPLAY_NAME_LIMIT = 140;
const LABEL_DESCRIPTION_LIMIT = 1000;

export function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return value.slice(0, limit - 1).trimEnd();
}

export function slugify(value: string | null | undefined, fallback: string): string {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return fallback;
  }
  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function buildLabel(
  displayName: string,
  description: string | null | undefined,
  languageCode: string,
): GoogleMenuLabel {
  const cleanedName = cleanText(displayName) ?? 'Unnamed item';
  const cleanedDescription = cleanText(description);
  return {
    displayName: truncateText(cleanedName, LABEL_DISPLAY_NAME_LIMIT),
    ...(cleanedDescription
      ? { description: truncateText(cleanedDescription, LABEL_DESCRIPTION_LIMIT) }
      : {}),
    languageCode,
  };
}

export function buildMoney(value: number, currencyCode: string): GoogleMoney {
  const cents = Math.max(0, Math.round(value * 100));
  const units = Math.trunc(cents / 100);
  const nanos = (cents % 100) * 10_000_000;
  return {
    currencyCode: currencyCode.trim().toUpperCase(),
    units: String(units),
    nanos,
  };
}

export function googleMoneyToNumber(value: GoogleMoney | undefined): number | null {
  if (!value) {
    return null;
  }
  const units = Number.parseInt(value.units || '0', 10);
  const nanos = typeof value.nanos === 'number' ? value.nanos : 0;
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) {
    return null;
  }
  return Number((units + nanos / 1_000_000_000).toFixed(2));
}

export function normalizeComparableText(value: string | null | undefined): string {
  return cleanText(value)?.toLowerCase() ?? '';
}

export function getPrimaryLabel(labels: GoogleMenuLabel[] | undefined): GoogleMenuLabel | null {
  return labels?.[0] ?? null;
}

export function canonicalizeLabels(labels: GoogleMenuLabel[] | undefined): GoogleMenuLabel[] {
  return (labels ?? [])
    .map((label) => {
      const displayName = cleanText(label.displayName);
      if (!displayName) {
        return null;
      }
      const description = cleanText(label.description);
      return {
        displayName,
        ...(description ? { description } : {}),
        languageCode: cleanText(label.languageCode) ?? DEFAULT_LANGUAGE_CODE,
      };
    })
    .filter((label): label is GoogleMenuLabel => Boolean(label));
}

export function canonicalizeNutritionAmount(value: GoogleNutritionAmount | null | undefined): {
  unit: string | null;
  lowerAmount: number | null;
  upperAmount: number | null;
} {
  const unit = cleanText(value?.unit)?.toUpperCase() ?? null;
  const lowerAmount =
    typeof value?.lowerAmount === 'number' && Number.isFinite(value.lowerAmount)
      ? Number(value.lowerAmount.toFixed(2))
      : typeof value?.quantity === 'number' && Number.isFinite(value.quantity)
        ? Number(value.quantity.toFixed(2))
        : null;
  const upperAmount =
    typeof value?.upperAmount === 'number' && Number.isFinite(value.upperAmount)
      ? Number(value.upperAmount.toFixed(2))
      : null;
  return { unit, lowerAmount, upperAmount };
}

export function canonicalizeNutritionFacts(
  nutritionFacts: GoogleNutritionFacts | null | undefined,
) {
  return {
    calories: canonicalizeNutritionAmount(nutritionFacts?.calories),
    totalFat: canonicalizeNutritionAmount(nutritionFacts?.totalFat),
    saturatedFat: canonicalizeNutritionAmount(nutritionFacts?.saturatedFat),
    cholesterol: canonicalizeNutritionAmount(nutritionFacts?.cholesterol),
    sodium: canonicalizeNutritionAmount(nutritionFacts?.sodium),
    totalCarbohydrate: canonicalizeNutritionAmount(nutritionFacts?.totalCarbohydrate),
    sugars: canonicalizeNutritionAmount(nutritionFacts?.sugars),
    dietaryFiber: canonicalizeNutritionAmount(nutritionFacts?.dietaryFiber),
    protein: canonicalizeNutritionAmount(nutritionFacts?.protein),
  };
}

function hasNutritionFacts(nutritionFacts: ReturnType<typeof canonicalizeNutritionFacts>): boolean {
  return Object.values(nutritionFacts).some(
    (amount) => amount.unit !== null || amount.lowerAmount !== null || amount.upperAmount !== null,
  );
}

export function uniqueSorted<T extends string>(values: ReadonlyArray<T | null | undefined>): T[] {
  return [...new Set(values.filter((value): value is T => Boolean(value)))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function normalizeStringValues(values: string[]): string[] {
  return uniqueSorted(
    values.map((value) => cleanText(value)).filter((value): value is string => Boolean(value)),
  );
}

export function canonicalizeAttributes(attributes: GoogleFoodMenuItemAttributes) {
  const amount = googleMoneyToNumber(attributes.price);
  const nutritionFacts = canonicalizeNutritionFacts(attributes.nutritionFacts);
  return {
    price: {
      currencyCode: cleanText(attributes.price?.currencyCode)?.toUpperCase() ?? 'GBP',
      amount,
    },
    spiciness: attributes.spiciness ?? null,
    allergen: uniqueSorted(attributes.allergen ?? []),
    dietaryRestriction: uniqueSorted(attributes.dietaryRestriction ?? []),
    ingredients: normalizeStringValues(
      (attributes.ingredients ?? []).flatMap((ingredient) =>
        (ingredient.labels ?? []).map((label) => label.displayName),
      ),
    ),
    preparationMethods: uniqueSorted(attributes.preparationMethods ?? []),
    portionSize: cleanText(getPrimaryLabel(attributes.portionSize?.unit)?.displayName),
    mediaKeys: normalizeStringValues(attributes.mediaKeys ?? []),
    nutritionFacts,
    servesNumPeople:
      typeof attributes.servesNumPeople === 'number' && Number.isFinite(attributes.servesNumPeople)
        ? Math.trunc(attributes.servesNumPeople)
        : typeof attributes.servesNum === 'number' && Number.isFinite(attributes.servesNum)
          ? Math.trunc(attributes.servesNum)
          : null,
  };
}

type CanonicalFoodMenuItemAttributes =
  CanonicalGoogleFoodMenusResource['menus'][number]['sections'][number]['items'][number]['attributes'];

function omitDefaultExtendedAttributeFields(attributesValue: CanonicalFoodMenuItemAttributes) {
  const { mediaKeys, nutritionFacts, servesNumPeople, ...attributes } = attributesValue;
  return mediaKeys.length === 0 && !hasNutritionFacts(nutritionFacts) && servesNumPeople === null
    ? attributes
    : attributesValue;
}

export function omitDefaultExtendedAttributesForHash(value: CanonicalGoogleFoodMenusResource) {
  return {
    ...value,
    menus: value.menus.map((menu) => ({
      ...menu,
      sections: menu.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          return {
            ...item,
            attributes: omitDefaultExtendedAttributeFields(item.attributes),
            options: item.options.map((option) => ({
              ...option,
              attributes: omitDefaultExtendedAttributeFields(option.attributes),
            })),
          };
        }),
      })),
    })),
  };
}

export function foodMenusArray(foodMenus: GoogleFoodMenusResource): GoogleFoodMenu[] {
  return Array.isArray(foodMenus.menus) ? foodMenus.menus : [];
}

export function menuSectionsArray(menu: GoogleFoodMenu): GoogleFoodMenuSection[] {
  return Array.isArray(menu.sections) ? menu.sections : [];
}

export function sectionItemsArray(section: GoogleFoodMenuSection): GoogleFoodMenuItem[] {
  return Array.isArray(section.items) ? section.items : [];
}

export function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

export function canonicalizeGoogleFoodMenusResource(
  foodMenus: GoogleFoodMenusResource,
): CanonicalGoogleFoodMenusResource {
  return {
    name: foodMenus.name.trim(),
    menus: foodMenusArray(foodMenus).map((menu) => ({
      labels: canonicalizeLabels(menu.labels),
      sourceUrl: cleanText(menu.sourceUrl),
      cuisines: uniqueSorted(menu.cuisines ?? []),
      sections: menuSectionsArray(menu).map((section) => ({
        labels: canonicalizeLabels(section.labels),
        items: sectionItemsArray(section).map((item) => ({
          labels: canonicalizeLabels(item.labels),
          attributes: canonicalizeAttributes(item.attributes),
          options: (item.options ?? []).map((option) => ({
            labels: canonicalizeLabels(option.labels),
            attributes: canonicalizeAttributes(option.attributes),
          })),
        })),
      })),
    })),
  };
}

export function hashGoogleFoodMenusResource(foodMenus: GoogleFoodMenusResource): string {
  return hashCanonicalJson(
    omitDefaultExtendedAttributesForHash(canonicalizeGoogleFoodMenusResource(foodMenus)),
  )!;
}
