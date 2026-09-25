import { describe, expect, it } from 'vitest';

import { EMPTY_DIRTY_STATE } from '@/components/features/restaurant-settings/businessContextModel';
import {
  buildDiscoverySectionStates,
  getDiscoverySectionBadge,
} from '@/components/features/restaurant-settings/discovery/discoveryPanelsFrameDomain';

const NO_ISSUES = {
  businessDetails: 0,
  categories: 0,
  links: 0,
  attributes: 0,
  serviceItems: 0,
  serviceAreas: 0,
};

describe('discoveryPanelsFrameDomain', () => {
  it('lists the six sections in page order with stable deep-link anchors', () => {
    const sections = buildDiscoverySectionStates({
      dirty: EMPTY_DIRTY_STATE,
      issueCounts: NO_ISSUES,
    });

    expect(sections.map((section) => section.title)).toEqual([
      'Business status',
      'Categories',
      'Links',
      'Amenities',
      'Services',
      'Where you serve',
    ]);
    // gbp-drift/sectionRoutes.ts links to these ids.
    expect(sections.map((section) => section.anchorId)).toEqual([
      'profile-discovery-businessDetails',
      'profile-discovery-categories',
      'profile-discovery-links',
      'profile-discovery-attributes',
      'profile-discovery-serviceItems',
      'profile-discovery-serviceAreas',
    ]);
    expect(sections.every((section) => section.badge === null)).toBe(true);
  });

  it('marks edited sections and lets issues take priority in the jump bar', () => {
    const sections = buildDiscoverySectionStates({
      dirty: { ...EMPTY_DIRTY_STATE, links: true, serviceItems: true },
      issueCounts: { ...NO_ISSUES, serviceItems: 2 },
    });
    const byFamily = Object.fromEntries(sections.map((section) => [section.family, section]));

    expect(byFamily.links?.badge).toEqual({
      label: 'Edited',
      tone: 'edited',
      srLabel: 'Unsaved changes',
    });
    expect(byFamily.serviceItems?.badge).toEqual({ label: '2 issues', tone: 'issue' });
    expect(byFamily.categories?.badge).toBeNull();
  });

  it('uses a singular issue label', () => {
    expect(getDiscoverySectionBadge({ dirty: true, issueCount: 1 })).toEqual({
      label: '1 issue',
      tone: 'issue',
    });
  });
});
