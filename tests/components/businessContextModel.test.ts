import { describe, expect, it } from 'vitest';

import {
  toBusinessDetailsEditor,
  toPrettyJson,
} from '@/components/features/restaurant-settings/businessContextEditorTransforms';
import {
  AMENITY_ATTRIBUTE_GROUPS,
  LINK_TYPE_OPTIONS,
  buildBusinessContextFamilyPayload,
  deriveBusinessContextEditorState,
  deriveBusinessContextFamilyState,
  deriveFamilyCounts,
  filterEditableLinks,
} from '@/components/features/restaurant-settings/businessContextModel';
import {
  RESTAURANT_EDITABLE_LINK_TYPES,
  RESTAURANT_LINK_TYPE_OPTIONS,
} from '@/lib/ops/restaurant-link-types';

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
      serviceAreas: [
        {
          id: 'provider-service-area-1',
          displayName: 'Cambridge',
          areaType: 'region',
          regionCode: 'GB-CAM',
          googlePlaceId: null,
          googlePlaceResourceName: null,
          placeData: { radiusMiles: 4 },
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
      attributes: [
        {
          id: 'provider-attribute-1',
          attributeGroup: 'Accessibility',
          attributeKey: 'wheelchair_accessible_entrance',
          attributeName: 'Wheelchair accessible entrance',
          attributeId: 'has_wheelchair_accessible_entrance',
          displayName: 'Wheelchair accessible entrance',
          displayText: 'Has wheelchair accessible entrance',
          displayTextStandalone: 'Wheelchair accessible entrance',
          displayTextNegative: 'No wheelchair accessible entrance',
          valueType: 'BOOL',
          boolValue: true,
          textValue: null,
          uriValue: null,
          uriValues: [],
          enumValues: [],
          unsetEnumValues: [],
          rawValue: { boolValue: true },
          rawEnumValues: null,
          displayValue: { displayText: 'Has wheelchair accessible entrance' },
          valueMetadata: [],
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
      serviceItems: [
        {
          id: 'provider-service-item-1',
          itemKey: 'delivery',
          itemType: 'service',
          displayName: 'Delivery',
          description: 'Delivery available',
          payload: { enabled: true },
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
    },
  };
}

describe('businessContextModel editor helpers', () => {
  it('reuses the shared owner-editable link and amenity reference data', () => {
    expect(LINK_TYPE_OPTIONS).toEqual(RESTAURANT_LINK_TYPE_OPTIONS);
    expect(LINK_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      ...RESTAURANT_EDITABLE_LINK_TYPES,
    ]);
    expect(AMENITY_ATTRIBUTE_GROUPS.some((group) => group.title === 'Accessibility')).toBe(true);
  });

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

  it('keeps editor transform helpers deterministic for empty JSON and unknown statuses', () => {
    expect(toPrettyJson(null)).toBe('');
    expect(toPrettyJson([])).toBe('');
    expect(toPrettyJson({})).toBe('');
    expect(toPrettyJson({ radiusMiles: 4 })).toBe('{\n  "radiusMiles": 4\n}');

    expect(
      toBusinessDetailsEditor({
        id: 'business-details-1',
        openingDate: null,
        businessStatus: 'temporarily_hidden' as never,
        isServiceAreaBusiness: true,
        source: 'gbp',
        managedBy: 'gbp',
        updatedAt: '2026-05-01T10:00:00.000Z',
      }),
    ).toEqual({
      openingDate: '',
      businessStatus: 'unset',
      isServiceAreaBusiness: true,
    });
  });

  it('derives reset state for each requested family without inventing sibling values', () => {
    const snapshot = buildSnapshot();

    const businessDetailsReset = deriveBusinessContextFamilyState(snapshot, 'businessDetails');
    expect(businessDetailsReset).toMatchObject({
      businessDetails: {
        openingDate: '2020-01-01',
        businessStatus: 'open',
        isServiceAreaBusiness: true,
      },
      seedSource: {
        businessDetails: 'provider',
        links: 'empty',
      },
    });
    expect(businessDetailsReset.links).toBeUndefined();

    const linksReset = deriveBusinessContextFamilyState(snapshot, 'links');
    expect(linksReset.links).toEqual([
      expect.objectContaining({
        id: 'core-link-1',
        linkType: 'website',
      }),
    ]);
    expect(linksReset.seedSource?.links).toBe('core');
    expect(linksReset.categories).toBeUndefined();

    const categoriesReset = deriveBusinessContextFamilyState(snapshot, 'categories');
    expect(categoriesReset.categories).toEqual([
      expect.objectContaining({
        id: 'provider-category-1',
        displayName: 'Restaurant',
        moreHoursTypeDraft: '',
      }),
    ]);
    expect(categoriesReset.seedSource?.categories).toBe('provider');

    const serviceAreasReset = deriveBusinessContextFamilyState(snapshot, 'serviceAreas');
    expect(serviceAreasReset.serviceAreas).toEqual([
      expect.objectContaining({
        id: 'provider-service-area-1',
        placeDataJson: '{\n  "radiusMiles": 4\n}',
      }),
    ]);
    expect(serviceAreasReset.serviceAreaDraft).toBe('');
    expect(serviceAreasReset.seedSource?.serviceAreas).toBe('provider');

    const attributesReset = deriveBusinessContextFamilyState(snapshot, 'attributes');
    expect(attributesReset.attributes).toEqual([
      expect.objectContaining({
        id: 'provider-attribute-1',
        boolValue: 'true',
        rawValueJson: '{\n  "boolValue": true\n}',
      }),
    ]);
    expect(attributesReset.seedSource?.attributes).toBe('provider');

    const serviceItemsReset = deriveBusinessContextFamilyState(snapshot, 'serviceItems');
    expect(serviceItemsReset.serviceItems).toEqual([
      expect.objectContaining({
        id: 'provider-service-item-1',
        payloadJson: '{\n  "enabled": true\n}',
      }),
    ]);
    expect(serviceItemsReset.seedSource?.serviceItems).toBe('provider');
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
