import { describe, expect, it } from 'vitest';

import {
  deriveRestaurantSetupOverviewState,
  isRequiredSetupLoading,
} from '@/components/features/restaurant-settings/overview/restaurantSetupOverviewDomain';

import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  ServicePeriodRow,
} from '@/services/ops/restaurants';
import type { TableInventorySummary } from '@/services/ops/tables';

const completeProfile = {
  id: 'rest-1',
  name: 'Old Crown Girton',
  slug: 'old-crown-girton',
  timezone: 'Europe/London',
  contactPhone: '+441223277217',
} as RestaurantProfile;

const openHours = {
  weekly: [{ isClosed: false }],
} as OperatingHoursSnapshot;

const servicePeriods = [{ id: 'lunch-1' }] as ServicePeriodRow[];

const tableSummary = {
  totalTables: 4,
  availableTables: 4,
  totalCapacity: 16,
  zones: [],
  serviceCapacities: [],
} as TableInventorySummary;

describe('restaurantSetupOverviewDomain', () => {
  it('derives complete required setup and optional summaries from service state', () => {
    const state = deriveRestaurantSetupOverviewState({
      profile: completeProfile,
      operatingHours: openHours,
      servicePeriods,
      tableSummary,
      menuCount: 2,
      pendingInvites: 1,
    });

    expect(state.requiredSetup).toMatchObject({
      complete: 3,
      total: 3,
      percent: 100,
      title: 'Your restaurant is ready to take bookings.',
    });
    expect(state.optionalSetup).toMatchObject({
      started: 2,
      total: 3,
      value: 'Menu ready · Team ready',
    });
    expect(state.cards.map((card) => [card.key, card.status])).toEqual([
      ['profile', 'complete'],
      ['availability', 'complete'],
      ['tables', 'complete'],
      ['google', 'optional'],
      ['menu', 'complete'],
      ['team', 'complete'],
    ]);
  });

  it('keeps required setup incomplete until profile, hours, service periods, and tables are ready', () => {
    const state = deriveRestaurantSetupOverviewState({
      profile: { ...completeProfile, contactPhone: null } as RestaurantProfile,
      operatingHours: { weekly: [{ isClosed: true }] } as OperatingHoursSnapshot,
      servicePeriods: [],
      tableSummary: { ...tableSummary, availableTables: 0 },
      menuCount: 0,
      pendingInvites: 0,
    });

    expect(state.requiredSetup).toMatchObject({
      complete: 0,
      total: 3,
      percent: 0,
      title: 'Next up: Public profile',
      description: 'Add public phone before go-live.',
    });
    expect(state.cards.slice(0, 3).map((card) => card.status)).toEqual([
      'attention',
      'attention',
      'attention',
    ]);
  });

  it('combines required loading flags', () => {
    expect(
      isRequiredSetupLoading({
        profileLoading: false,
        operatingHoursLoading: false,
        servicePeriodsLoading: true,
        tablesLoading: false,
      }),
    ).toBe(true);

    expect(
      isRequiredSetupLoading({
        profileLoading: false,
        operatingHoursLoading: false,
        servicePeriodsLoading: false,
        tablesLoading: false,
      }),
    ).toBe(false);
  });
});
