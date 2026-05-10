import { describe, expect, it } from 'vitest';

import {
  buildBusinessContextFamilyPayload,
  deriveBusinessContextEditorState,
  deriveBusinessContextFamilyState,
  deriveFamilyCounts,
  filterEditableLinks,
} from '@/components/features/restaurant-settings/businessContextModel';

import type { RestaurantBusinessContextSnapshot } from '@/services/ops/restaurants';

const emptyFamily = {
  businessDetails: null,
  links: [],
  categories: [],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

function buildSnapshot(): RestaurantBusinessContextSnapshot {
  return {
    core: {
      ...emptyFamily,
      links: [
        {
          id: 'core-link-1',
          linkType: 'website',
          linkStatus: 'current',
          label: 'Website',
          url: 'https://example.com',
          isPrimary: true,
          source: 'manual',
          managedBy: 'ops',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
        {
          id: 'core-link-provider-only',
          linkType: 'provider_metadata',
          linkStatus: 'current',
          label: 'Provider',
          url: 'https://example.com/provider',
          isPrimary: false,
          source: 'manual',
          managedBy: 'ops',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
    },
    providerSnapshot: {
      ...emptyFamily,
      businessDetails: {
        id: 'provider-business',
        openingDate: '2020-01-01',
        businessStatus: 'open',
        isServiceAreaBusiness: true,
        source: 'gbp',
        managedBy: 'gbp',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
      categories: [
        {
          id: 'provider-category-1',
          displayName: 'Restaurant',
          categoryCode: 'restaurant',
          isPrimary: true,
          moreHoursTypes: [
            {
              hoursTypeId: 'KITCHEN',
              displayName: 'Kitchen',
              localizedDisplayName: 'Kitchen',
            },
          ],
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
    },
  };
}

describe('businessContextModel editor helpers', () => {
  it('seeds editable state from saved core first and provider snapshot second', () => {
    const state = deriveBusinessContextEditorState(buildSnapshot());

    expect(state.businessDetails).toEqual({
      openingDate: '2020-01-01',
      businessStatus: 'open',
      isServiceAreaBusiness: true,
    });
    expect(state.links).toEqual([
      {
        id: 'core-link-1',
        linkType: 'website',
        label: 'Website',
        url: 'https://example.com',
        isPrimary: true,
      },
    ]);
    expect(state.categories).toEqual([
      {
        id: 'provider-category-1',
        displayName: 'Restaurant',
        categoryCode: 'restaurant',
        isPrimary: true,
        moreHoursTypes: [
          {
            hoursTypeId: 'KITCHEN',
            displayName: 'Kitchen',
            localizedDisplayName: 'Kitchen',
          },
        ],
        moreHoursTypeDraft: '',
      },
    ]);
    expect(state.seedSource).toMatchObject({
      businessDetails: 'provider',
      links: 'core',
      categories: 'provider',
    });
  });

  it('derives counts and filters non-editable link types consistently', () => {
    const snapshot = buildSnapshot();

    expect(filterEditableLinks(snapshot.core.links)).toHaveLength(1);
    expect(deriveFamilyCounts(snapshot.core)).toMatchObject({
      businessDetails: 0,
      links: 1,
      categories: 0,
    });
    expect(deriveFamilyCounts(snapshot.providerSnapshot)).toMatchObject({
      businessDetails: 1,
      links: 0,
      categories: 1,
    });
  });

  it('derives reset state for one family without inventing values', () => {
    const reset = deriveBusinessContextFamilyState(buildSnapshot(), 'categories');

    expect(reset.categories).toEqual([
      expect.objectContaining({
        id: 'provider-category-1',
        displayName: 'Restaurant',
        moreHoursTypeDraft: '',
      }),
    ]);
    expect(reset.seedSource?.categories).toBe('provider');
  });

  it('builds family save payloads without changing API shapes', () => {
    const state = deriveBusinessContextEditorState(buildSnapshot());

    expect(buildBusinessContextFamilyPayload('businessDetails', state)).toEqual({
      businessDetails: {
        openingDate: '2020-01-01',
        businessStatus: 'open',
        isServiceAreaBusiness: true,
      },
    });
    expect(buildBusinessContextFamilyPayload('links', state)).toEqual({
      links: [
        {
          id: 'core-link-1',
          linkType: 'website',
          linkStatus: 'current',
          label: 'Website',
          url: 'https://example.com',
          isPrimary: true,
        },
      ],
    });
    expect(buildBusinessContextFamilyPayload('categories', state)).toEqual({
      categories: [
        {
          id: 'provider-category-1',
          displayName: 'Restaurant',
          categoryCode: 'restaurant',
          isPrimary: true,
          moreHoursTypes: [
            {
              hoursTypeId: 'KITCHEN',
              displayName: 'Kitchen',
              localizedDisplayName: 'Kitchen',
            },
          ],
        },
      ],
    });
  });

  it('keeps validation failures in pure payload helpers', () => {
    const state = {
      ...deriveBusinessContextEditorState(buildSnapshot()),
      serviceAreas: [
        {
          id: 'service-area-1',
          displayName: 'Cambridge',
          areaType: 'region',
          regionCode: '',
          googlePlaceId: '',
          googlePlaceResourceName: '',
          placeDataJson: '{bad-json',
        },
      ],
    };

    expect(() => buildBusinessContextFamilyPayload('serviceAreas', state)).toThrow(
      'Place data must be valid JSON object syntax.',
    );
  });
});
