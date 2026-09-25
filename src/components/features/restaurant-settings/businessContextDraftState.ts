import {
  deriveBusinessContextEditorState,
  deriveBusinessContextFamilyState,
} from './businessContextEditorState';
import {
  DISCOVERY_SECTION_ORDER,
  EMPTY_BUSINESS_DETAILS,
  EMPTY_SEED_SOURCE,
  type BusinessContextFamilyPayloadState,
  type DirtyState,
  type FamilyKey,
  type SeedSource,
} from './businessContextModel';

import type { RestaurantBusinessContextSnapshot } from '@/services/ops/restaurants';

/** The editable value of every discovery section. */
export type BusinessContextDrafts = BusinessContextFamilyPayloadState;

/**
 * Page draft for Discovery details. `baseline` is the latest server snapshot; a section is
 * unsaved when its draft differs from the saved values in that snapshot.
 */
export type BusinessContextDraftState = {
  restaurantKey: string | null;
  /** The snapshot object last received from the query, so each one is applied once. */
  seenSnapshot: RestaurantBusinessContextSnapshot | null;
  baseline: RestaurantBusinessContextSnapshot | null;
  drafts: BusinessContextDrafts;
  seedSource: SeedSource;
};

export type BusinessContextDraftAction =
  | {
      type: 'snapshotReceived';
      restaurantKey: string;
      snapshot: RestaurantBusinessContextSnapshot;
    }
  | { type: 'familySaved'; family: FamilyKey; snapshot: RestaurantBusinessContextSnapshot }
  | { type: 'resetFamilies'; families: readonly FamilyKey[] }
  | { type: 'edit'; apply: (drafts: BusinessContextDrafts) => BusinessContextDrafts };

export const EMPTY_BUSINESS_CONTEXT_DRAFTS: BusinessContextDrafts = {
  businessDetails: EMPTY_BUSINESS_DETAILS,
  links: [],
  categories: [],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

export const INITIAL_BUSINESS_CONTEXT_DRAFT_STATE: BusinessContextDraftState = {
  restaurantKey: null,
  seenSnapshot: null,
  baseline: null,
  drafts: EMPTY_BUSINESS_CONTEXT_DRAFTS,
  seedSource: EMPTY_SEED_SOURCE,
};

/** Saved values only (never Google's), as the editor shows them. */
export function deriveSavedBusinessContextDrafts(
  snapshot: RestaurantBusinessContextSnapshot | null,
): BusinessContextDrafts {
  if (!snapshot) {
    return EMPTY_BUSINESS_CONTEXT_DRAFTS;
  }
  const state = deriveBusinessContextEditorState(snapshot, { includeProvider: false });
  return {
    businessDetails: state.businessDetails,
    links: state.links,
    categories: state.categories,
    serviceAreas: state.serviceAreas,
    attributes: state.attributes,
    serviceItems: state.serviceItems,
  };
}

function comparableFamilyValue(family: FamilyKey, drafts: BusinessContextDrafts): unknown {
  if (family === 'categories') {
    // The more-hours text box is typing in progress, not a saved value.
    return drafts.categories.map(({ moreHoursTypeDraft: _draft, ...row }) => row);
  }
  return drafts[family];
}

export function isBusinessContextFamilyEqual(
  family: FamilyKey,
  left: BusinessContextDrafts,
  right: BusinessContextDrafts,
): boolean {
  return (
    JSON.stringify(comparableFamilyValue(family, left)) ===
    JSON.stringify(comparableFamilyValue(family, right))
  );
}

export function computeBusinessContextDirtyState(
  drafts: BusinessContextDrafts,
  saved: BusinessContextDrafts,
): DirtyState {
  return Object.fromEntries(
    DISCOVERY_SECTION_ORDER.map((family) => [
      family,
      !isBusinessContextFamilyEqual(family, drafts, saved),
    ]),
  ) as DirtyState;
}

function withFamilyFromSnapshot(
  state: Pick<BusinessContextDraftState, 'drafts' | 'seedSource'>,
  snapshot: RestaurantBusinessContextSnapshot,
  family: FamilyKey,
): Pick<BusinessContextDraftState, 'drafts' | 'seedSource'> {
  const { seedSource, ...rows } = deriveBusinessContextFamilyState(snapshot, family, {
    includeProvider: false,
  });
  return {
    drafts: { ...state.drafts, ...rows },
    seedSource: { ...state.seedSource, [family]: seedSource?.[family] ?? 'empty' },
  };
}

/**
 * Applies a newer server snapshot without losing work: sections that were clean (draft equal to
 * the previous saved values) and the `forced` sections take the new saved values; every other
 * section keeps its unsaved draft. This is what lets a page save send several sections one after
 * another, each returning a fresh snapshot, without wiping the sections still waiting.
 */
function reseedFromSnapshot(
  state: BusinessContextDraftState,
  snapshot: RestaurantBusinessContextSnapshot,
  forced: ReadonlySet<FamilyKey>,
): BusinessContextDraftState {
  const previousSaved = deriveSavedBusinessContextDrafts(state.baseline);
  let next: Pick<BusinessContextDraftState, 'drafts' | 'seedSource'> = {
    drafts: state.drafts,
    seedSource: state.seedSource,
  };
  for (const family of DISCOVERY_SECTION_ORDER) {
    const clean = isBusinessContextFamilyEqual(family, state.drafts, previousSaved);
    if (forced.has(family) || clean) {
      next = withFamilyFromSnapshot(next, snapshot, family);
    }
  }
  return { ...state, ...next, baseline: snapshot };
}

export function businessContextDraftReducer(
  state: BusinessContextDraftState,
  action: BusinessContextDraftAction,
): BusinessContextDraftState {
  switch (action.type) {
    case 'snapshotReceived': {
      if (state.baseline === null || state.restaurantKey !== action.restaurantKey) {
        // First load for this restaurant: empty sections are pre-filled from Google and so
        // start out unsaved.
        const { seedSource, ...drafts } = deriveBusinessContextEditorState(action.snapshot);
        return {
          restaurantKey: action.restaurantKey,
          seenSnapshot: action.snapshot,
          baseline: action.snapshot,
          drafts,
          seedSource,
        };
      }
      if (state.seenSnapshot === action.snapshot) {
        return state;
      }
      return {
        ...reseedFromSnapshot(state, action.snapshot, new Set()),
        seenSnapshot: action.snapshot,
      };
    }
    case 'familySaved':
      return reseedFromSnapshot(state, action.snapshot, new Set([action.family]));
    case 'resetFamilies': {
      const baseline = state.baseline;
      if (!baseline) {
        return state;
      }
      let next: Pick<BusinessContextDraftState, 'drafts' | 'seedSource'> = state;
      for (const family of action.families) {
        next = withFamilyFromSnapshot(next, baseline, family);
      }
      return { ...state, drafts: next.drafts, seedSource: next.seedSource };
    }
    case 'edit':
      return { ...state, drafts: action.apply(state.drafts) };
  }
}
