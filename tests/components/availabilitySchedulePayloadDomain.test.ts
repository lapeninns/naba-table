import { describe, expect, it } from 'vitest';

import {
  buildAvailabilityServicePayload,
  buildAvailabilityTurnBandsPayload,
} from '@/components/features/restaurant-settings/availabilitySchedulePayloadDomain';

import type { DayServiceConfig } from '@/components/features/restaurant-settings/servicePeriodsMapper';
import type { OpsOccasion } from '@/services/ops/occasions';
import type { ServicePeriodRow, TurnBandsPayload } from '@/services/ops/restaurants';

function dayConfig(overrides: Partial<DayServiceConfig> = {}): DayServiceConfig {
  return {
    dayOfWeek: 1,
    label: 'Monday',
    opensAt: '10:00',
    closesAt: '22:00',
    isClosed: false,
    lunch: {
      enabled: true,
      endTime: '14:00',
      id: 'lunch-row',
      name: 'Lunch',
      startTime: '11:00',
    },
    dinner: {
      enabled: true,
      endTime: '21:30',
      id: 'dinner-row',
      name: 'Dinner',
      startTime: '17:30',
    },
    ...overrides,
  };
}

function occasion(key: string): OpsOccasion {
  return {
    key,
    label: key,
    shortLabel: key,
    description: null,
    availability: [{ kind: 'anytime' }],
    defaultDurationMinutes: 90,
    displayOrder: 10,
    isActive: true,
    isBuiltin: false,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

describe('availabilitySchedulePayloadDomain', () => {
  it('builds service period payloads while suppressing meals on closed days', () => {
    const customRows: ServicePeriodRow[] = [
      {
        bookingOption: 'brunch',
        dayOfWeek: 0,
        endTime: '13:00',
        id: 'custom-row',
        name: 'Brunch',
        startTime: '10:00',
      },
    ];

    expect(
      buildAvailabilityServicePayload({
        customRows,
        dayConfigs: [dayConfig()],
        occasionKeys: { lunch: 'lunch-key', dinner: 'dinner-key' },
      }),
    ).toEqual([
      customRows[0],
      {
        bookingOption: 'lunch-key',
        dayOfWeek: 1,
        endTime: '14:00',
        id: 'lunch-row',
        name: 'Lunch',
        startTime: '11:00',
      },
      {
        bookingOption: 'dinner-key',
        dayOfWeek: 1,
        endTime: '21:30',
        id: 'dinner-row',
        name: 'Dinner',
        startTime: '17:30',
      },
    ]);

    expect(
      buildAvailabilityServicePayload({
        customRows: [],
        dayConfigs: [dayConfig({ isClosed: true })],
        occasionKeys: { lunch: 'lunch-key', dinner: 'dinner-key' },
      }),
    ).toEqual([]);
  });

  it('normalizes turn-band payloads for active occasion keys only', () => {
    const turnBandsDraft: TurnBandsPayload = {
      dinner: [{ durationMinutes: 120, maxPartySize: 8 }],
      lunch: [{ durationMinutes: 90, maxPartySize: 4 }],
      private: [{ durationMinutes: 150, maxPartySize: 12 }],
      stale: [{ durationMinutes: 60, maxPartySize: 2 }],
    };

    expect(
      buildAvailabilityTurnBandsPayload({
        occasionDrafts: [occasion('private')],
        servicePeriods: [
          {
            bookingOption: 'dinner',
            dayOfWeek: 5,
            endTime: '21:30',
            id: 'dinner-row',
            name: 'Dinner',
            startTime: '17:30',
          },
        ],
        turnBandsDraft,
      }),
    ).toEqual({
      dinner: [{ durationMinutes: 120, maxPartySize: 8 }],
      lunch: [{ durationMinutes: 90, maxPartySize: 4 }],
      private: [{ durationMinutes: 150, maxPartySize: 12 }],
    });
  });
});
