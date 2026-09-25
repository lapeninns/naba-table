import {
  filterEditableLinks,
  toAttributeEditors,
  toBusinessDetailsEditor,
  toCategoryEditors,
  toLinkEditors,
  toServiceAreaEditors,
  toServiceItemEditors,
} from './businessContextEditorTransforms';

import type {
  BusinessContextEditorState,
  FamilyCounts,
  FamilyKey,
  SeedSource,
} from './businessContextModel';
import type {
  RestaurantBusinessContextFamily,
  RestaurantBusinessContextSnapshot,
} from '@/services/ops/restaurants';

const EMPTY_SEED_SOURCE: SeedSource = {
  businessDetails: 'empty',
  links: 'empty',
  categories: 'empty',
  serviceAreas: 'empty',
  attributes: 'empty',
  serviceItems: 'empty',
};

export {
  filterEditableLinks,
  isEditableLinkType,
  toAttributeEditors,
  toBusinessDetailsEditor,
  toCategoryEditors,
  toLinkEditors,
  toPrettyJson,
  toServiceAreaEditors,
  toServiceItemEditors,
} from './businessContextEditorTransforms';

const FAMILY_KEYS: FamilyKey[] = [
  'businessDetails',
  'links',
  'categories',
  'serviceAreas',
  'attributes',
  'serviceItems',
];

function seedSourceForFamily(family: FamilyKey, source: SeedSource[FamilyKey]): SeedSource {
  return { ...EMPTY_SEED_SOURCE, [family]: source };
}

export function cloneFamily<T>(
  core: T[],
  provider: T[],
): { rows: T[]; source: SeedSource[FamilyKey] } {
  if (core.length > 0) {
    return { rows: core, source: 'core' };
  }
  if (provider.length > 0) {
    return { rows: provider, source: 'provider' };
  }
  return { rows: [], source: 'empty' };
}

export function deriveFamilyCounts(family: RestaurantBusinessContextFamily | null | undefined) {
  return {
    businessDetails: family?.businessDetails ? 1 : 0,
    links: filterEditableLinks(family?.links).length,
    categories: family?.categories.length ?? 0,
    serviceAreas: family?.serviceAreas.length ?? 0,
    attributes: family?.attributes.length ?? 0,
    serviceItems: family?.serviceItems.length ?? 0,
  } satisfies FamilyCounts;
}

export type BusinessContextSeedOptions = {
  /**
   * Fall back to Google's rows when a family has nothing saved. Only the first seed of a page
   * pre-fills; re-seeding after a save or discard uses saved values only, so a list saved empty
   * (or a discarded pre-fill) is not filled from Google again.
   */
  includeProvider?: boolean;
};

const NO_PROVIDER: RestaurantBusinessContextFamily = {
  businessDetails: null,
  links: [],
  categories: [],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

function providerFamily(
  snapshot: RestaurantBusinessContextSnapshot,
  options: BusinessContextSeedOptions,
): RestaurantBusinessContextFamily {
  return options.includeProvider === false ? NO_PROVIDER : snapshot.providerSnapshot;
}

export function deriveBusinessContextEditorState(
  snapshot: RestaurantBusinessContextSnapshot,
  options: BusinessContextSeedOptions = {},
): BusinessContextEditorState {
  const state: Partial<BusinessContextEditorState> = {};
  const seedSource = { ...EMPTY_SEED_SOURCE };
  for (const family of FAMILY_KEYS) {
    const { seedSource: familySeed, ...rows } = deriveBusinessContextFamilyState(
      snapshot,
      family,
      options,
    );
    Object.assign(state, rows);
    seedSource[family] = familySeed?.[family] ?? 'empty';
  }
  return { ...state, seedSource } as BusinessContextEditorState;
}

export function deriveBusinessContextFamilyState(
  snapshot: RestaurantBusinessContextSnapshot,
  family: FamilyKey,
  options: BusinessContextSeedOptions = {},
): Partial<BusinessContextEditorState> {
  const provider = providerFamily(snapshot, options);

  if (family === 'businessDetails') {
    const source = snapshot.core.businessDetails
      ? 'core'
      : provider.businessDetails
        ? 'provider'
        : 'empty';

    return {
      businessDetails: toBusinessDetailsEditor(
        snapshot.core.businessDetails ?? provider.businessDetails,
      ),
      seedSource: seedSourceForFamily(family, source),
    };
  }

  if (family === 'links') {
    const next = cloneFamily(
      filterEditableLinks(snapshot.core.links),
      filterEditableLinks(provider.links),
    );

    return {
      links: toLinkEditors(next.rows),
      seedSource: seedSourceForFamily(family, next.source),
    };
  }

  if (family === 'categories') {
    const next = cloneFamily(snapshot.core.categories, provider.categories);

    return {
      categories: toCategoryEditors(next.rows),
      seedSource: seedSourceForFamily(family, next.source),
    };
  }

  if (family === 'serviceAreas') {
    const next = cloneFamily(snapshot.core.serviceAreas, provider.serviceAreas);

    return {
      serviceAreas: toServiceAreaEditors(next.rows),
      seedSource: seedSourceForFamily(family, next.source),
    };
  }

  if (family === 'attributes') {
    const next = cloneFamily(snapshot.core.attributes, provider.attributes);

    return {
      attributes: toAttributeEditors(next.rows),
      seedSource: seedSourceForFamily(family, next.source),
    };
  }

  const next = cloneFamily(snapshot.core.serviceItems, provider.serviceItems);

  return {
    serviceItems: toServiceItemEditors(next.rows),
    seedSource: seedSourceForFamily(family, next.source),
  };
}
