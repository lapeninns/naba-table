import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPendingCandidatesPanel } from '@/components/features/restaurant-settings/dual-sync/DualSyncPendingCandidatesPanel';

import type { DualSyncOutboundCandidate } from '@/server/dual-sync';
import type { ListDualSyncCandidatesResponse } from '@/services/ops/dual-sync';

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

function makeCandidate(
  overrides: Partial<DualSyncOutboundCandidate> = {},
): DualSyncOutboundCandidate {
  return {
    id: 'candidate-1',
    restaurantId: 'restaurant-1',
    provider: 'google_business_profile',
    sectionKey: 'profile',
    fieldKey: 'profile.name',
    proposedValue: 'New name',
    proposedValueHash: 'hash-new',
    baselineGbpHash: '1234567890abcdef',
    status: 'open',
    source: 'core_write',
    createdByUserId: 'user-1',
    resolvedAt: null,
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:10:00.000Z',
    ...overrides,
  };
}

function makeQuery(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      restaurantId: 'restaurant-1',
      candidates: [makeCandidate()],
    } satisfies ListDualSyncCandidatesResponse,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    refetch: vi.fn(),
    ...overrides,
  } as never;
}

function makeMutation(mutateAsync = vi.fn(async () => makeCandidate({ status: 'cancelled' }))) {
  return {
    error: null,
    isError: false,
    isPending: false,
    mutateAsync,
    variables: undefined,
  } as never;
}

describe('DualSyncPendingCandidatesPanel', () => {
  it('renders pending candidates and cancels an open row', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn(async () => makeCandidate({ status: 'cancelled' }));

    render(
      <DualSyncPendingCandidatesPanel
        candidatesQuery={makeQuery()}
        cancelCandidateMutation={makeMutation(mutateAsync)}
      />,
    );

    expect(screen.getByText('profile.name')).toBeInTheDocument();
    expect(screen.getByText('1234567890ab')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('candidate-1');
    });
    expect(toastMock.success).toHaveBeenCalledWith('Pending change cancelled.');
  });

  it('shows the empty state when no candidates are open', () => {
    render(
      <DualSyncPendingCandidatesPanel
        candidatesQuery={makeQuery({
          data: { restaurantId: 'restaurant-1', candidates: [] },
        })}
        cancelCandidateMutation={makeMutation()}
      />,
    );

    expect(
      screen.getByText('No pending Core changes are waiting for Google export.'),
    ).toBeInTheDocument();
  });

  it('shows an error state with a retry action', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();

    render(
      <DualSyncPendingCandidatesPanel
        candidatesQuery={makeQuery({
          data: undefined,
          error: new Error('boom'),
          isError: true,
          refetch,
        })}
        cancelCandidateMutation={makeMutation()}
      />,
    );

    expect(screen.getByText("Couldn't load pending changes.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });
});
