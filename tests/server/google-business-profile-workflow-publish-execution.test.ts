import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateRestaurantDetailsMock = vi.hoisted(() => vi.fn());
const updateOperatingHoursMock = vi.hoisted(() => vi.fn());
const updateServicePeriodsMock = vi.hoisted(() => vi.fn());
const updateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/details', () => ({
  updateRestaurantDetails: updateRestaurantDetailsMock,
}));

vi.mock('@/server/restaurants/operatingHours', () => ({
  updateOperatingHours: updateOperatingHoursMock,
}));

vi.mock('@/server/restaurants/servicePeriods', () => ({
  updateServicePeriods: updateServicePeriodsMock,
}));

vi.mock('@/server/restaurants/businessContext', () => ({
  updateRestaurantBusinessContext: updateRestaurantBusinessContextMock,
}));

import {
  pushDraftToGoogle,
  restoreCoreSnapshotAfterFailedPublish,
} from '@/server/google-business-profile/workflowPublishExecution';

import type { GoogleBusinessProfileWorkflowDraft } from '@/server/google-business-profile/workflow';
import type { GoogleBusinessProfileWorkflowCoreSnapshots } from '@/server/google-business-profile/workflowDraftSections';

function buildItem(sectionKey: string, fieldKey: string) {
  return {
    sectionKey,
    fieldKey,
    label: fieldKey,
    status: 'ready',
    selected: true,
    nabatableValueHash: `${fieldKey}:nabatable`,
    googleValueHash: `${fieldKey}:google`,
    capabilities: {
      canImportFromGoogle: true,
      canExportToGoogle: true,
      canIgnore: true,
    },
    canPublishToNabatable: true,
    canPushToGoogle: true,
  };
}

function buildDraft(): GoogleBusinessProfileWorkflowDraft {
  return {
    id: 'draft-1',
    sectionDiffs: [
      {
        sectionKey: 'profile',
        items: [buildItem('profile', 'profile.name')],
      },
      {
        sectionKey: 'operatingHours',
        items: [buildItem('operatingHours', 'operatingHours.weekly.1')],
      },
      {
        sectionKey: 'servicePeriods',
        items: [buildItem('servicePeriods', 'servicePeriods.1.lunch')],
      },
      {
        sectionKey: 'businessContext.categories',
        items: [buildItem('businessContext.categories', 'businessContext.categories')],
      },
    ],
    coreSnapshotHashes: {},
  } as unknown as GoogleBusinessProfileWorkflowDraft;
}

function buildSnapshot(): GoogleBusinessProfileWorkflowCoreSnapshots {
  return {
    profile: {
      restaurantId: 'rest-1',
      name: 'Before',
      slug: 'before',
      timezone: 'Europe/London',
      capacity: 40,
      contactEmail: 'before@example.com',
      contactPhone: '02070000000',
      address: '1 Before Street',
      businessDescription: null,
      managerDailySummaryEnabled: false,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      bookingPolicy: null,
      logoUrl: null,
      updatedAt: '2026-05-20T10:00:00.000Z',
    },
    operatingHours: {
      weekly: [
        {
          dayOfWeek: 1,
          opensAt: '09:00',
          closesAt: '17:00',
          isClosed: false,
          reservationIntervalMinutes: null,
          reservationSlotTimes: null,
        },
      ],
      overrides: [],
    },
    servicePeriods: [
      {
        id: 'period-1',
        name: 'Lunch',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '14:00',
        bookingOption: 'lunch',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    ],
    businessContext: {
      core: {
        categories: [{ id: 'cat-1', displayName: 'Restaurant' }],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    } as unknown as GoogleBusinessProfileWorkflowCoreSnapshots['businessContext'],
  };
}

describe('google business profile workflow publish execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores selected core sections from the pre-publish snapshot', async () => {
    updateRestaurantDetailsMock.mockResolvedValue(undefined);
    updateOperatingHoursMock.mockResolvedValue(undefined);
    updateServicePeriodsMock.mockResolvedValue(undefined);
    updateRestaurantBusinessContextMock.mockResolvedValue(undefined);

    const rollback = await restoreCoreSnapshotAfterFailedPublish({
      restaurantId: 'rest-1',
      draft: buildDraft(),
      snapshot: buildSnapshot(),
      client: {} as never,
    });

    expect(rollback).toEqual({ status: 'restored', errors: [] });
    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(
      'rest-1',
      expect.objectContaining({ name: 'Before', timezone: 'Europe/London' }),
      {},
    );
    expect(updateOperatingHoursMock).toHaveBeenCalledWith(
      'rest-1',
      expect.objectContaining({ weekly: expect.any(Array), overrides: [] }),
      {},
    );
    expect(updateServicePeriodsMock).toHaveBeenCalledWith(
      'rest-1',
      [
        {
          id: 'period-1',
          name: 'Lunch',
          dayOfWeek: 1,
          startTime: '12:00',
          endTime: '14:00',
          bookingOption: 'lunch',
        },
      ],
      {},
    );
    expect(updateRestaurantBusinessContextMock).toHaveBeenCalledWith(
      'rest-1',
      { categories: [{ id: 'cat-1', displayName: 'Restaurant' }] },
      {},
    );
  });

  it('returns rollback errors without stopping later restore attempts', async () => {
    updateRestaurantDetailsMock.mockRejectedValue(new Error('profile restore failed'));
    updateOperatingHoursMock.mockResolvedValue(undefined);
    updateServicePeriodsMock.mockResolvedValue(undefined);
    updateRestaurantBusinessContextMock.mockResolvedValue(undefined);

    const rollback = await restoreCoreSnapshotAfterFailedPublish({
      restaurantId: 'rest-1',
      draft: buildDraft(),
      snapshot: buildSnapshot(),
      client: {} as never,
    });

    expect(rollback).toEqual({
      status: 'failed',
      errors: ['profile: profile restore failed'],
    });
    expect(updateOperatingHoursMock).toHaveBeenCalled();
    expect(updateServicePeriodsMock).toHaveBeenCalled();
    expect(updateRestaurantBusinessContextMock).toHaveBeenCalled();
  });

  it('skips Google push execution when no update masks are selected', async () => {
    await expect(
      pushDraftToGoogle({
        restaurantId: 'rest-1',
        draft: buildDraft(),
        externalProfile: null,
        actorUserId: 'user-1',
        googleUpdateMasks: [],
        client: {} as never,
      }),
    ).resolves.toBeNull();
  });

  it('blocks Google push execution when profile writes are disabled', async () => {
    await expect(
      pushDraftToGoogle({
        restaurantId: 'rest-1',
        draft: buildDraft(),
        externalProfile: { push_enabled: false } as never,
        actorUserId: 'user-1',
        googleUpdateMasks: ['title'],
        client: {} as never,
      }),
    ).rejects.toMatchObject({ name: 'GBP_GOOGLE_PUSH_DISABLED' });
  });
});
