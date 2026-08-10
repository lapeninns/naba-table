import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDualSyncRestaurantControlMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/controls', () => ({
  getDualSyncRestaurantControl: getDualSyncRestaurantControlMock,
}));

import { resetEnvCache } from '@/lib/env';
import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import { readPublishPlannerRuntime } from '@/server/dual-sync/publish/planner-runtime';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = {} as SupabaseClient<Database>;

function snapshot(overrides: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: '+44 1223 123456',
      address: '1 Main Street',
      storefrontAddress: null,
      googleMapUrl: 'https://maps.example/acme',
      googleReviewUrl: 'https://reviews.example/acme',
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    foodMenus: { items: [] },
    ...overrides,
  };
}

beforeEach(() => {
  delete process.env.GBP_EXPORT_ENABLED;
  resetEnvCache();
  getDualSyncRestaurantControlMock.mockReset();
  getDualSyncRestaurantControlMock.mockResolvedValue({
    restaurantId: 'rest-1',
    provider: 'google_business_profile',
    syncPaused: false,
    pauseReason: null,
    pausedByUserId: null,
    pausedAt: null,
    resumedAt: null,
    createdAt: null,
    updatedAt: null,
  });
});

describe('readPublishPlannerRuntime', () => {
  it('reads injected snapshots, hashes them, builds the registry, flags, and control state', async () => {
    process.env.GBP_EXPORT_ENABLED = 'false';
    const coreSnapshot = snapshot({
      profile: { ...snapshot().profile, businessDescription: 'Core' },
    });
    const gbpSnapshot = snapshot({
      profile: { ...snapshot().profile, businessDescription: 'Google' },
    });
    const readCoreSnapshot = vi.fn(async () => coreSnapshot);
    const readGbpSnapshot = vi.fn(async () => gbpSnapshot);

    const runtime = await readPublishPlannerRuntime({
      client,
      restaurantId: 'rest-1',
      options: {
        readCoreSnapshot,
        readGbpSnapshot,
      },
    });

    expect(readCoreSnapshot).toHaveBeenCalledWith({ client, restaurantId: 'rest-1' });
    expect(readGbpSnapshot).toHaveBeenCalledWith({ client, restaurantId: 'rest-1' });
    expect(getDualSyncRestaurantControlMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
    });
    expect(runtime.coreSnapshotHash).toBe(hashCanonicalJson(coreSnapshot));
    expect(runtime.gbpSnapshotHash).toBe(hashCanonicalJson(gbpSnapshot));
    expect(runtime.registry.some((field) => field.fieldKey === 'profile.businessDescription')).toBe(
      true,
    );
    expect(runtime.runtimeControls.exportEnabled).toBe(false);
    expect(runtime.control.syncPaused).toBe(false);
  });
});
