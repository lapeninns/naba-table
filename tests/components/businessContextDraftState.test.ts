import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  businessContextDraftReducer,
  computeBusinessContextDirtyState,
  deriveSavedBusinessContextDrafts,
  INITIAL_BUSINESS_CONTEXT_DRAFT_STATE,
  type BusinessContextDrafts,
  type BusinessContextDraftState,
} from '@/components/features/restaurant-settings/businessContextDraftState';
import {
  DISCOVERY_SECTION_ORDER,
  type DirtyState,
} from '@/components/features/restaurant-settings/businessContextModel';

import type {
  RestaurantBusinessContextFamily,
  RestaurantBusinessContextServiceItem,
  RestaurantBusinessContextSnapshot,
} from '@/services/ops/restaurants';

const EMPTY_FAMILY: RestaurantBusinessContextFamily = {
  businessDetails: null,
  links: [],
  categories: [],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

const WEBSITE_LINK = {
  id: '11111111-1111-4111-8111-111111111111',
  linkType: 'website',
  linkStatus: 'current',
  label: 'Website',
  url: 'https://example.com',
  isPrimary: true,
  source: 'manual',
  managedBy: 'ops',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

const GOOGLE_SERVICE: RestaurantBusinessContextServiceItem = {
  id: 'gbp-service-1',
  itemKey: 'job_type_id:private_dining',
  itemType: 'structured',
  displayName: 'Private dining',
  description: 'Room for up to 20 guests',
  payload: null,
  source: 'gbp',
  managedBy: 'gbp',
  updatedAt: null,
} as RestaurantBusinessContextServiceItem;

function snapshot(
  core: Partial<RestaurantBusinessContextFamily> = {},
  provider: Partial<RestaurantBusinessContextFamily> = {},
): RestaurantBusinessContextSnapshot {
  return {
    core: { ...EMPTY_FAMILY, ...core },
    providerSnapshot: { ...EMPTY_FAMILY, ...provider },
  };
}

function load(snap: RestaurantBusinessContextSnapshot, restaurantKey = 'rest-1') {
  return businessContextDraftReducer(INITIAL_BUSINESS_CONTEXT_DRAFT_STATE, {
    type: 'snapshotReceived',
    restaurantKey,
    snapshot: snap,
  });
}

function dirtyOf(state: BusinessContextDraftState) {
  return computeBusinessContextDirtyState(
    state.drafts,
    deriveSavedBusinessContextDrafts(state.baseline),
  );
}

describe('businessContextDraftReducer', () => {
  it('counts sections pre-filled from Google as unsaved', () => {
    const state = load(snapshot({ links: [WEBSITE_LINK] }, { serviceItems: [GOOGLE_SERVICE] }));

    expect(state.seedSource.serviceItems).toBe('provider');
    expect(state.drafts.serviceItems).toHaveLength(1);
    expect(dirtyOf(state)).toMatchObject({ serviceItems: true, links: false });
  });

  it('keeps other sections’ unsaved drafts while a page save sends sections one by one', () => {
    let state = load(snapshot({ links: [WEBSITE_LINK] }, { serviceItems: [GOOGLE_SERVICE] }));

    // Staff edit two sections; services are also pre-filled from Google.
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        businessDetails: { ...drafts.businessDetails, businessStatus: 'open' },
        links: drafts.links.map((row) => ({ ...row, label: 'Our website' })),
      }),
    });
    expect(dirtyOf(state)).toMatchObject({
      businessDetails: true,
      links: true,
      serviceItems: true,
    });

    // Step 1 saves Business status. The server returns a full snapshot in which the other
    // sections still hold their old saved values.
    const afterStep1 = snapshot(
      {
        links: [WEBSITE_LINK],
        businessDetails: {
          id: 'bd-1',
          openingDate: null,
          businessStatus: 'open',
          isServiceAreaBusiness: false,
          source: 'manual',
          managedBy: 'ops',
          updatedAt: '2026-09-25T10:00:00.000Z',
        },
      },
      { serviceItems: [GOOGLE_SERVICE] },
    );
    state = businessContextDraftReducer(state, {
      type: 'familySaved',
      family: 'businessDetails',
      snapshot: afterStep1,
      sent: state.drafts,
    });
    // The same snapshot then reaches the query cache.
    state = businessContextDraftReducer(state, {
      type: 'snapshotReceived',
      restaurantKey: 'rest-1',
      snapshot: afterStep1,
    });

    expect(state.drafts.links[0]?.label).toBe('Our website');
    expect(state.drafts.serviceItems).toEqual([
      expect.objectContaining({ id: 'gbp-service-1', displayName: 'Private dining' }),
    ]);
    expect(state.seedSource.serviceItems).toBe('provider');
    expect(dirtyOf(state)).toMatchObject({
      businessDetails: false,
      links: true,
      serviceItems: true,
    });
  });

  it('keeps a business detail typed while its section was saving, and discards back to the server value', () => {
    const savedDetails = {
      id: 'bd-1',
      openingDate: null,
      businessStatus: 'open',
      isServiceAreaBusiness: false,
      source: 'manual',
      managedBy: 'ops',
      updatedAt: '2026-05-01T10:00:00.000Z',
    };
    let state = load(snapshot({ businessDetails: savedDetails }));
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        businessDetails: { ...drafts.businessDetails, businessStatus: 'closed_temporarily' },
      }),
    });
    // Save is clicked: this is the payload snapshot.
    const sent = state.drafts;

    // Staff keep typing while the request is in flight.
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        businessDetails: { ...drafts.businessDetails, openingDate: '2019-04-01' },
      }),
    });

    const serverSnapshot = snapshot({
      businessDetails: {
        ...savedDetails,
        businessStatus: 'closed_temporarily',
        updatedAt: '2026-09-25T10:00:00.000Z',
      },
    });
    state = businessContextDraftReducer(state, {
      type: 'familySaved',
      family: 'businessDetails',
      snapshot: serverSnapshot,
      sent,
    });

    expect(state.baseline).toBe(serverSnapshot);
    expect(state.drafts.businessDetails).toEqual({
      openingDate: '2019-04-01',
      businessStatus: 'closed_temporarily',
      isServiceAreaBusiness: false,
    });
    expect(dirtyOf(state).businessDetails).toBe(true);

    state = businessContextDraftReducer(state, {
      type: 'resetFamilies',
      families: ['businessDetails'],
    });
    expect(state.drafts.businessDetails).toEqual({
      openingDate: '',
      businessStatus: 'closed_temporarily',
      isServiceAreaBusiness: false,
    });
    expect(dirtyOf(state).businessDetails).toBe(false);
  });

  it('takes the server value for business details the save sent unchanged', () => {
    const savedDetails = {
      id: 'bd-1',
      openingDate: null,
      businessStatus: 'open',
      isServiceAreaBusiness: false,
      source: 'manual',
      managedBy: 'ops',
      updatedAt: '2026-05-01T10:00:00.000Z',
    };
    let state = load(snapshot({ businessDetails: savedDetails }));
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        businessDetails: { ...drafts.businessDetails, isServiceAreaBusiness: true },
      }),
    });
    const sent = state.drafts;
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        businessDetails: { ...drafts.businessDetails, openingDate: '2019-04-01' },
      }),
    });

    // The server stores a different status than the page last knew (another staff member).
    state = businessContextDraftReducer(state, {
      type: 'familySaved',
      family: 'businessDetails',
      snapshot: snapshot({
        businessDetails: {
          ...savedDetails,
          businessStatus: 'closed_permanently',
          isServiceAreaBusiness: true,
        },
      }),
      sent,
    });

    expect(state.drafts.businessDetails).toEqual({
      openingDate: '2019-04-01',
      businessStatus: 'closed_permanently',
      isServiceAreaBusiness: true,
    });
  });

  it('keeps a list section edited while it was saving as the newer, unsaved draft', () => {
    let state = load(snapshot({ links: [WEBSITE_LINK] }));
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        links: drafts.links.map((row) => ({ ...row, label: 'Our website' })),
      }),
    });
    const sent = state.drafts;
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        links: drafts.links.map((row) => ({ ...row, url: 'https://example.com/book' })),
      }),
    });

    state = businessContextDraftReducer(state, {
      type: 'familySaved',
      family: 'links',
      snapshot: snapshot({ links: [{ ...WEBSITE_LINK, label: 'Our website' }] }),
      sent,
    });

    expect(state.drafts.links).toEqual([
      expect.objectContaining({ label: 'Our website', url: 'https://example.com/book' }),
    ]);
    expect(dirtyOf(state).links).toBe(true);

    state = businessContextDraftReducer(state, { type: 'resetFamilies', families: ['links'] });
    expect(state.drafts.links).toEqual([
      expect.objectContaining({ label: 'Our website', url: 'https://example.com' }),
    ]);
    expect(dirtyOf(state).links).toBe(false);
  });

  it('takes new saved values for clean sections when a newer snapshot arrives', () => {
    let state = load(snapshot());
    state = businessContextDraftReducer(state, {
      type: 'snapshotReceived',
      restaurantKey: 'rest-1',
      snapshot: snapshot({ links: [WEBSITE_LINK] }),
    });

    expect(state.drafts.links).toEqual([expect.objectContaining({ id: WEBSITE_LINK.id })]);
    expect(dirtyOf(state).links).toBe(false);
  });

  it('does not pre-fill from Google again after the first load', () => {
    let state = load(snapshot());
    state = businessContextDraftReducer(state, {
      type: 'snapshotReceived',
      restaurantKey: 'rest-1',
      snapshot: snapshot({}, { serviceItems: [GOOGLE_SERVICE] }),
    });

    expect(state.drafts.serviceItems).toEqual([]);
    expect(dirtyOf(state).serviceItems).toBe(false);
  });

  it('discards a section back to its saved values, dropping a Google pre-fill', () => {
    let state = load(snapshot({ links: [WEBSITE_LINK] }, { serviceItems: [GOOGLE_SERVICE] }));
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({ ...drafts, links: [] }),
    });

    state = businessContextDraftReducer(state, {
      type: 'resetFamilies',
      families: ['links', 'serviceItems'],
    });

    expect(state.drafts.links).toHaveLength(1);
    expect(state.drafts.serviceItems).toEqual([]);
    expect(state.seedSource.serviceItems).toBe('empty');
    expect(Object.values(dirtyOf(state)).some(Boolean)).toBe(false);
  });

  it('starts again from scratch, including Google pre-fill, for another restaurant', () => {
    let state = load(snapshot({ links: [WEBSITE_LINK] }));
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({ ...drafts, links: [] }),
    });

    state = businessContextDraftReducer(state, {
      type: 'snapshotReceived',
      restaurantKey: 'rest-2',
      snapshot: snapshot({}, { serviceItems: [GOOGLE_SERVICE] }),
    });

    expect(state.restaurantKey).toBe('rest-2');
    expect(state.drafts.links).toEqual([]);
    expect(state.drafts.serviceItems).toHaveLength(1);
    expect(dirtyOf(state)).toMatchObject({ links: false, serviceItems: true });
  });

  it('treats a hand-reverted edit as clean and ignores more-hours typing in progress', () => {
    const category = {
      id: '22222222-2222-4222-8222-222222222222',
      displayName: 'Gastropub',
      categoryCode: null,
      isPrimary: true,
      moreHoursTypes: [],
      source: 'manual',
      managedBy: 'ops',
      updatedAt: null,
    };
    let state = load(snapshot({ categories: [category] }));
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        categories: drafts.categories.map((row) => ({ ...row, moreHoursTypeDraft: 'kitch' })),
      }),
    });
    expect(dirtyOf(state).categories).toBe(false);

    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        categories: drafts.categories.map((row) => ({ ...row, displayName: 'Pub' })),
      }),
    });
    expect(dirtyOf(state).categories).toBe(true);
    state = businessContextDraftReducer(state, {
      type: 'edit',
      apply: (drafts) => ({
        ...drafts,
        categories: drafts.categories.map((row) => ({ ...row, displayName: 'Gastropub' })),
      }),
    });
    expect(dirtyOf(state).categories).toBe(false);
  });
});

