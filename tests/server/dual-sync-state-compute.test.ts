import { describe, expect, it } from 'vitest';

import { computeFieldState } from '@/server/dual-sync/state/compute';

describe('dual-sync computeFieldState', () => {
  it('returns unsupported for unsupported policy regardless of hashes', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'unsupported',
        coreHash: 'a',
        gbpHash: 'b',
        lastInSyncHash: null,
      }),
    ).toBe('unsupported');
  });

  it('returns ignored when ignored=true', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'a',
        gbpHash: 'b',
        lastInSyncHash: null,
        ignored: true,
      }),
    ).toBe('ignored');
  });

  it('returns in_sync when both sides hash equal', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'a',
        gbpHash: 'a',
        lastInSyncHash: 'a',
      }),
    ).toBe('in_sync');
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: null,
        gbpHash: null,
        lastInSyncHash: null,
      }),
    ).toBe('in_sync');
  });

  it('classifies core_dirty when only Core moved since last sync', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'new',
        gbpHash: 'old',
        lastInSyncHash: 'old',
      }),
    ).toBe('core_dirty');
  });

  it('classifies gbp_dirty when only Google moved since last sync', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'old',
        gbpHash: 'new',
        lastInSyncHash: 'old',
      }),
    ).toBe('gbp_dirty');
  });

  it('classifies conflict when both sides moved since last sync', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'cnew',
        gbpHash: 'gnew',
        lastInSyncHash: 'old',
      }),
    ).toBe('conflict');
  });

  it('returns drifted when sides differ and there is no in-sync baseline', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'a',
        gbpHash: 'b',
        lastInSyncHash: null,
      }),
    ).toBe('drifted');
  });

  it('overlays pending_export when an open outbound candidate exists', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'new',
        gbpHash: 'old',
        lastInSyncHash: 'old',
        hasOpenOutboundCandidate: true,
      }),
    ).toBe('pending_export');
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'a',
        gbpHash: 'b',
        lastInSyncHash: null,
        hasOpenOutboundCandidate: true,
      }),
    ).toBe('pending_export');
  });

  it('preserves pending_* and *_failed previousState while sides still diverge', () => {
    for (const previousState of [
      'pending_import',
      'pending_export',
      'import_failed',
      'export_failed',
    ] as const) {
      expect(
        computeFieldState({
          conflictPolicy: 'manual',
          coreHash: 'new',
          gbpHash: 'old',
          lastInSyncHash: 'old',
          previousState,
        }),
      ).toBe(previousState);
    }
  });

  it('clears overlays once both sides converge', () => {
    expect(
      computeFieldState({
        conflictPolicy: 'manual',
        coreHash: 'same',
        gbpHash: 'same',
        lastInSyncHash: 'same',
        previousState: 'export_failed',
      }),
    ).toBe('in_sync');
  });
});
