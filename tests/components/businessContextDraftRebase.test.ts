import { describe, expect, it } from 'vitest';

import {
  businessContextDraftReducer,
  computeBusinessContextDirtyState,
  deriveSavedBusinessContextDrafts,
  INITIAL_BUSINESS_CONTEXT_DRAFT_STATE,
  type BusinessContextDraftState,
} from '@/components/features/restaurant-settings/businessContextDraftState';

import type {
  RestaurantBusinessContextCategory,
  RestaurantBusinessContextFamily,
  RestaurantBusinessContextLink,
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

function link(id: string, url: string, label = 'Link'): RestaurantBusinessContextLink {
  return {
    id,
    linkType: 'website',
    linkStatus: 'current',
    label,
    url,
    isPrimary: false,
    source: 'nabatable',
    managedBy: 'nabatable',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };
}

function category(id: string, displayName: string, source = 'nabatable') {
  return {
    id,
    displayName,
    categoryCode: '',
    moreHoursTypes: [],
    isPrimary: false,
    source,
    managedBy: source,
    updatedAt: null,
  } as RestaurantBusinessContextCategory;
}

function details(openingDate: string | null, businessStatus: string | null) {
  return {
    id: 'bd-1',
    openingDate,
    businessStatus,
    isServiceAreaBusiness: false,
    source: 'nabatable',
    managedBy: 'nabatable',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };
}

function snapshot(
  core: Partial<RestaurantBusinessContextFamily> = {},
  provider: Partial<RestaurantBusinessContextFamily> = {},
  revision?: number,
): RestaurantBusinessContextSnapshot {
  return {
    ...(revision === undefined ? {} : { revision }),
    core: { ...EMPTY_FAMILY, ...core },
    providerSnapshot: { ...EMPTY_FAMILY, ...provider },
  } as RestaurantBusinessContextSnapshot;
}

function load(snap: RestaurantBusinessContextSnapshot) {
  return businessContextDraftReducer(INITIAL_BUSINESS_CONTEXT_DRAFT_STATE, {
    type: 'snapshotReceived',
    restaurantKey: 'rest-1',
    snapshot: snap,
  });
}

function receive(state: BusinessContextDraftState, snap: RestaurantBusinessContextSnapshot) {
  return businessContextDraftReducer(state, {
    type: 'snapshotReceived',
    restaurantKey: 'rest-1',
    snapshot: snap,
  });
}

function edit(
  state: BusinessContextDraftState,
  apply: (drafts: BusinessContextDraftState['drafts']) => BusinessContextDraftState['drafts'],
) {
  return businessContextDraftReducer(state, { type: 'edit', apply });
}

describe('rebasing an open Discovery draft onto a newer server snapshot', () => {
  it('@contract keeps my new link and takes the server version of a link I did not touch', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    let state = load(snapshot({ links: [link(A, 'https://old.example')] }, {}, 3));
    state = edit(state, (drafts) => ({
      ...drafts,
      links: [...drafts.links, { ...drafts.links[0]!, id: 'link-new', url: 'https://new.example' }],
    }));

    // Another writer (for example a Google import) changed link A underneath the draft.
    state = receive(state, snapshot({ links: [link(A, 'https://imported.example')] }, {}, 4));

    expect(state.drafts.links.map((row) => [row.id, row.url])).toEqual([
      [A, 'https://imported.example'],
      ['link-new', 'https://new.example'],
    ]);
    expect(state.baseline?.revision).toBe(4);
  });

  it('@contract keeps my edit when the server changed the same row', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    let state = load(snapshot({ links: [link(A, 'https://old.example')] }));
    state = edit(state, (drafts) => ({
      ...drafts,
      links: drafts.links.map((row) => ({ ...row, url: 'https://mine.example' })),
    }));

    state = receive(state, snapshot({ links: [link(A, 'https://theirs.example')] }));

    expect(state.drafts.links.map((row) => row.url)).toEqual(['https://mine.example']);
  });

  it('@contract drops untouched rows the server removed and appends rows the server added', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    const B = '22222222-2222-4222-8222-222222222222';
    const C = '33333333-3333-4333-8333-333333333333';
    let state = load(snapshot({ categories: [category(A, 'Pub'), category(B, 'Bar')] }));
    state = edit(state, (drafts) => ({
      ...drafts,
      categories: drafts.categories.map((row) =>
        row.id === B ? { ...row, displayName: 'Cocktail bar' } : row,
      ),
    }));

    state = receive(state, snapshot({ categories: [category(B, 'Bar'), category(C, 'Inn')] }));

    expect(state.drafts.categories.map((row) => [row.id, row.displayName])).toEqual([
      [B, 'Cocktail bar'],
      [C, 'Inn'],
    ]);
  });

  it('@contract merges business details field by field', () => {
    let state = load(snapshot({ businessDetails: details(null, 'open') }));
    state = edit(state, (drafts) => ({
      ...drafts,
      businessDetails: { ...drafts.businessDetails, businessStatus: 'closed_temporarily' },
    }));

    state = receive(state, snapshot({ businessDetails: details('2019-05-01', 'open') }));

    expect(state.drafts.businessDetails).toMatchObject({
      openingDate: '2019-05-01',
      businessStatus: 'closed_temporarily',
    });
  });

  it('@contract replaces an unsaved Google pre-fill once the server holds saved rows', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    let state = load(snapshot({}, { categories: [category('gbp-1', 'Pub', 'gbp')] }));
    expect(state.seedSource.categories).toBe('provider');

    state = receive(state, snapshot({ categories: [category(A, 'Pub')] }));

    expect(state.drafts.categories.map((row) => row.id)).toEqual([A]);
    expect(state.seedSource.categories).toBe('core');
    const dirty = computeBusinessContextDirtyState(
      state.drafts,
      deriveSavedBusinessContextDrafts(state.baseline),
    );
    expect(dirty.categories).toBe(false);
  });

  it('@contract a page save applies every sent section from one snapshot', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    let state = load(snapshot({}, {}, 1));
    state = edit(state, (drafts) => ({
      ...drafts,
      businessDetails: { ...drafts.businessDetails, businessStatus: 'open' },
      categories: [
        { ...category('category-new', 'Pub'), categoryCode: '', moreHoursTypeDraft: '' },
      ],
    }));
    const sent = state.drafts;
    // Typed while the request was in flight: stays as the newer, unsaved draft.
    state = edit(state, (drafts) => ({
      ...drafts,
      businessDetails: { ...drafts.businessDetails, openingDate: '2020-01-01' },
    }));

    state = businessContextDraftReducer(state, {
      type: 'saved',
      families: ['businessDetails', 'categories'],
      snapshot: snapshot(
        { businessDetails: details(null, 'open'), categories: [category(A, 'Pub')] },
        {},
        2,
      ),
      sent,
    });

    expect(state.baseline?.revision).toBe(2);
    expect(state.drafts.categories.map((row) => row.id)).toEqual([A]);
    expect(state.drafts.businessDetails).toMatchObject({
      businessStatus: 'open',
      openingDate: '2020-01-01',
    });
    const dirty = computeBusinessContextDirtyState(
      state.drafts,
      deriveSavedBusinessContextDrafts(state.baseline),
    );
    expect(dirty).toMatchObject({ categories: false, businessDetails: true });
  });
});
