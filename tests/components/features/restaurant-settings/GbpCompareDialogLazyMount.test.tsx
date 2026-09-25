import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GbpDriftProvider } from '@/components/features/restaurant-settings/gbp-drift/GbpDriftProvider';
import { useGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';

// The compare dialog (accordion, scroll area, toggle group, field rows) is only
// needed once an operator asks to compare with Google. The provider must not
// mount it — and so must not pull its module into the settings chunk — until
// the dialog is first opened.
const dialogRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/components/features/restaurant-settings/gbp-drift/GbpCompareDialog', () => ({
  GbpCompareDialog: function StubGbpCompareDialog() {
    dialogRenders.count += 1;
    return <div data-testid="gbp-compare-dialog-stub" />;
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
    stateQuery: { data: { fields: [] }, isLoading: false },
    publishMutation: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

function CompareControls() {
  const drift = useGbpDrift();
  return (
    <>
      <button type="button" onClick={() => drift.openCompare()}>
        Open compare
      </button>
      <button type="button" onClick={() => drift.closeCompare()}>
        Close compare
      </button>
    </>
  );
}

describe('GbpDriftProvider compare dialog loading', () => {
  it('@contract does not mount the compare dialog until it is first opened, then keeps it mounted', async () => {
    dialogRenders.count = 0;
    const user = userEvent.setup();
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <CompareControls />
      </GbpDriftProvider>,
    );

    expect(screen.queryByTestId('gbp-compare-dialog-stub')).not.toBeInTheDocument();
    expect(dialogRenders.count).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Open compare' }));
    expect(await screen.findByTestId('gbp-compare-dialog-stub')).toBeInTheDocument();

    // Stays mounted after close so Radix can run its close transition and a
    // re-open does not wait on the lazy chunk again.
    await user.click(screen.getByRole('button', { name: 'Close compare' }));
    expect(screen.getByTestId('gbp-compare-dialog-stub')).toBeInTheDocument();
  });
});
