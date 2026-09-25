import { describe, expect, it } from 'vitest';

import {
  deriveProfileSetupChecks,
  deriveRestaurantSetupOverviewState,
  getFailedSourcesForRow,
  isRequiredSetupLoading,
  type SetupCheckSource,
} from '@/components/features/restaurant-settings/overview/restaurantSetupOverviewDomain';
import { isProfileSetupComplete } from '@/lib/ops/restaurant-setup-rules';

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
  weekly: [{ isClosed: false }, { isClosed: false }, { isClosed: true }],
} as OperatingHoursSnapshot;

const servicePeriods = [{ id: 'lunch-1' }, { id: 'dinner-1' }] as ServicePeriodRow[];

const tableSummary = {
  totalTables: 4,
  availableTables: 3,
  totalCapacity: 16,
  zones: [],
  serviceCapacities: [],
} as TableInventorySummary;

describe('restaurantSetupOverviewDomain', () => {
  it('derives complete required setup and row checks from service state', () => {
    const state = deriveRestaurantSetupOverviewState({
      profile: completeProfile,
      operatingHours: openHours,
      servicePeriods,
      tableSummary,
      menuCount: 2,
      pendingInvites: 1,
    });

    expect(state.readiness).toMatchObject({
      complete: 3,
      total: 3,
      ready: true,
      title: 'Ready to take bookings',
    });
    expect(state.requiredCards.map((card) => card.key)).toEqual([
      'profile',
      'availability',
      'tables',
    ]);
    expect(state.optionalCards.map((card) => [card.key, card.status])).toEqual([
      ['discovery', 'optional'],
      ['google', 'optional'],
      ['menu', 'complete'],
      ['team', 'complete'],
    ]);
    expect(state.requiredCards[1]?.checks.map((check) => check.label)).toEqual([
      '2 days open each week',
      '2 meal times set',
    ]);
    expect(state.requiredCards[2]?.checks.map((check) => check.label)).toEqual([
      '4 tables added',
      '3 bookable now',
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

    expect(state.readiness).toMatchObject({
      complete: 0,
      total: 3,
      ready: false,
      nextKey: 'profile',
      description: '0 of 3 required steps complete. Next: public profile.',
    });
    expect(state.requiredCards.map((card) => card.status)).toEqual([
      'attention',
      'attention',
      'attention',
    ]);
  });

  it('treats missing data as incomplete rather than failed', () => {
    const state = deriveRestaurantSetupOverviewState({
      profile: null,
      operatingHours: null,
      servicePeriods: null,
      tableSummary: null,
      menuCount: 0,
      pendingInvites: 0,
    });

    expect(state.requiredCards.map((card) => card.status)).toEqual([
      'attention',
      'attention',
      'attention',
    ]);
  });

  it('matches the shared profile rule field by field', () => {
    const profiles = [
      completeProfile,
      { ...completeProfile, name: '  ' },
      { ...completeProfile, slug: null },
      { ...completeProfile, timezone: '' },
      { ...completeProfile, contactPhone: null },
    ] as RestaurantProfile[];

    for (const profile of profiles) {
      const checks = deriveProfileSetupChecks(profile);
      expect(Object.values(checks).every(Boolean)).toBe(isProfileSetupComplete(profile));
    }
    expect(deriveProfileSetupChecks({ ...completeProfile, name: '  ' })).toEqual({
      name: false,
      slug: true,
      timezone: true,
      contactPhone: true,
    });
  });

  it('maps failed queries to the rows that depend on them', () => {
    const failed = new Set<SetupCheckSource>(['servicePeriods', 'team']);

    expect(getFailedSourcesForRow('availability', failed)).toEqual(['servicePeriods']);
    expect(getFailedSourcesForRow('team', failed)).toEqual(['team']);
    expect(getFailedSourcesForRow('profile', failed)).toEqual([]);
    expect(getFailedSourcesForRow('google', failed)).toEqual([]);
    expect(getFailedSourcesForRow('discovery', failed)).toEqual([]);

    const state = deriveRestaurantSetupOverviewState({
      profile: completeProfile,
      operatingHours: openHours,
      servicePeriods,
      tableSummary,
      menuCount: 0,
      pendingInvites: 0,
      failedSources: failed,
    });

    expect(state.requiredCards.map((card) => card.status)).toEqual([
      'complete',
      'unknown',
      'complete',
    ]);
    expect(state.optionalCards.map((card) => card.status)).toEqual([
      'optional',
      'optional',
      'optional',
      'unknown',
    ]);
    expect(state.readiness.hasFailedCheck).toBe(true);
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
