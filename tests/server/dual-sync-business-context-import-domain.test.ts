import { describe, expect, it } from 'vitest';

import {
  BUSINESS_CONTEXT_IMPORT_PREFIX,
  buildAttributeImportUpdate,
  buildBusinessContextImportSuccess,
  buildCategoryImportUpdate,
  buildServiceAreaImportUpdate,
  findGoogleCategoryForImport,
  parseBusinessContextImportId,
  resolveBusinessContextImportFieldConfig,
} from '@/server/dual-sync/publish/ports/business-context-import-domain';
import { buildRegistry } from '@/server/dual-sync/registry';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { RestaurantBusinessContextSnapshot } from '@/server/restaurants/businessContext';

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: null,
      contactPhone: null,
      address: null,
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    ...overrides,
  };
}

describe('business-context import domain helpers', () => {
  it('parses only populated field-key tails for a supported prefix', () => {
    expect(
      parseBusinessContextImportId(
        'businessContext.categories.fine-dining',
        BUSINESS_CONTEXT_IMPORT_PREFIX.category,
      ),
    ).toBe('fine-dining');
    expect(
      parseBusinessContextImportId(
        'businessContext.attributes.fine-dining',
        BUSINESS_CONTEXT_IMPORT_PREFIX.category,
      ),
    ).toBeNull();
    expect(
      parseBusinessContextImportId(
        'businessContext.categories.',
        BUSINESS_CONTEXT_IMPORT_PREFIX.category,
      ),
    ).toBeNull();
  });

  it('finds Google categories by slugified display name', () => {
    expect(
      findGoogleCategoryForImport(
        makeSnapshot({
          businessContext: {
            categories: [
              {
                displayName: 'Fine Dining',
                categoryCode: 'gcid:fine_dining',
                isPrimary: true,
                moreHoursTypes: [],
              },
            ],
            serviceAreas: [],
            attributes: [],
            serviceItems: [],
          },
        }),
        'fine-dining',
      ),
    ).toMatchObject({ displayName: 'Fine Dining' });
  });

  it('builds category update payloads while preserving other rows and existing ids', () => {
    const current: RestaurantBusinessContextSnapshot['core']['categories'] = [
      {
        id: 'cat-1',
        displayName: 'Fine Dining',
        categoryCode: 'old',
        moreHoursTypes: [],
        isPrimary: false,
        source: 'core',
        managedBy: 'core',
        updatedAt: null,
      },
      {
        id: 'cat-2',
        displayName: 'Bar',
        categoryCode: 'bar',
        moreHoursTypes: [],
        isPrimary: false,
        source: 'core',
        managedBy: 'core',
        updatedAt: null,
      },
    ];

    expect(
      buildCategoryImportUpdate(current, 'fine-dining', {
        displayName: 'Fine Dining',
        categoryCode: 'gcid:fine_dining',
        isPrimary: true,
        moreHoursTypes: [],
      }),
    ).toEqual([
      {
        id: 'cat-2',
        displayName: 'Bar',
        categoryCode: 'bar',
        moreHoursTypes: [],
        isPrimary: false,
      },
      {
        id: 'cat-1',
        displayName: 'Fine Dining',
        categoryCode: 'gcid:fine_dining',
        moreHoursTypes: [],
        isPrimary: true,
      },
    ]);
  });

  it('plans missing-Google category imports as row deletion', () => {
    expect(
      buildCategoryImportUpdate(
        [
          {
            id: 'cat-1',
            displayName: 'Brewery',
            categoryCode: null,
            moreHoursTypes: [],
            isPrimary: false,
            source: 'core',
            managedBy: 'core',
            updatedAt: null,
          },
        ],
        'brewery',
        null,
      ),
    ).toEqual([]);
  });

  it('preserves stored service-area place identifiers while importing Google fields', () => {
    expect(
      buildServiceAreaImportUpdate(
        [
          {
            id: 'area-1',
            displayName: 'Downtown',
            areaType: 'place',
            regionCode: null,
            googlePlaceId: 'place-id-stored',
            googlePlaceResourceName: 'places/abc',
            placeData: null,
            source: 'core',
            managedBy: 'core',
            updatedAt: null,
          },
        ],
        'downtown',
        {
          displayName: 'Downtown',
          areaType: 'place',
          regionCode: 'US-CA',
          placeData: { source: 'google' },
        },
      ),
    ).toEqual([
      {
        id: 'area-1',
        displayName: 'Downtown',
        areaType: 'place',
        regionCode: 'US-CA',
        googlePlaceId: 'place-id-stored',
        googlePlaceResourceName: 'places/abc',
        placeData: { source: 'google' },
      },
    ]);
  });

  it('preserves existing attribute display metadata while importing values', () => {
    expect(
      buildAttributeImportUpdate(
        [
          {
            id: 'attr-1',
            attributeGroup: 'accessibility',
            attributeKey: 'serves_dinner',
            attributeName: 'attributes/serves_dinner',
            attributeId: 'serves_dinner',
            displayName: 'Serves dinner',
            displayText: 'Dinner',
            displayTextStandalone: null,
            displayTextNegative: null,
            valueType: 'BOOL',
            boolValue: false,
            textValue: null,
            uriValue: null,
            uriValues: [],
            enumValues: [],
            unsetEnumValues: [],
            rawValue: { old: true },
            rawEnumValues: null,
            displayValue: { label: 'Dinner' },
            valueMetadata: [{ value: true, displayName: 'Dinner' }],
            source: 'core',
            managedBy: 'core',
            updatedAt: null,
          },
        ],
        'serves_dinner',
        {
          attributeKey: 'serves_dinner',
          attributeName: 'attributes/serves_dinner',
          attributeId: 'serves_dinner',
          valueType: 'BOOL',
          boolValue: true,
          textValue: null,
          uriValue: null,
          uriValues: [],
          enumValues: [],
          unsetEnumValues: [],
        },
      ),
    ).toEqual([
      expect.objectContaining({
        id: 'attr-1',
        attributeGroup: 'accessibility',
        boolValue: true,
        displayText: 'Dinner',
        rawValue: { old: true },
        displayValue: { label: 'Dinner' },
        valueMetadata: [{ value: true, displayName: 'Dinner' }],
      }),
    ]);
  });

  it('resolves registry configs and builds canonical import success hashes', () => {
    const googleCategory = {
      displayName: 'Fine Dining',
      categoryCode: 'gcid:fine_dining',
      isPrimary: true,
      moreHoursTypes: [],
    };
    const registry = buildRegistry({
      coreSnapshot: makeSnapshot(),
      gbpSnapshot: makeSnapshot({
        businessContext: {
          categories: [googleCategory],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
      }),
      includeCoreOnly: false,
    });

    const configResult = resolveBusinessContextImportFieldConfig(
      registry,
      'businessContext.categories.fine-dining',
    );
    expect(configResult.status).toBe('ready');
    if (configResult.status === 'ready') {
      const result = buildBusinessContextImportSuccess(configResult.config, googleCategory);
      expect(result.status).toBe('succeeded');
      if (result.status === 'succeeded') {
        expect(result.afterCoreHash).toBe(result.afterGbpHash);
        expect(result.afterCoreHash).toEqual(expect.any(String));
      }
    }
  });
});