/** The dirty check as it was first written: serialise every section on both sides. */
function referenceDirtyState(drafts: BusinessContextDrafts, saved: BusinessContextDrafts) {
  const comparable = (
    family: (typeof DISCOVERY_SECTION_ORDER)[number],
    value: BusinessContextDrafts,
  ) =>
    family === 'categories'
      ? value.categories.map(({ moreHoursTypeDraft: _draft, ...row }) => row)
      : value[family];
  return Object.fromEntries(
    DISCOVERY_SECTION_ORDER.map((family) => [
      family,
      JSON.stringify(comparable(family, drafts)) !== JSON.stringify(comparable(family, saved)),
    ]),
  ) as DirtyState;
}

const GASTROPUB = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Gastropub',
  categoryCode: null,
  isPrimary: true,
  moreHoursTypes: [],
  source: 'manual',
  managedBy: 'ops',
  updatedAt: null,
};

describe('computeBusinessContextDirtyState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches the serialise-everything check for every kind of draft', () => {
    const state = load(
      snapshot(
        { links: [WEBSITE_LINK], categories: [GASTROPUB] },
        { serviceItems: [GOOGLE_SERVICE] },
      ),
    );
    const saved = deriveSavedBusinessContextDrafts(state.baseline);
    const variants: BusinessContextDrafts[] = [
      state.drafts,
      saved,
      { ...saved },
      structuredClone(saved),
      { ...saved, links: saved.links.map((row) => ({ ...row, label: 'Our website' })) },
      { ...saved, links: saved.links.map((row) => ({ ...row })) },
      {
        ...saved,
        categories: saved.categories.map((row) => ({ ...row, moreHoursTypeDraft: 'kitch' })),
      },
      { ...saved, categories: saved.categories.map((row) => ({ ...row, displayName: 'Pub' })) },
      { ...saved, businessDetails: { ...saved.businessDetails, businessStatus: 'open' } },
      { ...state.drafts, serviceItems: saved.serviceItems },
    ];

    for (const drafts of variants) {
      // Twice, so a cached saved value gives the same answer as a fresh one.
      expect(computeBusinessContextDirtyState(drafts, saved)).toEqual(
        referenceDirtyState(drafts, saved),
      );
      expect(computeBusinessContextDirtyState(drafts, saved)).toEqual(
        referenceDirtyState(drafts, saved),
      );
    }
  });

  it('serialises the saved sections once per baseline and skips unchanged sections', () => {
    const state = load(snapshot({ links: [WEBSITE_LINK], categories: [GASTROPUB] }));
    const saved = deriveSavedBusinessContextDrafts(state.baseline);
    const stringify = vi.spyOn(JSON, 'stringify');

    // A section still holding the saved value itself needs no serialising at all.
    expect(Object.values(computeBusinessContextDirtyState(saved, saved)).some(Boolean)).toBe(false);
    expect(stringify).not.toHaveBeenCalled();

    // First keystroke on a draft sharing no section with the saved values: every draft section
    // plus every saved section, once.
    const copy = structuredClone(saved);
    const typed = { ...copy, links: copy.links.map((row) => ({ ...row, label: 'O' })) };
    expect(computeBusinessContextDirtyState(typed, saved).links).toBe(true);
    expect(stringify).toHaveBeenCalledTimes(DISCOVERY_SECTION_ORDER.length * 2);

    // Later keystrokes against the same baseline reuse the saved serialisations.
    stringify.mockClear();
    const typedMore = { ...typed, links: typed.links.map((row) => ({ ...row, label: 'Ou' })) };
    expect(computeBusinessContextDirtyState(typedMore, saved).links).toBe(true);
    expect(stringify).toHaveBeenCalledTimes(DISCOVERY_SECTION_ORDER.length);

    // A new baseline is serialised afresh.
    stringify.mockClear();
    const nextSaved = deriveSavedBusinessContextDrafts(snapshot({ links: [WEBSITE_LINK] }));
    computeBusinessContextDirtyState(typedMore, nextSaved);
    expect(stringify).toHaveBeenCalledTimes(DISCOVERY_SECTION_ORDER.length * 2);
  });
});
