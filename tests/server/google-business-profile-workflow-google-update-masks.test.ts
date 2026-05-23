import { describe, expect, it } from 'vitest';

import {
  buildGoogleUpdateMasksForSelections,
  normalizeGoogleMasks,
} from '@/server/google-business-profile/workflowGoogleUpdateMasks';

describe('google business profile workflow Google update mask helpers', () => {
  it('normalizes persisted masks by filtering unsupported values and de-duplicating', () => {
    expect(
      normalizeGoogleMasks(['phoneNumbers', 'unknown', 'title', 'phoneNumbers', 'regularHours']),
    ).toEqual(['phoneNumbers', 'title', 'regularHours']);
  });

  it('builds profile masks from selected profile fields', () => {
    expect(
      buildGoogleUpdateMasksForSelections({ profileFields: ['name', 'contactPhone'] }),
    ).toEqual(['title', 'phoneNumbers']);
  });

  it('builds schedule masks from selected hours and override selections', () => {
    expect(
      buildGoogleUpdateMasksForSelections({
        weeklyDays: [1],
        overrideDates: ['2026-05-21'],
      }),
    ).toEqual(['regularHours', 'specialHours']);
  });

  it('builds service-period masks only when selected service periods are pushable', () => {
    expect(buildGoogleUpdateMasksForSelections({ includesServicePeriods: true })).toEqual([
      'moreHours',
    ]);
    expect(buildGoogleUpdateMasksForSelections({ includesServicePeriods: false })).toEqual([]);
  });
});
