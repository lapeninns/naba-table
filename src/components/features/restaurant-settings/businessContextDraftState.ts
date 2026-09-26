import {
  deriveBusinessContextEditorState,
  deriveBusinessContextFamilyState,
} from './businessContextEditorState';
import {
  DISCOVERY_SECTION_ORDER,
  EMPTY_BUSINESS_DETAILS,
  EMPTY_SEED_SOURCE,
  type BusinessContextFamilyPayloadState,
  type BusinessDetailsEditor,
  type DirtyState,
  type FamilyKey,
  type SeedSource,
} from './businessContextModel';

import type { RestaurantBusinessContextSnapshot } from '@/services/ops/restaurants';

/** The editable value of every discovery section. */
export type BusinessContextDrafts = BusinessContextFamilyPayloadState;

/** The revision a draft based on `snapshot` must send with its save, if the server has one. */
export function getBusinessContextRevision(
  snapshot: RestaurantBusinessContextSnapshot | null | undefined,
): number | undefined {
  const revision = snapshot?.revision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0
    ? revision
    : undefined;
}

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
  /**
   * The last rebase in which staff edits collided with a newer saved value (both sides changed
   * the same row or field). The saved value was kept; the editor tells staff once per object.
   */
  rebaseConflict: BusinessContextRebaseConflict | null;
};

export type BusinessContextRebaseConflict = {
  readonly families: readonly FamilyKey[];
  readonly seq: number;
};

export type BusinessContextDraftAction =
  | {
      type: 'snapshotReceived';
      restaurantKey: string;
      snapshot: RestaurantBusinessContextSnapshot;
    }
  | {
      type: 'familySaved';
      family: FamilyKey;
      snapshot: RestaurantBusinessContextSnapshot;
      /** The drafts the save request was built from. */
      sent: BusinessContextDrafts;
    }
  | {
      /** One page save wrote `families` in a single request and returned `snapshot`. */
      type: 'saved';
      families: readonly FamilyKey[];
      snapshot: RestaurantBusinessContextSnapshot;
      /** The drafts the save request was built from. */
      sent: BusinessContextDrafts;
    }
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
  rebaseConflict: null,
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

function serialiseFamily(family: FamilyKey, drafts: BusinessContextDrafts): string {
  return JSON.stringify(comparableFamilyValue(family, drafts));
}

/**
 * Saved-value serialisations per saved drafts object. The editor derives that object once per
 * baseline snapshot, so each saved section is serialised once rather than on every keystroke.
 */
const savedFamilySerialisations = new WeakMap<
  BusinessContextDrafts,
  Partial<Record<FamilyKey, string>>
>();

function serialiseSavedFamily(family: FamilyKey, saved: BusinessContextDrafts): string {
  let cache = savedFamilySerialisations.get(saved);
  if (!cache) {
    cache = {};
    savedFamilySerialisations.set(saved, cache);
  }
  const cached = cache[family];
  if (cached !== undefined) {
    return cached;
  }
  const serialised = serialiseFamily(family, saved);
  cache[family] = serialised;
  return serialised;
}

export function isBusinessContextFamilyEqual(
  family: FamilyKey,
  left: BusinessContextDrafts,
  right: BusinessContextDrafts,
): boolean {
  return (
    left[family] === right[family] ||
    serialiseFamily(family, left) === serialiseFamily(family, right)
  );
}

