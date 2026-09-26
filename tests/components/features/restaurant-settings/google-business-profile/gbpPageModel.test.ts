import { describe, expect, it } from 'vitest';

import {
  describeGbpConnection,
  describeGbpFieldNotes,
  describeGbpWrites,
  getGbpReconnectReason,
  getGbpSendBlockReason,
  hasGbpComparison,
  isGbpFieldDifferent,
  summarizeGbpReview,
  summarizeGbpSection,
} from '@/components/features/restaurant-settings/google-business-profile/gbpPageModel';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type Operator = Parameters<typeof describeGbpWrites>[0]['operator'];

function field(overrides: Partial<DualSyncFieldSummary> = {}): DualSyncFieldSummary {
  return {
    fieldKey: 'profile.phone',
    sectionKey: 'profile',
    kind: 'profile',
    label: 'Contact phone',
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: 'profile.phone',
      sectionKey: 'profile',
      authority: 'bidirectional_manual',
      riskLevel: 'medium',
      importable: true,
      exportable: true,
      requiresManualReview: false,
      semanticComparator: 'phone',
      canonicalizer: 'canonicalizePhone',
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: '01632 960 123',
    gbpValue: '01632 960 987',
    coreCanonicalHash: null,
    gbpCanonicalHash: null,
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'core_dirty',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...overrides,
  };
}

function operator(overrides: Partial<NonNullable<Operator>> = {}): NonNullable<Operator> {
  return {
    writeState: 'eligible',
    reasonCode: null,
    rollout: { eligible: true, cohort: 'canary', evaluatedAt: '2026-09-26T12:00:00.000Z' },
    pendingUpdates: { state: 'none' },
    ...overrides,
  } as NonNullable<Operator>;
}

describe('describeGbpFieldNotes', () => {
  it('says how a field differs, then what limits it', () => {
    expect(describeGbpFieldNotes(field())).toEqual({ text: 'Changed in Nabatable', hot: false });
    expect(describeGbpFieldNotes(field({ state: 'conflict' }))).toEqual({
      text: 'Changed on both',
      hot: true,
    });
    expect(
      describeGbpFieldNotes(
        field({
          state: 'gbp_dirty',
          coreValue: null,
          policy: { ...field().policy, authority: 'import_only', riskLevel: 'critical' },
        }),
      ).text,
    ).toBe('Changed on Google · Google-owned · High-risk');
    expect(describeGbpFieldNotes(field({ state: 'in_sync' })).text).toBe('Matches');
  });
});

describe('describeGbpConnection and describeGbpWrites', () => {
  it('labels the connection', () => {
    expect(describeGbpConnection('linked')).toEqual({ label: 'Linked', tone: 'ok' });
    expect(describeGbpConnection('reauth_required')).toEqual({
      label: 'Reconnect needed',
      tone: 'bad',
    });
  });

  it('never reports writes as on when they are stopped or unknown', () => {
    expect(describeGbpWrites({ operator: operator(), unavailable: false })).toMatchObject({
      label: 'On',
      tone: 'ok',
    });
    expect(
      describeGbpWrites({
        operator: operator({ pendingUpdates: { state: 'unknown' } as never }),
        unavailable: false,
      }),
    ).toMatchObject({ label: 'Stopped', tone: 'bad' });
    expect(describeGbpWrites({ operator: null, unavailable: true })).toMatchObject({
      label: 'Unavailable',
      tone: 'bad',
    });
    expect(describeGbpWrites({ operator: null, unavailable: false })).toBeNull();
  });
});

describe('getGbpSendBlockReason', () => {
  const base = {
    operator: operator(),
    operatorUnavailable: false,
    connectionStatus: 'linked' as const,
    syncPaused: false,
  };

  it('allows sending only when nothing stops a Google write', () => {
    expect(getGbpSendBlockReason(base)).toBeNull();
  });

  it('explains each stop, most serious first', () => {
    expect(getGbpSendBlockReason({ ...base, operatorUnavailable: true })).toMatch(
      /Write controls could not be loaded/,
    );
    expect(getGbpSendBlockReason({ ...base, connectionStatus: 'reauth_required' })).toMatch(
      /Reconnect Google/,
    );
    expect(
      getGbpSendBlockReason({
        ...base,
        operator: operator({ pendingUpdates: { state: 'unknown' } as never }),
      }),
    ).toMatch(/Publishing is stopped/);
    expect(
      getGbpSendBlockReason({
        ...base,
        operator: operator({
          writeState: 'blocked',
          rollout: { eligible: false, reason: 'rollout_off', evaluatedAt: '' } as never,
        }),
      }),
    ).toMatch(/not enabled for this venue/);
    expect(
      getGbpSendBlockReason({ ...base, operator: operator({ writeState: 'blocked' }) }),
    ).toMatch(/Google writes are off/);
    expect(getGbpSendBlockReason({ ...base, syncPaused: true })).toMatch(/Sync is paused/);
  });

  it('leaves the decision to the server when write state is not known', () => {
    expect(getGbpSendBlockReason({ ...base, operator: null })).toBeNull();
  });
});

