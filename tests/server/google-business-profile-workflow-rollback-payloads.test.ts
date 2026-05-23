import { describe, expect, it } from 'vitest';

import {
  buildFailedPublishErrors,
  restoreBusinessContextPayload,
  restoreOperatingHoursPayload,
  restoreProfilePayload,
  restoreServicePeriodsPayload,
} from '@/server/google-business-profile/workflowRollbackPayloads';

import type { RestaurantBusinessContextSnapshot } from '@/server/restaurants/businessContext';
import type { RestaurantDetails } from '@/server/restaurants/details';
import type { OperatingHoursSnapshot } from '@/server/restaurants/operatingHours';
import type { ServicePeriod } from '@/server/restaurants/servicePeriods';

describe('google business profile workflow rollback payload helpers', () => {
  it('builds restaurant profile restore payloads from profile snapshots', () => {
    const profile: RestaurantDetails = {
      restaurantId: 'rest-1',
      name: 'Before',
      slug: 'before',
      timezone: 'Europe/London',
      capacity: 48,
      contactEmail: 'before@example.com',
      contactPhone: '02070000000',
      address: '1 Before Street',
      businessDescription: 'Original description',
      managerDailySummaryEnabled: true,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: 'https://reviews.example.com',
      bookingPolicy: 'Original policy',
      logoUrl: 'https://cdn.example.com/logo.png',
      updatedAt: '2026-05-20T10:00:00.000Z',
    };

    expect(restoreProfilePayload(profile)).toEqual({
      name: 'Before',
      slug: 'before',
      timezone: 'Europe/London',
      capacity: 48,
      contactEmail: 'before@example.com',
      contactPhone: '02070000000',
      address: '1 Before Street',
      managerDailySummaryEnabled: true,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: 'https://reviews.example.com',
      bookingPolicy: 'Original policy',
      logoUrl: 'https://cdn.example.com/logo.png',
    });
  });

  it('clones operating hours restore payload arrays', () => {
    const operatingHours: OperatingHoursSnapshot = {
      weekly: [
        {
          dayOfWeek: 1,
          opensAt: '09:00',
          closesAt: '17:00',
          isClosed: false,
          reservationIntervalMinutes: 15,
          reservationSlotTimes: null,
        },
      ],
      overrides: [
        {
          effectiveDate: '2026-05-21',
          opensAt: null,
          closesAt: null,
          isClosed: true,
          notes: 'Closed',
          reservationIntervalMinutes: null,
          reservationSlotTimes: null,
        },
      ],
    };

    const payload = restoreOperatingHoursPayload(operatingHours);
    expect(payload).toEqual(operatingHours);
    expect(payload.weekly[0]).not.toBe(operatingHours.weekly[0]);
    expect(payload.overrides[0]).not.toBe(operatingHours.overrides[0]);
  });

  it('strips service-period snapshot metadata from restore payloads', () => {
    const servicePeriods: ServicePeriod[] = [
      {
        id: 'period-1',
        name: 'Lunch',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '14:00',
        bookingOption: 'lunch',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    ];

    expect(restoreServicePeriodsPayload(servicePeriods)).toEqual([
      {
        id: 'period-1',
        name: 'Lunch',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '14:00',
        bookingOption: 'lunch',
      },
    ]);
  });

  it('builds business-context restore payloads for selected sections only', () => {
    const businessContext = {
      core: {
        categories: [{ id: 'cat-1', displayName: 'Restaurant' }],
        serviceAreas: [{ id: 'area-1', label: 'Central' }],
        attributes: [{ id: 'attr-1', label: 'Outdoor seating' }],
        serviceItems: [{ id: 'service-1', name: 'Delivery' }],
      },
    } as unknown as RestaurantBusinessContextSnapshot;

    expect(
      restoreBusinessContextPayload(
        businessContext,
        new Set(['businessContext.categories', 'businessContext.serviceItems']),
      ),
    ).toEqual({
      categories: [{ id: 'cat-1', displayName: 'Restaurant' }],
      serviceItems: [{ id: 'service-1', name: 'Delivery' }],
    });
  });

  it('formats failed publish errors with rollback details', () => {
    expect(
      buildFailedPublishErrors({
        publishError: { details: 'service update failed' },
        rollback: { status: 'failed', errors: ['profile: restore failed'] },
      }),
    ).toEqual([
      {
        message: 'service update failed',
        rollback: { status: 'failed', errors: ['profile: restore failed'] },
      },
    ]);
  });
});
