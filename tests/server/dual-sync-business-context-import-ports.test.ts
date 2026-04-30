import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const getRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/businessContext', () => ({
  getRestaurantBusinessContext: getRestaurantBusinessContextMock,
  updateRestaurantBusinessContext: updateRestaurantBusinessContextMock,
}));

import {
  applyBusinessContextAttributeImportToCore,
  applyBusinessContextCategoryImportToCore,
  applyBusinessContextServiceAreaImportToCore,
  applyBusinessContextServiceItemImportToCore,
} from '@/server/dual-sync/publish/ports/business-context-import';
import type { DualSyncOperationContext } from '@/server/dual-sync/publish/types';
import type {
  DualSyncCanonicalSnapshot,
  DualSyncBusinessContextSectionValues,
} from '@/server/dual-sync/snapshots/types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeSnapshot(
  context: Partial<DualSyncBusinessContextSectionValues> = {},
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
      ...context,
    },
  };
}

function makeCtx(
  fieldKey: string,
  sectionKey: DualSyncOperationContext['decision']['sectionKey'],
  context: Partial<DualSyncBusinessContextSectionValues>,
  google: Partial<DualSyncBusinessContextSectionValues>,
): DualSyncOperationContext {
  return {
    client,
    restaurantId: RESTAURANT_ID,
    publishJobId: 'job-1',
    decision: {
      fieldKey,
      sectionKey,
      action: 'import_from_google',
      pinnedCoreHash: null,
      pinnedGbpHash: null,
    },
    coreSnapshot: makeSnapshot(context),
    gbpSnapshot: makeSnapshot(google),
    actorUserId: null,
  };
}

beforeEach(() => {
  updateRestaurantBusinessContextMock.mockReset();
  getRestaurantBusinessContextMock.mockReset();
  updateRestaurantBusinessContextMock.mockResolvedValue({});
  getRestaurantBusinessContextMock.mockResolvedValue({
    core: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
      links: [],
    },
    providerSnapshot: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
      links: [],
    },
  });
});

describe('applyBusinessContextCategoryImportToCore', () => {
  it('imports a Google category that has no Core counterpart', async () => {
    const ctx = makeCtx(
      'businessContext.categories.fine-dining',
      'businessContext.categories',
      { categories: [{ displayName: 'Fine Dining', categoryCode: 'gcid:cat-1', isPrimary: false, moreHoursTypes: [] }] },
      { categories: [{ displayName: 'Fine Dining', categoryCode: 'gcid:cat-1', isPrimary: true, moreHoursTypes: [] }] },
    );
    getRestaurantBusinessContextMock.mockResolvedValue({
      core: {
        categories: [
          {
            id: 'cat-other',
            displayName: 'Bar',
            categoryCode: null,
            moreHoursTypes: [],
            isPrimary: false,
            source: 'core',
            managedBy: 'core',
            updatedAt: null,
          },
        ],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        links: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        links: [],
      },
    });

    const result = await applyBusinessContextCategoryImportToCore(ctx);

    expect(updateRestaurantBusinessContextMock).toHaveBeenCalledTimes(1);
    const [restaurantId, payload, , provenance] = updateRestaurantBusinessContextMock.mock.calls[0] ?? [];
    expect(restaurantId).toBe(RESTAURANT_ID);
    expect(payload?.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayName: 'Bar' }),
        expect.objectContaining({ displayName: 'Fine Dining', isPrimary: true }),
      ]),
    );
    expect(provenance?.changeOrigin).toBe('import');
    expect(provenance?.changedVia).toBe('dual-sync.publish');
    expect(result.status).toBe('succeeded');
  });

  it('removes the row when Google has no matching category (delete semantic)', async () => {
    const ctx = makeCtx(
      'businessContext.categories.brewery',
      'businessContext.categories',
      { categories: [{ displayName: 'Brewery', categoryCode: null, isPrimary: false, moreHoursTypes: [] }] },
      { categories: [] },
    );
    getRestaurantBusinessContextMock.mockResolvedValue({
      core: {
        categories: [
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
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        links: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        links: [],
      },
    });

    const result = await applyBusinessContextCategoryImportToCore(ctx);

    const [, payload] = updateRestaurantBusinessContextMock.mock.calls[0] ?? [];
    expect(payload?.categories).toEqual([]);
    expect(result.status).toBe('succeeded');
  });

  it('rejects fields outside the categories prefix', async () => {
    const ctx = makeCtx(
      'profile.name',
      'profile',
      { categories: [] },
      { categories: [] },
    );
    const result = await applyBusinessContextCategoryImportToCore(ctx);
    expect(updateRestaurantBusinessContextMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('PORT_FAILURE');
  });
});