describe('summarizeGbpReview and summarizeGbpSection', () => {
  const fields = [
    field({ fieldKey: 'a', sectionKey: 'profile' }),
    field({ fieldKey: 'b', sectionKey: 'profile', state: 'in_sync' }),
    field({ fieldKey: 'c', sectionKey: 'foodMenus', state: 'gbp_dirty' }),
    field({ fieldKey: 'd', sectionKey: 'foodMenus', state: 'in_sync' }),
    field({ fieldKey: 'e', sectionKey: 'operatingHours', state: 'in_sync' }),
  ];

  it('counts differences, sections with differences and decisions', () => {
    expect(summarizeGbpReview(fields, { a: { action: 'ignore' } })).toEqual({
      differences: 2,
      sectionsWithDifferences: 2,
      toDecide: 2,
      decided: 1,
      undecided: 1,
    });
  });

  it('leaves queued, ignored and unsupported fields out of the decisions still to make', () => {
    const review = summarizeGbpReview(
      [
        field({ fieldKey: 'a', state: 'core_dirty' }),
        field({ fieldKey: 'q', state: 'pending_export' }),
        field({ fieldKey: 'i', state: 'ignored' }),
        field({ fieldKey: 'u', state: 'core_dirty', conflictPolicy: 'unsupported' }),
      ],
      {},
    );
    expect(review).toMatchObject({ differences: 4, toDecide: 1, decided: 0, undecided: 1 });
  });

  it('describes a section by how many of its fields differ', () => {
    expect(summarizeGbpSection(fields.filter((f) => f.sectionKey === 'foodMenus'))).toEqual({
      differing: 1,
      total: 2,
      label: '1 of 2 differ',
    });
    expect(summarizeGbpSection(fields.filter((f) => f.sectionKey === 'operatingHours')).label).toBe(
      'All match',
    );
  });
});

describe('getGbpReconnectReason', () => {
  it('asks to reconnect when Google access expired', () => {
    expect(getGbpReconnectReason({ connectionStatus: 'reauth_required', operator: null })).toBe(
      'expired',
    );
    expect(
      getGbpReconnectReason({
        connectionStatus: 'sync_error',
        operator: operator({ writeState: 'reauth_required' }),
      }),
    ).toBe('expired');
  });

  it('asks to reconnect when Google refused access to the listing, even while reported as a sync error', () => {
    expect(
      getGbpReconnectReason({
        connectionStatus: 'sync_error',
        operator: operator({ writeState: 'blocked', reasonCode: 'provider_access_lost_403' }),
      }),
    ).toBe('access_lost');
  });

  it('does not ask to reconnect for other problems', () => {
    expect(getGbpReconnectReason({ connectionStatus: 'sync_error', operator: null })).toBeNull();
    expect(
      getGbpReconnectReason({
        connectionStatus: 'linked',
        operator: operator({ writeState: 'blocked', reasonCode: 'writes_turned_off' }),
      }),
    ).toBeNull();
  });

  it('names lost access on the connection pill and as the reason nothing can be sent', () => {
    expect(describeGbpConnection('sync_error', 'access_lost')).toEqual({
      label: 'Access lost',
      tone: 'bad',
    });
    expect(
      getGbpSendBlockReason({
        operator: operator({ writeState: 'blocked', reasonCode: 'provider_access_lost_403' }),
        operatorUnavailable: false,
        connectionStatus: 'sync_error',
        syncPaused: false,
      }),
    ).toMatch(/Google refused access to this listing\. Reconnect Google/);
  });
});

describe('fields never compared with Google', () => {
  const unchecked = field({ fieldKey: 'u', state: null });

  it('are not differences, and a review with only them has no comparison', () => {
    expect(isGbpFieldDifferent(unchecked)).toBe(false);
    expect(summarizeGbpReview([unchecked], {})).toMatchObject({ differences: 0, toDecide: 0 });
    expect(hasGbpComparison([unchecked])).toBe(false);
    expect(hasGbpComparison([unchecked, field({ state: 'in_sync' })])).toBe(true);
  });

  it('are named in the section summary instead of claiming a match', () => {
    expect(summarizeGbpSection([unchecked, field({ state: 'in_sync' })]).label).toBe(
      '1 not compared yet',
    );
  });
});
