import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DualSyncFieldRowHeader } from '@/components/features/restaurant-settings/dual-sync/DualSyncFieldRowHeader';

import type { DualSyncFieldRowModel } from '@/components/features/restaurant-settings/dual-sync/dualSyncFieldRowDomain';

function makeModel(over: Partial<DualSyncFieldRowModel> = {}): DualSyncFieldRowModel {
  return {
    actionAvailability: { isUnsupported: false, canImport: true, canExport: true },
    blockedReasons: [],
    freshness: null,
    hasOpenCandidate: false,
    helpText: null,
    label: 'Business name',
    policyLabels: ['Manual review'],
    state: 'conflict',
    ...over,
  };
}

describe('DualSyncFieldRowHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@smoke renders the label, state badge, and policy labels', () => {
    render(<DualSyncFieldRowHeader model={makeModel()} />);

    expect(screen.getByText('Business name')).toBeInTheDocument();
    expect(screen.getByText('Conflict')).toBeInTheDocument();
    expect(screen.getByText('Manual review')).toBeInTheDocument();
  });

  it('@contract flags queued exports and shows help text plus freshness', () => {
    render(
      <DualSyncFieldRowHeader
        model={makeModel({
          hasOpenCandidate: true,
          helpText: 'Shown on the public profile.',
          freshness: {
            timestamp: '2026-07-11T11:59:00Z',
            prefix: 'In sync',
            neverLabel: 'Never in sync',
          },
        })}
      />,
    );

    expect(screen.getByText('Pending export queued')).toBeInTheDocument();
    expect(screen.getByText('Shown on the public profile.')).toBeInTheDocument();
    expect(screen.getByText(/In sync .*ago/)).toBeInTheDocument();
  });
});