describe('applyBusinessContextServiceAreaImportToCore', () => {
  it('imports a Google service area and preserves Core place metadata', async () => {
    const ctx = makeCtx(
      'businessContext.serviceAreas.downtown',
      'businessContext.serviceAreas',
      {
        serviceAreas: [
          { displayName: 'Downtown', areaType: 'place', regionCode: null, placeData: null },
        ],
      },
      {
        serviceAreas: [
          { displayName: 'Downtown', areaType: 'place', regionCode: 'US-CA', placeData: null },
        ],
      },
    );
    getRestaurantBusinessContextMock.mockResolvedValue({
      core: {
        categories: [],
        serviceAreas: [
          {
            id: 'sa-1',
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
        attributes: [],
        serviceItems: [],
        links: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        links: [],
      },
    });

    const result = await applyBusinessContextServiceAreaImportToCore(ctx);
    const [, payload] = updateRestaurantBusinessContextMock.mock.calls[0] ?? [];
    const updatedRow = payload?.serviceAreas?.[0];
    expect(updatedRow).toEqual(
      expect.objectContaining({
        id: 'sa-1',
        regionCode: 'US-CA',
        googlePlaceId: 'place-id-stored',
        googlePlaceResourceName: 'places/abc',
      }),
    );
    expect(result.status).toBe('succeeded');
  });
});

describe('applyBusinessContextAttributeImportToCore', () => {
  it('imports an enum attribute and preserves Core display metadata', async () => {
    const ctx = makeCtx(
      'businessContext.attributes.has_wheelchair_accessible_entrance',
      'businessContext.attributes',
      {
        attributes: [
          {
            attributeKey: 'has_wheelchair_accessible_entrance',
            attributeName: 'Wheelchair accessible entrance',
            attributeId: 'attributes/foo',
            valueType: 'BOOL',
            boolValue: false,
            textValue: null,
            uriValue: null,
            uriValues: [],
            enumValues: [],
            unsetEnumValues: [],
          },
        ],
      },
      {
        attributes: [
          {
            attributeKey: 'has_wheelchair_accessible_entrance',
            attributeName: 'Wheelchair accessible entrance',
            attributeId: 'attributes/foo',
            valueType: 'BOOL',
            boolValue: true,
            textValue: null,
            uriValue: null,
            uriValues: [],
            enumValues: [],
            unsetEnumValues: [],
          },
        ],
      },
    );
    getRestaurantBusinessContextMock.mockResolvedValue({
      core: {
        categories: [],
        serviceAreas: [],
        attributes: [
          {
            id: 'attr-1',
            attributeGroup: 'accessibility',
            attributeKey: 'has_wheelchair_accessible_entrance',
            attributeName: 'Wheelchair accessible entrance',
            attributeId: 'attributes/foo',
            displayName: 'Wheelchair accessible entrance',
            displayText: 'Yes',
            displayTextStandalone: null,
            displayTextNegative: null,
            valueType: 'BOOL',
            boolValue: false,
            textValue: null,
            uriValue: null,
            uriValues: [],
            enumValues: [],
            unsetEnumValues: [],
            rawValue: null,
            rawEnumValues: null,
            displayValue: null,
            valueMetadata: [],
            source: 'core',
            managedBy: 'core',
            updatedAt: null,
          },
        ],
        serviceItems: [],
        links: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        links: [],
      },
    });

    const result = await applyBusinessContextAttributeImportToCore(ctx);
    const [, payload] = updateRestaurantBusinessContextMock.mock.calls[0] ?? [];
    const updatedRow = payload?.attributes?.[0];
    expect(updatedRow).toEqual(
      expect.objectContaining({
        id: 'attr-1',
        attributeGroup: 'accessibility',
        boolValue: true,
        displayText: 'Yes', // preserved from existing core
      }),
    );
    expect(result.status).toBe('succeeded');
  });
});

describe('applyBusinessContextServiceItemImportToCore', () => {
  it('imports a service item by itemKey', async () => {
    const ctx = makeCtx(
      'businessContext.serviceItems.brunch-deal',
      'businessContext.serviceItems',
      {
        serviceItems: [
          {
            itemKey: 'brunch-deal',
            itemType: 'structured',
            displayName: 'Brunch deal',
            description: null,
            payload: null,
          },
        ],
      },
      {
        serviceItems: [
          {
            itemKey: 'brunch-deal',
            itemType: 'structured',
            displayName: 'Brunch deal — updated',
            description: 'Sat & Sun mornings',
            payload: { google: 'data' },
          },
        ],
      },
    );
    getRestaurantBusinessContextMock.mockResolvedValue({
      core: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [
          {
            id: 'si-1',
            itemKey: 'brunch-deal',
            itemType: 'structured',
            displayName: 'Brunch deal',
            description: null,
            payload: null,
            source: 'core',
            managedBy: 'core',
            updatedAt: null,
          },
        ],
        links: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        links: [],
      },
    });

    const result = await applyBusinessContextServiceItemImportToCore(ctx);
    const [, payload] = updateRestaurantBusinessContextMock.mock.calls[0] ?? [];
    const updatedRow = payload?.serviceItems?.[0];
    expect(updatedRow).toEqual(
      expect.objectContaining({
        id: 'si-1',
        displayName: 'Brunch deal — updated',
        description: 'Sat & Sun mornings',
        payload: { google: 'data' },
      }),
    );
    expect(result.status).toBe('succeeded');
  });
});
