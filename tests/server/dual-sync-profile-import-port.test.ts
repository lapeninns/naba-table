import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateRestaurantDetailsMock = vi.hoisted(() => vi.fn());
const getRestaurantDetailsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/details', () => ({
  updateRestaurantDetails: updateRestaurantDetailsMock,
  getRestaurantDetails: getRestaurantDetailsMock,
}));

import { applyProfileImportToCore } from '@/server/dual-sync/publish/ports/profile-import';
import type { DualSyncOperationContext } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

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

  it('imports the Google Maps URL', async () => {
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

    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({
        googleMapUrl: 'https://maps.google.com/?cid=1',
      }),
      client,
    );
    expect(result.status).toBe('succeeded');
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
