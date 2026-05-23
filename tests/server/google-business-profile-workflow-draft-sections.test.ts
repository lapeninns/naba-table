import { describe, expect, it } from 'vitest';

import {
  buildBusinessContextSection,
  buildDraftSections,
  buildOperatingHoursSection,
  buildProfileSection,
  buildServicePeriodsSection,
} from '@/server/google-business-profile/workflowDraftSections';

import type { GoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';
import type { GoogleBusinessProfileWorkflowCoreSnapshots } from '@/server/google-business-profile/workflowDraftSections';

function buildCore(): GoogleBusinessProfileWorkflowCoreSnapshots {
  return {
    profile: {
      restaurantId: 'rest-1',
      name: 'Nabatable Name',
      slug: 'nabatable-name',
      timezone: 'Europe/London',
      capacity: 40,
      contactEmail: 'hello@example.com',
      contactPhone: '02070000000',
      address: '1 Nabatable Street',
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
    },
    servicePeriods: [
      {
        id: 'period-1',
        name: 'Dinner',
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '22:00',
        bookingOption: 'dinner',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    ],
    businessContext: {
      core: {
        categories: [{ id: 'cat-1', displayName: 'Restaurant', isPrimary: true }],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
      providerSnapshot: {
        categories: [{ id: 'provider-cat-1', displayName: 'Nepalese restaurant', isPrimary: true }],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    } as unknown as GoogleBusinessProfileWorkflowCoreSnapshots['businessContext'],
  };
}

function buildBusinessInfo(): GoogleBusinessProfileBusinessInfo {
  return {
    details: {
      businessName: 'Google Name',
    },
    phoneNumbers: [
      { phoneNumber: '02071111111', isPrimary: true },
      { phoneNumber: '02072222222', isPrimary: false },
    ],
    addresses: [{ formattedAddress: '1 Google Street', isPrimary: true }],
    links: [
      { linkType: 'google_map', url: 'https://maps.example.com', isPrimary: true },
      { linkType: 'google_review', url: 'https://reviews.example.com', isPrimary: true },
    ],
    coreNormalization: {
      operatingHours: {
        weekly: [
          {
            dayOfWeek: 1,
            opensAt: '10:00',
            closesAt: '18:00',
            isClosed: false,
          },
        ],
        overrides: [
          {
            effectiveDate: '2026-05-21',
            opensAt: '12:00',
            closesAt: '16:00',
            isClosed: false,
          },
        ],
        warnings: ['Hours warning'],
      },
      servicePeriods: {
        periods: [
          {
            name: 'Dinner',
            dayOfWeek: 1,
            startTime: '18:30',
            endTime: '22:30',
            bookingOption: 'dinner',
          },
          {
            name: 'All day',
            dayOfWeek: null,
            startTime: '10:00',
            endTime: '22:00',
            bookingOption: 'all_day',
          },
        ],
        warnings: ['Service warning'],
      },
    },
  } as unknown as GoogleBusinessProfileBusinessInfo;
}

describe('google business profile workflow draft section builders', () => {
  it('builds profile sections from primary Google profile values', () => {
    const section = buildProfileSection(buildCore(), buildBusinessInfo(), null);

    expect(section.sectionKey).toBe('profile');
    expect(section.status).toBe('ready');
    expect(section.items.map((item) => [item.fieldKey, item.providerValue])).toEqual([
      ['profile.name', 'Google Name'],
      ['profile.contactPhone', '02071111111'],
      ['profile.address', '1 Google Street'],
      ['profile.googleMapUrl', 'https://maps.example.com'],
      ['profile.googleReviewUrl', 'https://reviews.example.com'],
    ]);
    expect(section.items.find((item) => item.fieldKey === 'profile.address')?.canPushToGoogle).toBe(
      false,
    );
  });

  it('builds operating-hours sections from normalized weekly and special hours', () => {
    const section = buildOperatingHoursSection(buildCore(), buildBusinessInfo());

    expect(
      section.items.map((item) => [item.fieldKey, item.currentValue, item.providerValue]),
    ).toEqual([
      ['operatingHours.weekly.1', '09:00-17:00', '10:00-18:00'],
      ['operatingHours.override.2026-05-21', 'Closed', '12:00-16:00'],
    ]);
    expect(section.items.every((item) => item.warnings.includes('Hours warning'))).toBe(true);
  });

  it('builds service-period sections for syncable day and booking option pairs', () => {
    const section = buildServicePeriodsSection(buildCore(), buildBusinessInfo(), false);

    expect(section.items).toHaveLength(1);
    expect(section.items[0]).toMatchObject({
      fieldKey: 'servicePeriods.1.dinner',
      currentValue: 'Dinner 18:00-22:00',
      providerValue: 'Dinner 18:30-22:30',
      canPushToGoogle: false,
    });
    expect(section.blockedReasons).toContain(
      'Google service-period updates are not available for this location.',
    );
  });

  it('builds business-context sections with normalized comparison values', () => {
    const section = buildBusinessContextSection(
      'businessContext.categories',
      'Categories',
      buildCore().businessContext.core.categories,
      buildCore().businessContext.providerSnapshot.categories,
      false,
    );

    expect(section.items[0]).toMatchObject({
      fieldKey: 'businessContext.categories',
      selected: true,
      canPushToGoogle: false,
    });
    expect(section.items[0].nabatableValueHash).toEqual(expect.any(String));
    expect(section.items[0].googleValueHash).toEqual(expect.any(String));
  });

  it('builds the complete draft section list in workflow order', () => {
    const sections = buildDraftSections({
      core: buildCore(),
      businessInfo: buildBusinessInfo(),
      externalLocationTitle: 'External Title',
      canPushServicePeriods: true,
    });

    expect(sections.map((section) => section.sectionKey)).toEqual([
      'profile',
      'operatingHours',
      'servicePeriods',
      'businessContext.categories',
      'businessContext.serviceAreas',
      'businessContext.attributes',
      'businessContext.serviceItems',
    ]);
    expect(sections[0].items[0].providerValue).toBe('External Title');
  });
});
