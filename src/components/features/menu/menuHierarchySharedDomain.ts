import {
  GOOGLE_FOOD_MENU_ALLERGENS,
  GOOGLE_FOOD_MENU_CUISINE_OPTIONS,
  GOOGLE_FOOD_MENU_DIETARY_RESTRICTIONS,
  GOOGLE_FOOD_MENU_PREPARATION_METHODS,
  GOOGLE_FOOD_MENU_SPICINESS,
  GOOGLE_NUTRITION_UNITS,
  type GoogleNutritionUnit,
} from '@/lib/google-food-menu-labels';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';

export const LANGUAGE_CODE = 'en-GB';
export const NONE_VALUE = '__none__';

export const CUISINE_OPTIONS = GOOGLE_FOOD_MENU_CUISINE_OPTIONS;
export const ALLERGEN_OPTIONS = GOOGLE_FOOD_MENU_ALLERGENS;
export const DIETARY_OPTIONS = GOOGLE_FOOD_MENU_DIETARY_RESTRICTIONS;
export const SPICINESS_OPTIONS = GOOGLE_FOOD_MENU_SPICINESS;
export const PREPARATION_OPTIONS = GOOGLE_FOOD_MENU_PREPARATION_METHODS;
export const NUTRITION_UNITS = {
  calorie: GOOGLE_NUTRITION_UNITS[0],
  gram: GOOGLE_NUTRITION_UNITS[1],
  milligram: GOOGLE_NUTRITION_UNITS[2],
} as const satisfies Record<string, GoogleNutritionUnit>;

export function primaryLabel(
  entity:
    | Pick<CanonicalRestaurantMenu, 'labels'>
    | Pick<CanonicalRestaurantMenuSection, 'labels'>
    | Pick<CanonicalRestaurantMenuItem, 'labels'>
    | Pick<CanonicalRestaurantMenuOption, 'labels'>,
  fallback: string,
) {
  return entity.labels[0]?.displayName?.trim() || fallback;
}

export function primaryDescription(
  entity:
    | Pick<CanonicalRestaurantMenu, 'labels'>
    | Pick<CanonicalRestaurantMenuSection, 'labels'>
    | Pick<CanonicalRestaurantMenuItem, 'labels'>
    | Pick<CanonicalRestaurantMenuOption, 'labels'>,
) {
  return entity.labels[0]?.description ?? '';
}

export function splitTokens(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function serializeAdditionalLabels(
  labels: Array<{ displayName: string; description?: string | null; languageCode: string }>,
) {
  return labels
    .slice(1)
    .map((label) =>
      [label.languageCode, label.displayName, label.description ?? '']
        .map((part) => part.trim())
        .join(' | '),
    )
    .join('\n');
}

export function parseAdditionalLabels(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [languageCode = LANGUAGE_CODE, displayName = '', description = ''] = line
        .split('|')
        .map((part) => part.trim());
      return displayName
        ? {
            displayName,
            description: description || null,
            languageCode: languageCode || LANGUAGE_CODE,
          }
        : null;
    })
    .filter(
      (label): label is { displayName: string; description: string | null; languageCode: string } =>
        Boolean(label),
    );
}

export function buildLabelList({
  displayName,
  description,
  languageCode,
  additionalLabels,
}: {
  displayName: string;
  description: string;
  languageCode: string;
  additionalLabels: string;
}) {
  return [
    {
      displayName: displayName.trim(),
      description: description.trim() || null,
      languageCode: languageCode.trim() || LANGUAGE_CODE,
    },
    ...parseAdditionalLabels(additionalLabels),
  ];
}

export function looksLikeLocalMediaUrl(value: string) {
  return /^(https?:|data:|blob:|\/)/i.test(value.trim());
}

export function toggleValue(values: string[], value: string, checked: boolean) {
  if (checked) return values.includes(value) ? values : [...values, value];
  return values.filter((entry) => entry !== value);
}
