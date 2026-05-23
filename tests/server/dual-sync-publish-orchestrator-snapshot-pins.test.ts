import { beforeEach, describe, expect, it, vi } from 'vitest';

const updatePublishBatchStatusMock = vi.hoisted(() => vi.fn());
const recomputeAllStatesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/operations', () => ({
  updatePublishBatchStatus: updatePublishBatchStatusMock,
}));

vi.mock('@/server/dual-sync/state/recompute', () => ({
  recomputeAllStates: recomputeAllStatesMock,
}));

import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import { rejectStaleSnapshotPins } from '@/server/dual-sync/publish/orchestrator-snapshot-pins';

import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Fresh food',
      contactPhone: null,
      address: '1 Main Street',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: {
      weekly: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '17:00', isClosed: false }],
    },
    servicePeriods: {
      periods: [
        {
          stableKey: 'period-1',
          name: 'Dinner',
          dayOfWeek: 1,
          startTime: '17:00',
          endTime: '22:00',
          bookingOption: 'available',
        },
      ],
    },
    businessContext: {
      categories: [
        {
          displayName: 'Restaurant',
          categoryCode: 'gcid:restaurant',
          moreHoursTypes: [],
          isPrimary: true,
        },
      ],
      serviceAreas: [
        {
          displayName: 'Leeds',
          areaType: 'LOCALITY',
          regionCode: 'GB',
          placeData: null,
        },
      ],
      attributes: [
        {
          attributeKey: 'has_takeout',
          attributeName: 'Takeout',
          attributeId: 'has_takeout',
          valueType: 'BOOL',
          boolValue: true,
          textValue: null,
          uriValue: null,
          uriValues: [],
          enumValues: [],
          unsetEnumValues: [],
        },
      ],
      serviceItems: [
        {
          itemKey: 'svc-1',
          itemType: 'structured_service_item',
          displayName: 'Delivery',
          description: null,
          payload: null,
        },
      ],
    },
    foodMenus: {
      items: [
        {
          stableKey: 'item-1',
          itemName: 'Burger',
          sectionLabel: 'Mains',
          description: null,
          basePrice: 12,
          currency: 'GBP',
          dietaryTags: [],
          allergensContains: [],
          googlePath: null,
        },
      ],
    },
    ...overrides,
  };
}

function decision(overrides: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision {
  return {
    fieldKey: 'profile.businessDescription',
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: 'core-field-hash',
    pinnedGbpHash: 'gbp-field-hash',
    ...overrides,
  };
}

function input(
  overrides: Partial<Parameters<typeof rejectStaleSnapshotPins>[0]> = {},
): Parameters<typeof rejectStaleSnapshotPins>[0] {
  const coreSnapshot = overrides.coreSnapshot ?? makeSnapshot();
  const gbpSnapshot =
    overrides.gbpSnapshot ??
    makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Fresh food on Google',
      },
    });
  return {
    client,
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    publishBatchId: 'batch-1',
    decisions: [decision(), decision({ fieldKey: 'operatingHours.weekly.1' })],
    pinnedCoreSnapshotHash: hashCanonicalJson(coreSnapshot),
    pinnedGbpSnapshotHash: hashCanonicalJson(gbpSnapshot),
    coreSnapshot,
    gbpSnapshot,
    ...overrides,
  };
}

describe('rejectStaleSnapshotPins', () => {
  beforeEach(() => {
    updatePublishBatchStatusMock.mockReset();
    updatePublishBatchStatusMock.mockResolvedValue(null);
    recomputeAllStatesMock.mockReset();
    recomputeAllStatesMock.mockResolvedValue(null);
  });

  it('returns null without touching state when supplied snapshot pins still match', async () => {
    const result = await rejectStaleSnapshotPins(input());

    expect(result).toBeNull();
    expect(updatePublishBatchStatusMock).not.toHaveBeenCalled();
    expect(recomputeAllStatesMock).not.toHaveBeenCalled();
  });

  it('returns null when snapshot pins are omitted', async () => {
    const result = await rejectStaleSnapshotPins(
      input({ pinnedCoreSnapshotHash: null, pinnedGbpSnapshotHash: undefined }),
    );

    expect(result).toBeNull();
    expect(updatePublishBatchStatusMock).not.toHaveBeenCalled();
    expect(recomputeAllStatesMock).not.toHaveBeenCalled();
  });

  it('marks the publish batch stale and fans out failures when the core snapshot moved', async () => {
    const result = await rejectStaleSnapshotPins(input({ pinnedCoreSnapshotHash: 'stale-core' }));

    expect(updatePublishBatchStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        publishBatchId: 'batch-1',
        status: 'stale',
        errorCode: 'CORE_DRIFT',
        errorMessage: 'Core snapshot moved since the operator viewed the diff.',
        finishedAt: expect.any(String),
      }),
    );
    expect(recomputeAllStatesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        coreSnapshot: expect.any(Object),
        gbpSnapshot: expect.any(Object),
      }),
    );
    expect(result).toMatchObject({
      publishJobId: 'job-1',
      restaurantId: 'rest-1',
      totalDecisions: 2,
      operations: [],
      failures: [
        {
          fieldKey: 'profile.businessDescription',
          failure: {
            code: 'CORE_DRIFT',
            message: 'Core snapshot moved since the operator viewed the diff.',
            retryable: false,
          },
        },
        {
          fieldKey: 'operatingHours.weekly.1',
          failure: {
            code: 'CORE_DRIFT',
            message: 'Core snapshot moved since the operator viewed the diff.',
            retryable: false,
          },
        },
      ],
    });
  });

  it('checks the Google pin after a matching core pin and rejects Google drift', async () => {
    const result = await rejectStaleSnapshotPins(input({ pinnedGbpSnapshotHash: 'stale-gbp' }));

    expect(updatePublishBatchStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'stale',
        errorCode: 'GBP_DRIFT',
        errorMessage: 'Google snapshot moved since the operator viewed the diff.',
      }),
    );
    expect(recomputeAllStatesMock).toHaveBeenCalledTimes(1);
    expect(result?.failures).toHaveLength(2);
    expect(result?.failures[0]?.failure).toEqual({
      code: 'GBP_DRIFT',
      message: 'Google snapshot moved since the operator viewed the diff.',
      retryable: false,
    });
  });
});
