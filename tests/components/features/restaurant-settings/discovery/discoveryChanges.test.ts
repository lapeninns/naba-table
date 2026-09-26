import { describe, expect, it } from 'vitest';

import { EMPTY_BUSINESS_CONTEXT_DRAFTS } from '@/components/features/restaurant-settings/businessContextDraftState';
import { EMPTY_DIRTY_STATE } from '@/components/features/restaurant-settings/businessContextModel';
import { buildDiscoveryChangeGroups } from '@/components/features/restaurant-settings/discovery/discoveryChanges';
import {
  getDiscoveryDisplayDirtyState,
  isOnlyServiceLocationChanged,
} from '@/components/features/restaurant-settings/discovery/serviceLocation';

import { makeAttributeRow, makeLinkRow } from '../testUtils';

import type { BusinessContextDrafts } from '@/components/features/restaurant-settings/businessContextDraftState';

describe('buildDiscoveryChangeGroups', () => {
  it('lists was → now lines per section with changes', () => {
    const saved = {
      ...EMPTY_BUSINESS_CONTEXT_DRAFTS,
      links: [makeLinkRow({ id: 'link-a', url: 'https://old.example' })],
      attributes: [makeAttributeRow({ id: 'attribute-a', boolValue: 'true' })],
    } as BusinessContextDrafts;
    const draft = {
      ...saved,
      businessDetails: { ...saved.businessDetails, businessStatus: 'open' },
      links: [
        makeLinkRow({ id: 'link-a', url: 'https://new.example' }),
        makeLinkRow({ id: 'link-b', linkType: 'instagram', label: '', url: 'https://ig.example' }),
      ],
      attributes: [makeAttributeRow({ id: 'attribute-a', boolValue: 'false' })],
    } as BusinessContextDrafts;

    const groups = buildDiscoveryChangeGroups({
      saved,
      draft,
      dirty: { ...EMPTY_DIRTY_STATE, businessDetails: true, links: true, attributes: true },
    });

    expect(groups.map((group) => group.title)).toEqual(['Business status', 'Links', 'Amenities']);
    expect(groups[0]?.changes).toEqual([{ label: 'Business status', was: 'Not set', now: 'Open' }]);
    expect(groups[1]?.changes).toEqual([
      { label: 'Website', was: 'https://old.example', now: 'https://new.example' },
      { label: 'Instagram', now: 'https://ig.example' },
    ]);
    expect(groups[2]?.changes).toEqual([{ label: 'Wi-Fi', was: 'Yes', now: 'No' }]);
  });

  it('shows removed rows and a fallback line when only the order changed', () => {
    const a = makeLinkRow({ id: 'link-a', url: 'https://a.example' });
    const b = makeLinkRow({ id: 'link-b', url: 'https://b.example' });
    const saved = { ...EMPTY_BUSINESS_CONTEXT_DRAFTS, links: [a, b] } as BusinessContextDrafts;

    expect(
      buildDiscoveryChangeGroups({
        saved,
        draft: { ...saved, links: [a] } as BusinessContextDrafts,
        dirty: { ...EMPTY_DIRTY_STATE, links: true },
      })[0]?.changes,
    ).toEqual([{ label: 'Website', was: 'https://b.example', now: 'Removed' }]);

    expect(
      buildDiscoveryChangeGroups({
        saved,
        draft: { ...saved, links: [b, a] } as BusinessContextDrafts,
        dirty: { ...EMPTY_DIRTY_STATE, links: true },
      })[0]?.changes,
    ).toEqual([{ label: 'Order', now: 'Changed' }]);
  });
});

describe('service-location switch', () => {
  const saved = EMPTY_BUSINESS_CONTEXT_DRAFTS as BusinessContextDrafts;
  const switchedOn = {
    ...saved,
    businessDetails: { ...saved.businessDetails, isServiceAreaBusiness: true },
  } as BusinessContextDrafts;

  it('marks and lists the switch under Where you serve, where staff edit it', () => {
    const dirty = { ...EMPTY_DIRTY_STATE, businessDetails: true };

    const display = getDiscoveryDisplayDirtyState(dirty, saved, switchedOn);
    expect(display).toMatchObject({ businessDetails: false, serviceAreas: true });
    expect(isOnlyServiceLocationChanged(saved, switchedOn)).toBe(true);

    const groups = buildDiscoveryChangeGroups({ saved, draft: switchedOn, dirty: display });
    expect(groups.map((group) => group.title)).toEqual(['Where you serve']);
    expect(groups[0]?.changes).toEqual([
      { label: 'We serve customers at their location', was: 'No', now: 'Yes' },
    ]);
  });

  it('keeps Business status marked when status also changed', () => {
    const draft = {
      ...switchedOn,
      businessDetails: { ...switchedOn.businessDetails, businessStatus: 'open' },
    } as BusinessContextDrafts;
    const dirty = { ...EMPTY_DIRTY_STATE, businessDetails: true };

    const display = getDiscoveryDisplayDirtyState(dirty, saved, draft);
    expect(display).toMatchObject({ businessDetails: true, serviceAreas: true });
    expect(isOnlyServiceLocationChanged(saved, draft)).toBe(false);
    const groups = buildDiscoveryChangeGroups({ saved, draft, dirty: display });
    expect(
      groups.map((group) => [group.title, group.changes.map((change) => change.label)]),
    ).toEqual([
      ['Business status', ['Business status']],
      ['Where you serve', ['We serve customers at their location']],
    ]);
  });

  it('leaves the dirty state alone when the switch did not change', () => {
    const dirty = { ...EMPTY_DIRTY_STATE, serviceAreas: true };
    expect(getDiscoveryDisplayDirtyState(dirty, saved, saved)).toBe(dirty);
  });
});