export function computeBusinessContextDirtyState(
  drafts: BusinessContextDrafts,
  saved: BusinessContextDrafts,
): DirtyState {
  return Object.fromEntries(
    DISCOVERY_SECTION_ORDER.map((family) => [
      family,
      drafts[family] !== saved[family] &&
        serialiseFamily(family, drafts) !== serialiseSavedFamily(family, saved),
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
 * Keeps what staff typed in a just-saved section while its request was in flight. Business
 * details merge field by field: a field still holding the value that was sent takes the server's
 * value. A list section is replaced as a whole on save, so any change to it keeps the whole draft.
 */
function keepEditsSinceSend(
  next: Pick<BusinessContextDraftState, 'drafts' | 'seedSource'>,
  current: BusinessContextDrafts,
  sent: BusinessContextDrafts,
  family: FamilyKey,
): Pick<BusinessContextDraftState, 'drafts' | 'seedSource'> {
  if (isBusinessContextFamilyEqual(family, current, sent)) {
    return next;
  }
  if (family !== 'businessDetails') {
    return { ...next, drafts: { ...next.drafts, [family]: current[family] } };
  }
  const server = next.drafts.businessDetails;
  const pick = <Field extends keyof BusinessDetailsEditor>(field: Field) =>
    current.businessDetails[field] !== sent.businessDetails[field]
      ? current.businessDetails[field]
      : server[field];
  const businessDetails: BusinessDetailsEditor = {
    openingDate: pick('openingDate'),
    businessStatus: pick('businessStatus'),
    isServiceAreaBusiness: pick('isServiceAreaBusiness'),
  };
  return { ...next, drafts: { ...next.drafts, businessDetails } };
}

type DraftRow = { id: string };

const comparableCategory = ({
  moreHoursTypeDraft: _draft,
  ...row
}: BusinessContextDrafts['categories'][number]) => row;

function comparableRow(family: FamilyKey, row: DraftRow): unknown {
  // The more-hours text box is typing in progress, not a saved value.
  return family === 'categories'
    ? comparableCategory(row as BusinessContextDrafts['categories'][number])
    : row;
}

/**
 * Three-way merge of one list section by row id: `base` is what the draft started from, `mine`
 * the draft, `theirs` the newer server rows. Rows staff added or edited stay as typed; rows they
 * did not touch take the server version (or go, if the server removed them); rows the server
 * added are appended. Rows staff deleted stay deleted.
 *
 * When both sides changed the same row differently (edited on both, edited here but deleted on
 * the server, or deleted here but edited on the server) the server version wins and the merge
 * reports a conflict: a newer committed value is never silently overwritten by the next save.
 */
function rebaseRows<Row extends DraftRow>(
  family: FamilyKey,
  base: readonly Row[],
  mine: readonly Row[],
  theirs: readonly Row[],
): { rows: Row[]; conflict: boolean } {
  const baseById = new Map(base.map((row) => [row.id, row]));
  const theirsById = new Map(theirs.map((row) => [row.id, row]));
  const mineIds = new Set(mine.map((row) => row.id));
  const same = (left: Row, right: Row) =>
    JSON.stringify(comparableRow(family, left)) === JSON.stringify(comparableRow(family, right));

  let conflict = false;
  const rows: Row[] = [];
  for (const row of mine) {
    const baseRow = baseById.get(row.id);
    const theirRow = theirsById.get(row.id);
    if (!baseRow) {
      rows.push(row);
      continue;
    }
    if (same(row, baseRow)) {
      if (theirRow) rows.push(theirRow);
      continue;
    }
    if (!theirRow) {
      // Edited here, deleted on the server.
      conflict = true;
      continue;
    }
    if (same(theirRow, baseRow) || same(theirRow, row)) {
      rows.push(row);
      continue;
    }
    conflict = true;
    rows.push(theirRow);
  }
  for (const baseRow of base) {
    if (mineIds.has(baseRow.id)) continue;
    const theirRow = theirsById.get(baseRow.id);
    if (theirRow && !same(theirRow, baseRow)) {
      // Deleted here, edited on the server.
      conflict = true;
      rows.push(theirRow);
    }
  }
  for (const row of theirs) {
    if (!baseById.has(row.id) && !mineIds.has(row.id)) {
      rows.push(row);
    }
  }
  return { rows, conflict };
}

type RebaseResult = Pick<BusinessContextDraftState, 'drafts' | 'seedSource'> & {
  conflict: boolean;
};

/**
 * Rebases an unsaved section onto a newer server snapshot (another writer, such as a Google
 * import, saved underneath the draft), so the next page save cannot restore the values that
 * writer replaced. Business details merge field by field; list sections merge by row id. Where
 * both sides changed the same value, the server value wins and a conflict is reported.
 * An unsaved Google pre-fill is dropped once the server holds saved rows for that section.
 */
function rebaseDirtyFamily(
  next: Pick<BusinessContextDraftState, 'drafts' | 'seedSource'>,
  state: BusinessContextDraftState,
  previousSaved: BusinessContextDrafts,
  snapshot: RestaurantBusinessContextSnapshot,
  family: FamilyKey,
): RebaseResult {
  const fromServer = withFamilyFromSnapshot(next, snapshot, family);
  const theirs = fromServer.drafts;
  if (isBusinessContextFamilyEqual(family, theirs, previousSaved)) {
    // The server did not change this section: nothing to rebase.
    return { ...next, conflict: false };
  }
  if (state.seedSource[family] === 'provider' && fromServer.seedSource[family] === 'core') {
    return { ...fromServer, conflict: false };
  }

  const mine = state.drafts;
  if (family === 'businessDetails') {
    let conflict = false;
    const pick = <Field extends keyof BusinessDetailsEditor>(field: Field) => {
      const base = previousSaved.businessDetails[field];
      const mineValue = mine.businessDetails[field];
      const theirValue = theirs.businessDetails[field];
      if (mineValue === base) return theirValue;
      if (theirValue === base || theirValue === mineValue) return mineValue;
      conflict = true;
      return theirValue;
    };
    const businessDetails: BusinessDetailsEditor = {
      openingDate: pick('openingDate'),
      businessStatus: pick('businessStatus'),
      isServiceAreaBusiness: pick('isServiceAreaBusiness'),
    };
    return { ...next, drafts: { ...next.drafts, businessDetails }, conflict };
  }

  const { rows, conflict } = rebaseRows<DraftRow>(
    family,
    previousSaved[family],
    mine[family],
    theirs[family],
  );
  return { ...next, drafts: { ...next.drafts, [family]: rows }, conflict };
}

/**
 * Applies a newer server snapshot without losing work. Sections that were clean (draft equal to
 * the previous saved values) and the sections just saved take the new saved values; edits made
 * to a saved section after its request was sent stay as the newer, unsaved draft. Every other
 * unsaved section is rebased onto the new snapshot (see {@link rebaseDirtyFamily}).
 */
function reseedFromSnapshot(
  state: BusinessContextDraftState,
  snapshot: RestaurantBusinessContextSnapshot,
  saved: { families: readonly FamilyKey[]; sent: BusinessContextDrafts } | null,
): BusinessContextDraftState {
  const previousSaved = deriveSavedBusinessContextDrafts(state.baseline);
  let next: Pick<BusinessContextDraftState, 'drafts' | 'seedSource'> = {
    drafts: state.drafts,
    seedSource: state.seedSource,
  };
  const conflicted: FamilyKey[] = [];
  for (const family of DISCOVERY_SECTION_ORDER) {
    if (saved?.families.includes(family)) {
      next = keepEditsSinceSend(
        withFamilyFromSnapshot(next, snapshot, family),
        state.drafts,
        saved.sent,
        family,
      );
    } else if (isBusinessContextFamilyEqual(family, state.drafts, previousSaved)) {
      next = withFamilyFromSnapshot(next, snapshot, family);
    } else {
      const { conflict, ...rebased } = rebaseDirtyFamily(
        next,
        state,
        previousSaved,
        snapshot,
        family,
      );
      next = rebased;
      if (conflict) conflicted.push(family);
    }
  }
  const rebaseConflict =
    conflicted.length > 0
      ? { families: conflicted, seq: (state.rebaseConflict?.seq ?? 0) + 1 }
      : saved
        ? null
        : state.rebaseConflict;
  return { ...state, ...next, baseline: snapshot, rebaseConflict };
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
          rebaseConflict: null,
        };
      }
      if (state.seenSnapshot === action.snapshot) {
        return state;
      }
      return {
        ...reseedFromSnapshot(state, action.snapshot, null),
        seenSnapshot: action.snapshot,
      };
    }
    case 'familySaved':
      return reseedFromSnapshot(state, action.snapshot, {
        families: [action.family],
        sent: action.sent,
      });
    case 'saved':
      return reseedFromSnapshot(state, action.snapshot, {
        families: action.families,
        sent: action.sent,
      });
    case 'resetFamilies': {
      const baseline = state.baseline;
      if (!baseline) {
        return state;
      }
      let next: Pick<BusinessContextDraftState, 'drafts' | 'seedSource'> = state;
      for (const family of action.families) {
        next = withFamilyFromSnapshot(next, baseline, family);
      }
      return {
        ...state,
        drafts: next.drafts,
        seedSource: next.seedSource,
        rebaseConflict: action.families.length > 0 ? null : state.rebaseConflict,
      };
    }
    case 'edit':
      return { ...state, drafts: action.apply(state.drafts) };
  }
}
