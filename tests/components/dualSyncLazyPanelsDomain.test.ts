import { describe, expect, it } from 'vitest';

import {
  DUAL_SYNC_LAZY_PANEL_DEFINITIONS,
  DUAL_SYNC_LAZY_PANEL_IDS,
  buildDualSyncLazyPanelStates,
  isDualSyncLazyPanelActive,
  type DualSyncLazyPanelActiveState,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncLazyPanelsDomain';

function makeActiveState(
  overrides: Partial<Record<keyof typeof DUAL_SYNC_LAZY_PANEL_IDS, boolean>> = {},
): DualSyncLazyPanelActiveState {
  return {
    metrics: false,
    pendingCandidates: false,
    queueJobs: false,
    publishes: false,
    operations: false,
    ...overrides,
  };
}

describe('dualSyncLazyPanelsDomain', () => {
  it('keeps lazy panel definitions in shipped accordion order', () => {
    expect(DUAL_SYNC_LAZY_PANEL_DEFINITIONS.map((definition) => definition.value)).toEqual([
      '__metrics',
      '__pendingCandidates',
      '__queueJobs',
      '__publishes',
      '__operations',
    ]);
    expect(DUAL_SYNC_LAZY_PANEL_DEFINITIONS.map((definition) => definition.title)).toEqual([
      'Operational health',
      'Pending changes',
      'Queue recovery',
      'Recent publishes',
      'Recent operations',
    ]);
  });

  it('marks active panels without mutating panel metadata', () => {
    const states = buildDualSyncLazyPanelStates(
      makeActiveState({ pendingCandidates: true, publishes: true }),
    );

    expect(states.map((panel) => [panel.id, panel.isActive])).toEqual([
      ['metrics', false],
      ['pendingCandidates', true],
      ['queueJobs', false],
      ['publishes', true],
      ['operations', false],
    ]);
    expect(
      DUAL_SYNC_LAZY_PANEL_DEFINITIONS.find(
        (definition) => definition.id === DUAL_SYNC_LAZY_PANEL_IDS.pendingCandidates,
      ),
    ).not.toHaveProperty('isActive');
  });

  it('identifies active lazy panels by id', () => {
    const activeState = makeActiveState({ operations: true });

    expect(isDualSyncLazyPanelActive(activeState, DUAL_SYNC_LAZY_PANEL_IDS.operations)).toBe(true);
    expect(isDualSyncLazyPanelActive(activeState, DUAL_SYNC_LAZY_PANEL_IDS.metrics)).toBe(false);
  });
});
