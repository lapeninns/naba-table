import { useCallback, useMemo, useReducer } from 'react';

import {
  businessContextDraftReducer,
  computeBusinessContextDirtyState,
  deriveSavedBusinessContextDrafts,
  INITIAL_BUSINESS_CONTEXT_DRAFT_STATE,
  type BusinessContextDrafts,
} from './businessContextDraftState';
import { DISCOVERY_SECTION_ORDER, type FamilyKey } from './businessContextModel';
import { useBusinessContextAttributeDraft } from './useBusinessContextAttributeDraft';
import { useBusinessContextBusinessDetailsDraft } from './useBusinessContextBusinessDetailsDraft';
import { useBusinessContextCategoryDraft } from './useBusinessContextCategoryDraft';
import { useBusinessContextLinkDraft } from './useBusinessContextLinkDraft';
import { useBusinessContextServiceAreaDraft } from './useBusinessContextServiceAreaDraft';
import { useBusinessContextServiceItemDraft } from './useBusinessContextServiceItemDraft';

import type { BusinessContextFamilyUpdate } from './useBusinessContextLinkDraft';
import type { RestaurantBusinessContextSnapshot } from '@/services/ops/restaurants';

type UseBusinessContextEditorDraftStateOptions = {
  restaurantId: string | null;
  snapshot: RestaurantBusinessContextSnapshot | null | undefined;
};

/**
 * The single page draft for Discovery details. Dirty state is derived by comparing each section
 * with the saved values, so a section pre-filled from Google counts as unsaved until it is saved,
 * and undoing an edit by hand makes the section clean again.
 */
export function useBusinessContextEditorDraftState({
  restaurantId,
  snapshot,
}: UseBusinessContextEditorDraftStateOptions) {
  const [state, dispatch] = useReducer(
    businessContextDraftReducer,
    INITIAL_BUSINESS_CONTEXT_DRAFT_STATE,
  );
  const restaurantKey = restaurantId ?? '';

  // Apply each new server snapshot during render (not in an effect) so the editor never paints
  // an empty draft first.
  if (snapshot && (snapshot !== state.seenSnapshot || restaurantKey !== state.restaurantKey)) {
    dispatch({ type: 'snapshotReceived', restaurantKey, snapshot });
  }

  const updateFamily = useCallback(
    <Family extends FamilyKey>(
      family: Family,
      updater: (current: BusinessContextDrafts[Family]) => BusinessContextDrafts[Family],
    ) =>
      dispatch({
        type: 'edit',
        apply: (drafts) => ({ ...drafts, [family]: updater(drafts[family]) }),
      }),
    [],
  );
  const updateBusinessDetailsFamily = useCallback<
    BusinessContextFamilyUpdate<BusinessContextDrafts['businessDetails']>
  >((updater) => updateFamily('businessDetails', updater), [updateFamily]);
  const updateLinks = useCallback<BusinessContextFamilyUpdate<BusinessContextDrafts['links']>>(
    (updater) => updateFamily('links', updater),
    [updateFamily],
  );
  const updateCategories = useCallback<
    BusinessContextFamilyUpdate<BusinessContextDrafts['categories']>
  >((updater) => updateFamily('categories', updater), [updateFamily]);
  const updateServiceAreas = useCallback<
    BusinessContextFamilyUpdate<BusinessContextDrafts['serviceAreas']>
  >((updater) => updateFamily('serviceAreas', updater), [updateFamily]);
  const updateAttributes = useCallback<
    BusinessContextFamilyUpdate<BusinessContextDrafts['attributes']>
  >((updater) => updateFamily('attributes', updater), [updateFamily]);
  const updateServiceItems = useCallback<
    BusinessContextFamilyUpdate<BusinessContextDrafts['serviceItems']>
  >((updater) => updateFamily('serviceItems', updater), [updateFamily]);

  const businessDetailsActions = useBusinessContextBusinessDetailsDraft(
    updateBusinessDetailsFamily,
  );
  const linkActions = useBusinessContextLinkDraft(updateLinks);
  const categoryActions = useBusinessContextCategoryDraft(updateCategories);
  const serviceAreaActions = useBusinessContextServiceAreaDraft(updateServiceAreas);
  const attributeActions = useBusinessContextAttributeDraft(updateAttributes);
  const serviceItemActions = useBusinessContextServiceItemDraft(updateServiceItems);

  const savedDrafts = useMemo(
    () => deriveSavedBusinessContextDrafts(state.baseline),
    [state.baseline],
  );
  const dirty = useMemo(
    () => computeBusinessContextDirtyState(state.drafts, savedDrafts),
    [savedDrafts, state.drafts],
  );
  const dirtyFamilies = useMemo(
    () => DISCOVERY_SECTION_ORDER.filter((family) => dirty[family]),
    [dirty],
  );

  const resetFamilies = useCallback(
    (families: readonly FamilyKey[]) => dispatch({ type: 'resetFamilies', families }),
    [],
  );
  const applySavedSnapshot = useCallback(
    (
      families: readonly FamilyKey[],
      saved: RestaurantBusinessContextSnapshot,
      sent: BusinessContextDrafts,
    ) => dispatch({ type: 'saved', families, snapshot: saved, sent }),
    [],
  );

  return {
    ...state.drafts,
    drafts: state.drafts,
    savedDrafts,
    baseline: state.baseline,
    seedSource: state.seedSource,
    dirty,
    dirtyFamilies,
    isDirty: dirtyFamilies.length > 0,
    ...businessDetailsActions,
    ...linkActions,
    ...categoryActions,
    ...serviceAreaActions,
    ...attributeActions,
    ...serviceItemActions,
    resetFamilies,
    applySavedSnapshot,
  };
}
