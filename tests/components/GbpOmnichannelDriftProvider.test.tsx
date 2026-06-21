import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GbpDriftProvider } from '@/components/features/restaurant-settings/gbp-drift/GbpDriftProvider';
import { useGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

const publishMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

const dualSyncState = vi.hoisted(() => ({
  fields: [] as DualSyncFieldSummary[],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => ({
    data: { status: 'linked' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: {
      data: {
        fields: dualSyncState.fields,
      },
      isLoading: false,
    },
    publishMutation,
  }),
}));

function field(overrides: Partial<DualSyncFieldSummary> & Pick<DualSyncFieldSummary, 'fieldKey'>) {
  const sectionKey = overrides.sectionKey ?? 'profile';
  return {
    fieldKey: overrides.fieldKey,
    sectionKey,
    kind: 'profile',
    label: overrides.fieldKey,
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: overrides.fieldKey,
      sectionKey,
      authority: 'bidirectional_manual',
      riskLevel: 'medium',
      importable: true,
      exportable: true,
      requiresManualReview: false,
      semanticComparator: 'text',
      canonicalizer: 'canonicalizeText',
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: 'Nabatable value',
    gbpValue: 'Google value',
    coreCanonicalHash: `${overrides.fieldKey}:core`,
    gbpCanonicalHash: `${overrides.fieldKey}:gbp`,
    capability: {
      canImport: true,
      canExport: true,
      canIgnore: true,
      blockedReasons: [],
    },
    state: 'drifted',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...overrides,
  } satisfies DualSyncFieldSummary;
}

function Probe() {
  const drift = useGbpDrift();
  return (
    <div>
      <output aria-label="total drift">{drift.totalDriftCount}</output>
      <output aria-label="profile drift">{drift.driftCountBySection.profile}</output>
      <button
        type="button"
        onClick={() => drift.registerDraftOverride('profile.name', 'Google value')}
      >
        Match draft
      </button>
      <button type="button" onClick={() => void drift.applyFieldFromGoogle('profile.name')}>
        Apply name
      </button>
    </div>
  );
}

describe('GbpDriftProvider', () => {
  beforeEach(() => {
    publishMutation.mutateAsync.mockReset();
    publishMutation.mutateAsync.mockResolvedValue({ failures: [] });
    dualSyncState.fields = [
      field({ fieldKey: 'profile.name', sectionKey: 'profile' }),
      field({
        fieldKey: 'operatingHours.weekly.1',
        sectionKey: 'operatingHours',
        coreValue: { opensAt: '09:00', closesAt: '17:00', isClosed: false },
        gbpValue: { opensAt: '10:00', closesAt: '17:00', isClosed: false },
      }),
      field({
        fieldKey: 'core.bookingPolicy',
        sectionKey: 'core_only',
        state: 'drifted',
      }),
    ];
  });

  it('counts comparable drift and ignores core-only fields', async () => {
    const user = userEvent.setup();
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <Probe />
      </GbpDriftProvider>,
    );

    expect(screen.getByLabelText('total drift')).toHaveTextContent('2');
    expect(screen.getByLabelText('profile drift')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Match draft' }));

    expect(screen.getByLabelText('total drift')).toHaveTextContent('1');
    expect(screen.getByLabelText('profile drift')).toHaveTextContent('0');
  });

  it('publishes import_from_google with pinned hashes for a drifted field', async () => {
    const user = userEvent.setup();
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <Probe />
      </GbpDriftProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Apply name' }));

    expect(publishMutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        decisions: [
          {
            fieldKey: 'profile.name',
            sectionKey: 'profile',
            action: 'import_from_google',
            pinnedCoreHash: 'profile.name:core',
            pinnedGbpHash: 'profile.name:gbp',
          },
        ],
      }),
    );
  });
});
