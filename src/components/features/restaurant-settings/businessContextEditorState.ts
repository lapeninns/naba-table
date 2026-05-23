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

export function deriveBusinessContextEditorState(
  snapshot: RestaurantBusinessContextSnapshot,
): BusinessContextEditorState {
  const nextCategories = cloneFamily(
    snapshot.core.categories,
    snapshot.providerSnapshot.categories,
  );
  const nextBusinessDetailsSource = snapshot.core.businessDetails
    ? 'core'
    : snapshot.providerSnapshot.businessDetails
      ? 'provider'
      : 'empty';
  const nextLinks = cloneFamily(
    filterEditableLinks(snapshot.core.links),
    filterEditableLinks(snapshot.providerSnapshot.links),
  );
  const nextServiceAreas = cloneFamily(
    snapshot.core.serviceAreas,
    snapshot.providerSnapshot.serviceAreas,
  );
  const nextAttributes = cloneFamily(
    snapshot.core.attributes,
    snapshot.providerSnapshot.attributes,
  );
  const nextServiceItems = cloneFamily(
    snapshot.core.serviceItems,
    snapshot.providerSnapshot.serviceItems,
  );

  return {
    businessDetails: toBusinessDetailsEditor(
      snapshot.core.businessDetails ?? snapshot.providerSnapshot.businessDetails,
    ),
    links: toLinkEditors(nextLinks.rows),
    categories: toCategoryEditors(nextCategories.rows),
    serviceAreas: toServiceAreaEditors(nextServiceAreas.rows),
    serviceAreaDraft: '',
    attributes: toAttributeEditors(nextAttributes.rows),
    serviceItems: toServiceItemEditors(nextServiceItems.rows),
    seedSource: {
      businessDetails: nextBusinessDetailsSource,
      links: nextLinks.source,
      categories: nextCategories.source,
      serviceAreas: nextServiceAreas.source,
      attributes: nextAttributes.source,
      serviceItems: nextServiceItems.source,
    },
  };
}

export function deriveBusinessContextFamilyState(
  snapshot: RestaurantBusinessContextSnapshot,
  family: FamilyKey,
): Partial<BusinessContextEditorState> {
  if (family === 'businessDetails') {
    const source = snapshot.core.businessDetails
      ? 'core'
      : snapshot.providerSnapshot.businessDetails
        ? 'provider'
        : 'empty';

    return {
      businessDetails: toBusinessDetailsEditor(
        snapshot.core.businessDetails ?? snapshot.providerSnapshot.businessDetails,
      ),
      seedSource: seedSourceForFamily(family, source),
    };
  }

  if (family === 'links') {
    const next = cloneFamily(
      filterEditableLinks(snapshot.core.links),
      filterEditableLinks(snapshot.providerSnapshot.links),
    );

    return {
      links: toLinkEditors(next.rows),
      seedSource: seedSourceForFamily(family, next.source),
    };
  }

  if (family === 'categories') {
    const next = cloneFamily(snapshot.core.categories, snapshot.providerSnapshot.categories);

    return {
      categories: toCategoryEditors(next.rows),
      seedSource: seedSourceForFamily(family, next.source),
    };
  }

  if (family === 'serviceAreas') {
    const next = cloneFamily(snapshot.core.serviceAreas, snapshot.providerSnapshot.serviceAreas);

    return {
      serviceAreas: toServiceAreaEditors(next.rows),
      serviceAreaDraft: '',
      seedSource: seedSourceForFamily(family, next.source),
    };
  }

  if (family === 'attributes') {
    const next = cloneFamily(snapshot.core.attributes, snapshot.providerSnapshot.attributes);

    return {
      attributes: toAttributeEditors(next.rows),
      seedSource: seedSourceForFamily(family, next.source),
    };
  }

  const next = cloneFamily(snapshot.core.serviceItems, snapshot.providerSnapshot.serviceItems);

  return {
    serviceItems: toServiceItemEditors(next.rows),
    seedSource: seedSourceForFamily(family, next.source),
  };
}
