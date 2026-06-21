import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyProfileImportToCore } from '@/server/dual-sync/publish/ports/profile-import';

import type { DualSyncOperationContext } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const updateRestaurantDetailsMock = vi.hoisted(() => vi.fn());
const getRestaurantDetailsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/details', () => ({
  updateRestaurantDetails: updateRestaurantDetailsMock,
  getRestaurantDetails: getRestaurantDetailsMock,
}));

const RESTAURANT_ID = 'rest-1';
const fromMock = vi.fn();
const client = { from: fromMock } as unknown as SupabaseClient<Database>;

function mockDeleteChain(error: Error | null = null) {
  const chain = {
    error,
    delete: vi.fn(),
    eq: vi.fn(),
  };
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  fromMock.mockReturnValueOnce(chain);
  return chain;
}

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: '+15551234567',
      address: '1 Main',
      storefrontAddress: null,
      googleMapUrl: 'https://maps.google.com/?cid=1',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=abc',
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    ...over,
  };
}

function makeCtx(over: Partial<DualSyncOperationContext> = {}): DualSyncOperationContext {
  const core = makeSnapshot({
    profile: {
      name: 'Old Name',
      businessDescription: 'Old desc',
      contactPhone: '+15550000000',
      address: 'Old address',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
  });
  const gbp = makeSnapshot();
  return {
    client,
    restaurantId: RESTAURANT_ID,
    publishJobId: 'job-1',
    decision: {
      fieldKey: 'profile.businessDescription',
      sectionKey: 'profile',
      action: 'import_from_google',
      pinnedCoreHash: null,
      pinnedGbpHash: null,
    },
    coreSnapshot: core,
    gbpSnapshot: gbp,
    actorUserId: null,
    ...over,
  };
}

describe('applyProfileImportToCore', () => {
  beforeEach(() => {
    updateRestaurantDetailsMock.mockReset();
    getRestaurantDetailsMock.mockReset();
    fromMock.mockReset();
    getRestaurantDetailsMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      name: 'Old Name',
      slug: 'acme',
      timezone: 'America/Los_Angeles',
      capacity: 40,
      contactEmail: 'ops@acme.com',
      contactPhone: '+15550000000',
      address: 'Old address',
      businessDescription: 'Old desc',
      managerDailySummaryEnabled: false,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      bookingPolicy: null,
      logoUrl: null,
      updatedAt: null,
    });
    updateRestaurantDetailsMock.mockResolvedValue({});
  });

  it('writes the imported business description and returns succeeded', async () => {
    const result = await applyProfileImportToCore(makeCtx());

    expect(updateRestaurantDetailsMock).toHaveBeenCalledTimes(1);
    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({
        timezone: 'America/Los_Angeles',
        businessDescription: 'Tasty',
      }),
      client,
    );
    expect(result.status).toBe('succeeded');
    expect(result.afterCoreHash).toBeTruthy();
  });

  it('imports the business name', async () => {
    const result = await applyProfileImportToCore(
      makeCtx({
        decision: {
          fieldKey: 'profile.name',
          sectionKey: 'profile',
          action: 'import_from_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );

    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({ name: 'Acme', timezone: 'America/Los_Angeles' }),
      client,
    );
    expect(result.status).toBe('succeeded');
  });

  it('imports the contact phone', async () => {
    const deleteChain = mockDeleteChain();
    const result = await applyProfileImportToCore(
      makeCtx({
        decision: {
          fieldKey: 'profile.contactPhone',
          sectionKey: 'profile',
          action: 'import_from_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );

    expect(fromMock).toHaveBeenCalledWith('restaurant_phone_numbers');
    expect(deleteChain.delete).toHaveBeenCalledTimes(1);
    expect(deleteChain.eq.mock.calls).toEqual([
      ['restaurant_id', RESTAURANT_ID],
      ['source', 'nabatable'],
      ['managed_by', 'nabatable'],
      ['phone_kind', 'primary'],
    ]);
    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({
        contactPhone: '+15551234567',
        timezone: 'America/Los_Angeles',
      }),
      client,
    );
    expect(result.status).toBe('succeeded');
  });

  it('clears the Nabatable storefront address projection when importing address', async () => {
    const deleteChain = mockDeleteChain();
    const result = await applyProfileImportToCore(
      makeCtx({
        decision: {
          fieldKey: 'profile.address',
          sectionKey: 'profile',
          action: 'import_from_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );

    expect(fromMock).toHaveBeenCalledWith('restaurant_addresses');
    expect(deleteChain.eq.mock.calls).toEqual([
      ['restaurant_id', RESTAURANT_ID],
      ['source', 'nabatable'],
      ['managed_by', 'nabatable'],
      ['address_type', 'storefront'],
    ]);
    expect(result.status).toBe('succeeded');
  });

  it('imports the Google Maps URL', async () => {
    const deleteChain = mockDeleteChain();
    const result = await applyProfileImportToCore(
      makeCtx({
        decision: {
          fieldKey: 'profile.googleMapUrl',
          sectionKey: 'profile',
          action: 'import_from_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );

    expect(fromMock).toHaveBeenCalledWith('restaurant_links');
    expect(deleteChain.eq.mock.calls).toEqual([
      ['restaurant_id', RESTAURANT_ID],
      ['source', 'nabatable'],
      ['managed_by', 'nabatable'],
      ['link_type', 'google_map'],
      ['link_status', 'current'],
    ]);
    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({
        googleMapUrl: 'https://maps.google.com/?cid=1',
      }),
      client,
    );
    expect(result.status).toBe('succeeded');
  });

  it('returns a retryable failure when projection cleanup fails', async () => {
    mockDeleteChain(new Error('delete failed'));
    const result = await applyProfileImportToCore(
      makeCtx({
        decision: {
          fieldKey: 'profile.googleReviewUrl',
          sectionKey: 'profile',
          action: 'import_from_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );

    expect(updateRestaurantDetailsMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('failed');
    expect(result.failure).toEqual(
      expect.objectContaining({
        code: 'PORT_FAILURE',
        retryable: true,
      }),
    );
  });

  it('rejects non-profile field keys with PORT_FAILURE', async () => {
    const result = await applyProfileImportToCore(
      makeCtx({
        decision: {
          fieldKey: 'operatingHours.weekly.0',
          sectionKey: 'operatingHours',
          action: 'import_from_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );

    expect(updateRestaurantDetailsMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('PORT_FAILURE');
  });
});
