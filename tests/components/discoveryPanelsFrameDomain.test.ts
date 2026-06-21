import { describe, expect, it } from 'vitest';

import {
  buildDiscoverySectionFrameState,
  formatDiscoveryTriggerLabel,
  resolveDiscoveryFamily,
} from '@/components/features/restaurant-settings/discovery/discoveryPanelsFrameDomain';

import type {
  DirtyState,
  ErrorState,
  FamilyKey,
} from '@/components/features/restaurant-settings/businessContextModel';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

const families: FamilyKey[] = [
  'businessDetails',
  'links',
  'categories',
  'serviceAreas',
  'attributes',
  'serviceItems',
];

const emptyDirty = Object.fromEntries(families.map((family) => [family, false])) as DirtyState;
const emptyErrors = {} as ErrorState;

function driftField(fieldKey: string): DualSyncFieldSummary {
  return {
    sectionKey: 'businessDetails',
    fieldKey,
    label: fieldKey,
    state: 'matching',
    policy: {} as DualSyncFieldSummary['policy'],
  } as DualSyncFieldSummary;
}

describe('discoveryPanelsFrameDomain', () => {
  it('resolves valid discovery families and rejects invalid accordion values', () => {
    expect(resolveDiscoveryFamily('links')).toBe('links');
    expect(resolveDiscoveryFamily('')).toBeNull();
    expect(resolveDiscoveryFamily('unknown')).toBeNull();
  });

  it('formats trigger labels with dirty and error state', () => {
    expect(
      formatDiscoveryTriggerLabel({
        title: 'Online links',
        dirty: false,
        hasError: false,
      }),
    ).toBe('Online links');
    expect(
      formatDiscoveryTriggerLabel({
        title: 'Online links',
        dirty: true,
        hasError: true,
      }),
    ).toBe('Online links, unsaved changes, needs attention');
  });

  it('builds section frame state from editor and drift summaries', () => {
    const fields = [driftField('openingDate')];
    const state = buildDiscoverySectionFrameState({
      family: 'businessDetails',
      editor: {
        dirty: { ...emptyDirty, businessDetails: true },
        errors: { ...emptyErrors, businessDetails: 'Required' },
      },
      gbpDriftFieldsByFamily: {
        businessDetails: fields,
        links: [],
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });

    expect(state).toMatchObject({
      family: 'businessDetails',
      title: 'Profile basics',
      description: 'Opening status and whether this restaurant also serves guests off-site.',
      dirty: true,
      hasError: true,
      triggerLabel: 'Profile basics, unsaved changes, needs attention',
    });
    expect(state.driftFields).toBe(fields);
  });

  it('defaults missing drift summaries to an empty list', () => {
    expect(
      buildDiscoverySectionFrameState({
        family: 'links',
        editor: { dirty: emptyDirty, errors: emptyErrors },
      }).driftFields,
    ).toEqual([]);
  });
});
