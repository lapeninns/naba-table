import { describe, expect, it } from 'vitest';

import {
  formatDiscoveryGoogleStatus,
  GOOGLE_COMPARED_FAMILIES,
} from '@/components/features/restaurant-settings/discovery/discoveryPanelChromeDomain';

const base = {
  family: 'attributes' as const,
  prefilled: false,
  googleLinked: true,
  driftLoading: false,
  differingLabels: [] as string[],
};

describe('formatDiscoveryGoogleStatus', () => {
  it('marks sections pre-filled from Google as not saved yet, ahead of any comparison', () => {
    expect(
      formatDiscoveryGoogleStatus({ ...base, prefilled: true, differingLabels: ['Wi-Fi'] }),
    ).toEqual({
      kind: 'prefilled',
      text: 'Pre-filled from Google. Not saved yet.',
      detail: 'Save to keep these values, or edit them first.',
    });
    expect(
      formatDiscoveryGoogleStatus({ ...base, family: 'businessDetails', prefilled: true }).kind,
    ).toBe('prefilled');
  });

  it('never compares business status or links with Google', () => {
    expect(GOOGLE_COMPARED_FAMILIES.has('businessDetails')).toBe(false);
    expect(GOOGLE_COMPARED_FAMILIES.has('links')).toBe(false);
    expect(formatDiscoveryGoogleStatus({ ...base, family: 'links' })).toEqual({
      kind: 'not-compared',
      text: 'Not compared with Google.',
      canLink: false,
    });
  });

  it('offers to link Google when the profile is not linked', () => {
    expect(formatDiscoveryGoogleStatus({ ...base, googleLinked: false })).toEqual({
      kind: 'not-compared',
      text: 'Not compared with Google. Google Business Profile isn’t linked.',
      canLink: true,
    });
  });

  it('says it is comparing while Google drift loads', () => {
    expect(formatDiscoveryGoogleStatus({ ...base, driftLoading: true }).text).toBe(
      'Comparing with Google…',
    );
  });

  it('names what Google differs on, with the right noun per section', () => {
    expect(formatDiscoveryGoogleStatus({ ...base, differingLabels: ['Live music'] })).toEqual({
      kind: 'differs',
      text: 'Google differs on 1 amenity (Live music).',
      count: 1,
    });
    expect(
      formatDiscoveryGoogleStatus({
        ...base,
        family: 'categories',
        differingLabels: ['Pub', 'Bar', 'Bistro', 'Inn', 'Hotel'],
      }).text,
    ).toBe('Google differs on 5 categories (Pub, Bar, Bistro and 2 more).');
  });

  it('matches Google when a linked, compared section has no differences', () => {
    expect(formatDiscoveryGoogleStatus({ ...base, family: 'serviceAreas' })).toEqual({
      kind: 'matches',
      text: 'Matches Google',
    });
  });
});
