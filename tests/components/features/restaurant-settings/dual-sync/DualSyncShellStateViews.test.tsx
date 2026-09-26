import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DualSyncShellEmptyState,
  DualSyncShellErrorState,
  DualSyncShellLoadingState,
} from '@/components/features/restaurant-settings/dual-sync/DualSyncShellStateViews';

describe('DualSyncShellStateViews', () => {
  it('@smoke renders the loading skeleton card', () => {
    render(<DualSyncShellLoadingState />);

    expect(screen.getByText('Review differences')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('@contract shows fixed copy, never the raw error message', () => {
    render(<DualSyncShellErrorState error={new Error('State fetch failed')} />);

    expect(screen.getByText("Couldn't load the differences.")).toBeInTheDocument();
    expect(screen.queryByText(/State fetch failed/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/The differences could not be loaded\. Reason code: unknown_error\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your saved settings are unchanged/)).toBeInTheDocument();
  });

  it('@contract falls back to fixed copy for non-errors', () => {
    render(<DualSyncShellErrorState error="boom" />);

    expect(screen.getByText(/The differences could not be loaded\./)).toBeInTheDocument();
  });

  it('@contract offers Try again when a retry handler is provided', () => {
    const onRetry = vi.fn();
    render(<DualSyncShellErrorState error={new Error('State fetch failed')} onRetry={onRetry} />);

    screen.getByRole('button', { name: 'Try again' }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders the empty state copy', () => {
    render(<DualSyncShellEmptyState />);

    expect(
      screen.getByText('No Nabatable fields can be compared with Google yet.'),
    ).toBeInTheDocument();
  });
});
