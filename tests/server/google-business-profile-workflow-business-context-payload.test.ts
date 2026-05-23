import { describe, expect, it } from 'vitest';

import { buildBusinessContextPayloadForSections } from '@/server/google-business-profile/workflowBusinessContextPayload';

import type { RestaurantBusinessContextSnapshot } from '@/server/restaurants/businessContext';

function buildBusinessContextSnapshot(): RestaurantBusinessContextSnapshot {
  return {
    core: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    providerSnapshot: {
      categories: [
        {
          id: 'provider-category-id',
          displayName: 'Pub',
          categoryCode: 'gcid:pub',
          moreHoursTypes: [],
          isPrimary: true,
          source: 'gbp',
          managedBy: 'provider',
          updatedAt: '2026-04-25T09:50:00.000Z',
        },
      ],
      serviceAreas: [
        {
          id: 'provider-service-area-id',
          displayName: 'Cambridge',
          areaType: 'region',
          regionCode: 'GB',
          googlePlaceId: 'ChIJLQEq84ld2EcRIT1eo-Ego2M',
          googlePlaceResourceName: 'places/ChIJLQEq84ld2EcRIT1eo-Ego2M',
          placeData: null,
          source: 'gbp',
          managedBy: 'provider',
          updatedAt: '2026-04-25T09:50:00.000Z',
        },
      ],
      attributes: [
        {
          id: 'provider-attribute-id',
          attributeGroup: 'Accessibility',
          attributeKey: 'has_wheelchair_accessible_entrance',
          attributeName: null,
          attributeId: 'has_wheelchair_accessible_entrance',
          displayName: 'Wheelchair accessible entrance',
          displayText: null,
          displayTextStandalone: null,
          displayTextNegative: null,
          valueType: 'boolean',
          boolValue: true,
          textValue: null,
          uriValue: null,
          uriValues: [],
          enumValues: [],
          unsetEnumValues: [],
          rawValue: { boolValue: true },
          rawEnumValues: null,
          displayValue: { displayText: 'Wheelchair accessible entrance' },
          valueMetadata: [],
          source: 'gbp',
          managedBy: 'provider',
          updatedAt: '2026-04-25T09:50:00.000Z',
        },
      ],
      serviceItems: [
        {
          id: 'provider-service-item-id',
          itemKey: 'private_dining',
          itemType: 'structured',
          displayName: 'Private dining',
          description: null,
          payload: null,
          source: 'gbp',
          managedBy: 'provider',
          updatedAt: '2026-04-25T09:50:00.000Z',
        },
      ],
    },
  };
}

describe('google business profile workflow business-context payload helper', () => {
  it('clones selected provider rows into core-safe payload rows', () => {
    const payload = buildBusinessContextPayloadForSections(
      [
        'businessContext.categories',
        'businessContext.serviceAreas',
        'businessContext.attributes',
        'businessContext.serviceItems',
      ],
      buildBusinessContextSnapshot(),
    );

    expect(payload.categories?.[0]).toMatchObject({
      displayName: 'Pub',
      categoryCode: 'gcid:pub',
      isPrimary: false,
    });
    expect(payload.categories?.[0]).not.toHaveProperty('id');
    expect(payload.serviceAreas?.[0]).not.toHaveProperty('id');
    expect(payload.attributes?.[0]).toMatchObject({
      attributeKey: 'has_wheelchair_accessible_entrance',
      valueType: 'boolean',
      boolValue: true,
    });
    expect(payload.attributes?.[0]).not.toHaveProperty('id');
    expect(payload.serviceItems?.[0]).not.toHaveProperty('id');
  });

  it('omits unselected business-context sections', () => {
    const payload = buildBusinessContextPayloadForSections(
      ['businessContext.attributes'],
      buildBusinessContextSnapshot(),
    );

    expect(payload).toEqual({
      attributes: [
        expect.objectContaining({
          attributeKey: 'has_wheelchair_accessible_entrance',
        }),
      ],
    });
  });
});
