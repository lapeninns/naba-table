import { describe, expect, it, vi } from 'vitest';

const updateRestaurantDetailsMock = vi.hoisted(() => vi.fn());
const updateOperatingHoursMock = vi.hoisted(() => vi.fn());
const updateServicePeriodsMock = vi.hoisted(() => vi.fn());
const updateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/details', () => ({
  getRestaurantDetails: vi.fn(),
  updateRestaurantDetails: updateRestaurantDetailsMock,
}));

vi.mock('@/server/restaurants/operatingHours', () => ({
  getOperatingHours: vi.fn(),
  updateOperatingHours: updateOperatingHoursMock,
}));

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: vi.fn(),
  updateServicePeriods: updateServicePeriodsMock,
}));

vi.mock('@/server/restaurants/businessContext', () => ({
  getRestaurantBusinessContext: vi.fn(),
  updateRestaurantBusinessContext: updateRestaurantBusinessContextMock,
}));

import {
  googleBusinessProfileWorkflowTestUtils,
  type GoogleBusinessProfileWorkflowDraft,
} from '@/server/google-business-profile/workflow';

import type { RestaurantBusinessContextSnapshot } from '@/server/restaurants/businessContext';

function buildRollbackDraft(): GoogleBusinessProfileWorkflowDraft {
  return {
    sectionDiffs: [
      {
        sectionKey: 'profile',
        items: [
          {
            sectionKey: 'profile',
            fieldKey: 'profile.name',
            selected: true,
            canPublishToNabatable: true,
          },
        ],
      },
      {
        sectionKey: 'operatingHours',
        items: [
          {
            sectionKey: 'operatingHours',
            fieldKey: 'operatingHours.weekly.1',
            selected: true,
            canPublishToNabatable: true,
          },
        ],
      },
      {
        sectionKey: 'servicePeriods',
        items: [
          {
            sectionKey: 'servicePeriods',
            fieldKey: 'servicePeriods.1.lunch',
            selected: true,
            canPublishToNabatable: true,
          },
        ],
      },
      {
        sectionKey: 'businessContext.categories',
        items: [
          {
            sectionKey: 'businessContext.categories',
            fieldKey: 'businessContext.categories',
            selected: true,
            canPublishToNabatable: true,
          },
        ],
      },
    ],
  } as GoogleBusinessProfileWorkflowDraft;
}

function buildBusinessContext(): RestaurantBusinessContextSnapshot {
  return {
    core: {
      categories: [
        {
          id: 'cat-1',
          displayName: 'Restaurant',
          categoryCode: 'gcid:restaurant',
          moreHoursTypes: [],
          isPrimary: true,
          source: 'nabatable',
          managedBy: 'nabatable',
          updatedAt: '2026-04-25T09:00:00.000Z',
        },
      ],
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
  };
}

describe('google business profile workflow rollback helpers', () => {
  it('recognizes duplicate idempotency-key failures as unique constraint races', () => {
    expect(
      googleBusinessProfileWorkflowTestUtils.isUniqueConstraintError({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe(true);
    expect(
      googleBusinessProfileWorkflowTestUtils.isUniqueConstraintError({
        message: 'network unavailable',
      }),
    ).toBe(false);
  });

  it('restores selected core sections from the pre-publish snapshot', async () => {
    updateRestaurantDetailsMock.mockResolvedValue(undefined);
    updateOperatingHoursMock.mockResolvedValue(undefined);
    updateServicePeriodsMock.mockResolvedValue(undefined);
    updateRestaurantBusinessContextMock.mockResolvedValue(undefined);

    const rollback =
      await googleBusinessProfileWorkflowTestUtils.restoreCoreSnapshotAfterFailedPublish({
        restaurantId: 'rest-1',
        draft: buildRollbackDraft(),
        snapshot: {
          profile: {
            restaurantId: 'rest-1',
            name: 'Before',
            slug: 'before',
            timezone: 'Europe/London',
            capacity: 48,
            contactEmail: 'ops@example.com',
            contactPhone: null,
            address: '1 Test Street',
            managerDailySummaryEnabled: false,
            managerNotificationPhone: null,
            googleMapUrl: null,
            googleReviewUrl: null,
            bookingPolicy: null,
            logoUrl: null,
            updatedAt: '2026-04-25T09:00:00.000Z',
          },
          operatingHours: {
            restaurantId: 'rest-1',
            timezone: 'Europe/London',
            updatedAt: '2026-04-25T09:00:00.000Z',
            weekly: [
              {
                dayOfWeek: 1,
                opensAt: '09:00',
                closesAt: '17:00',
                isClosed: false,
                notes: null,
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
              updatedAt: '2026-04-25T09:00:00.000Z',
            },
          ],
          businessContext: buildBusinessContext(),
        },
        client: {} as never,
      });

    expect(rollback).toEqual({ status: 'restored', errors: [] });
    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(
      'rest-1',
      expect.objectContaining({ name: 'Before', googleMapUrl: null, googleReviewUrl: null }),
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
      { categories: buildBusinessContext().core.categories },
      {},
    );
  });

  it('records rollback section failures without hiding the original publish error', () => {
    const errors = googleBusinessProfileWorkflowTestUtils.buildFailedPublishErrors({
      publishError: new Error('core update failed'),
      rollback: { status: 'failed', errors: ['servicePeriods: restore failed'] },
    });

    expect(errors).toEqual([
      {
        message: 'core update failed',
        rollback: { status: 'failed', errors: ['servicePeriods: restore failed'] },
      },
    ]);
  });
});
