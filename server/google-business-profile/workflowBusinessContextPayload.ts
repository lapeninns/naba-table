import type {
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';

export type GoogleBusinessProfileBusinessContextSectionKey =
  | 'businessContext.categories'
  | 'businessContext.serviceAreas'
  | 'businessContext.attributes'
  | 'businessContext.serviceItems';

function cloneProviderRowsForCore<TRow extends { id: string }>(rows: TRow[]) {
  return rows.map(({ id: _providerSnapshotId, ...row }) => row);
}

function cloneProviderCategoriesForCore(
  rows: RestaurantBusinessContextSnapshot['providerSnapshot']['categories'],
) {
  return cloneProviderRowsForCore(rows).map((row) => ({
    ...row,
    isPrimary: false,
  }));
}

export function buildBusinessContextPayloadForSections(
  sectionKeys: readonly string[],
  current: RestaurantBusinessContextSnapshot,
): UpdateRestaurantBusinessContextInput {
  const sections = new Set(sectionKeys);

  return {
    ...(sections.has('businessContext.categories')
      ? { categories: cloneProviderCategoriesForCore(current.providerSnapshot.categories) }
      : {}),
    ...(sections.has('businessContext.serviceAreas')
      ? { serviceAreas: cloneProviderRowsForCore(current.providerSnapshot.serviceAreas) }
      : {}),
    ...(sections.has('businessContext.attributes')
      ? { attributes: cloneProviderRowsForCore(current.providerSnapshot.attributes) }
      : {}),
    ...(sections.has('businessContext.serviceItems')
      ? { serviceItems: cloneProviderRowsForCore(current.providerSnapshot.serviceItems) }
      : {}),
  };
}
