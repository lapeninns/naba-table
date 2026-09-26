import {
  LANGUAGE_CODE,
  buildLabelList,
  primaryDescription,
  primaryLabel,
  serializeAdditionalLabels,
} from './menuHierarchySharedDomain';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuSection,
  MenuKind,
  RestaurantMenuInput,
  RestaurantMenuSectionInput,
} from '@/server/menu-hierarchy/types';

export {
  ALLERGEN_OPTIONS,
  CUISINE_OPTIONS,
  DIETARY_OPTIONS,
  LANGUAGE_CODE,
  NONE_VALUE,
  NUTRITION_UNITS,
  PREPARATION_OPTIONS,
  SPICINESS_OPTIONS,
  looksLikeLocalMediaUrl,
  primaryDescription,
  primaryLabel,
  splitTokens,
  toggleValue,
} from './menuHierarchySharedDomain';
export {
  buildItemPayload,
  buildOptionPayload,
  itemInitialState,
  moneyLabel,
  optionInitialState,
} from './menuHierarchyItemDomain';
export type { ItemFormState, OptionFormState } from './menuHierarchyItemDomain';

export type MenuFormState = {
  displayName: string;
  description: string;
  additionalLabels: string;
  menuKind: MenuKind;
  defaultLanguageCode: string;
  sourceUrl: string;
  cuisines: string[];
  active: boolean;
};

export type SectionFormState = {
  displayName: string;
  description: string;
  languageCode: string;
  additionalLabels: string;
  legacyCategory: string;
  legacySubcategory: string;
  active: boolean;
};

export function menuInitialState(
  menu?: CanonicalRestaurantMenu | null,
  defaultMenuKind: MenuKind = 'food',
): MenuFormState {
  return {
    displayName: menu ? primaryLabel(menu, 'Menu') : '',
    description: menu ? primaryDescription(menu) : '',
    additionalLabels: menu ? serializeAdditionalLabels(menu.labels) : '',
    menuKind: menu?.menuKind ?? defaultMenuKind,
    defaultLanguageCode: menu?.defaultLanguageCode ?? LANGUAGE_CODE,
    sourceUrl: menu?.sourceUrl ?? '',
    cuisines: menu?.cuisines ?? [],
    active: menu?.active ?? true,
  };
}

export function sectionInitialState(
  section?: CanonicalRestaurantMenuSection | null,
): SectionFormState {
  return {
    displayName: section ? primaryLabel(section, 'Section') : '',
    description: section ? primaryDescription(section) : '',
    languageCode: section?.labels[0]?.languageCode ?? LANGUAGE_CODE,
    additionalLabels: section ? serializeAdditionalLabels(section.labels) : '',
    legacyCategory: section?.legacyCategory ?? '',
    legacySubcategory: section?.legacySubcategory ?? '',
    active: section?.active ?? true,
  };
}

export function buildMenuPayload(state: MenuFormState): RestaurantMenuInput {
  return {
    labels: buildLabelList({
      displayName: state.displayName,
      description: state.description,
      languageCode: state.defaultLanguageCode,
      additionalLabels: state.additionalLabels,
    }),
    sourceUrl: state.sourceUrl.trim() || null,
    cuisines: state.cuisines as RestaurantMenuInput['cuisines'],
    defaultLanguageCode: state.defaultLanguageCode.trim() || LANGUAGE_CODE,
    menuKind: state.menuKind,
    displayOrder: 0,
    active: state.active,
    legacySource: { editedFrom: 'ops-menu-hierarchy-ui' },
  };
}

export function buildSectionPayload(
  state: SectionFormState,
  displayOrder: number,
): RestaurantMenuSectionInput {
  return {
    labels: buildLabelList({
      displayName: state.displayName,
      description: state.description,
      languageCode: state.languageCode,
      additionalLabels: state.additionalLabels,
    }),
    displayOrder,
    active: state.active,
    legacyCategory: state.legacyCategory.trim() || state.displayName.trim(),
    legacySubcategory: state.legacySubcategory.trim() || null,
    legacySource: { editedFrom: 'ops-menu-hierarchy-ui' },
  };
}
