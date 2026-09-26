import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerDraftOverride = vi.hoisted(() => vi.fn());

vi.mock('@/components/features/restaurant-settings/gbp-drift/useGbpDrift', () => ({
  useOptionalGbpDrift: () => ({ registerDraftOverride }),
}));

import { EMPTY_BUSINESS_DETAILS } from '@/components/features/restaurant-settings/businessContextModel';
import { useDiscoveryGbpDraftOverrides } from '@/components/features/restaurant-settings/discovery/hooks';

import type {
  BusinessContextFamilyPayloadState,
  CategoryEditor,
  FamilyKey,
  LinkEditor,
} from '@/components/features/restaurant-settings/businessContextModel';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type DriftFieldsByFamily = Readonly<Record<FamilyKey, ReadonlyArray<DualSyncFieldSummary>>>;

function makeCategory(displayName: string): CategoryEditor {
  return {
    id: `cat-${displayName}`,
    displayName,
    categoryCode: '',
    isPrimary: false,
    moreHoursTypes: [],
    moreHoursTypeDraft: '',
  };
}

function makeLink(url: string): LinkEditor {
  return { id: 'link-1', linkType: 'website', label: '', url, isPrimary: true };
}

function makeEditor(
  overrides: Partial<BusinessContextFamilyPayloadState> = {},
): BusinessContextFamilyPayloadState {
  return {
    businessDetails: EMPTY_BUSINESS_DETAILS,
    links: [],
    categories: [makeCategory('Pub')],
    serviceAreas: [],
    attributes: [],
    serviceItems: [],
    ...overrides,
  };
}

const categoryField = {
  fieldKey: 'businessContext.categories.pub',
  sectionKey: 'businessContext.categories',
  label: 'Pub',
} as DualSyncFieldSummary;

const DRIFT_FIELDS: DriftFieldsByFamily = {
  businessDetails: [],
  links: [],
  categories: [categoryField],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

describe('useDiscoveryGbpDraftOverrides', () => {
  beforeEach(() => {
    registerDraftOverride.mockClear();
  });

  it('@contract registers the draft value for each drifted field', () => {
    renderHook(() =>
      useDiscoveryGbpDraftOverrides({ editor: makeEditor(), gbpDriftFieldsByFamily: DRIFT_FIELDS }),
    );

    expect(registerDraftOverride).toHaveBeenCalledTimes(1);
    expect(registerDraftOverride).toHaveBeenCalledWith(
      'businessContext.categories.pub',
      expect.objectContaining({ displayName: 'Pub' }),
    );
  });

  it('@contract does not re-register when a family without drift fields changes', () => {
    const categories = [makeCategory('Pub')];
    const { rerender } = renderHook(
      ({ editor }: { editor: BusinessContextFamilyPayloadState }) =>
        useDiscoveryGbpDraftOverrides({ editor, gbpDriftFieldsByFamily: DRIFT_FIELDS }),
      { initialProps: { editor: makeEditor({ categories }) } },
    );
    registerDraftOverride.mockClear();

    // Each keystroke in the links family creates a new links array.
    rerender({ editor: makeEditor({ categories, links: [makeLink('https://a')] }) });
    rerender({ editor: makeEditor({ categories, links: [makeLink('https://ab')] }) });

    expect(registerDraftOverride).not.toHaveBeenCalled();
  });

  it('@contract re-registers when the drifted family changes', () => {
    const { rerender } = renderHook(
      ({ editor }: { editor: BusinessContextFamilyPayloadState }) =>
        useDiscoveryGbpDraftOverrides({ editor, gbpDriftFieldsByFamily: DRIFT_FIELDS }),
      { initialProps: { editor: makeEditor() } },
    );
    registerDraftOverride.mockClear();

    rerender({ editor: makeEditor({ categories: [makeCategory('pub ')] }) });

    expect(registerDraftOverride).toHaveBeenCalledTimes(1);
  });
});
