import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DualSyncShellEmptyState,
  DualSyncShellErrorState,
  DualSyncShellLoadingState,
} from '@/components/features/restaurant-settings/dual-sync/DualSyncShellStateViews';

describe('DualSyncShellStateViews', () => {
  it('@smoke renders the loading skeleton card', () => {
    render(<DualSyncShellLoadingState />);

    expect(screen.getByText('Google Business Profile sync')).toBeInTheDocument();
  });

  it('@contract surfaces the error message for Error instances', () => {
    render(<DualSyncShellErrorState error={new Error('State fetch failed')} />);

    expect(screen.getByText("Couldn't load dual-sync state.")).toBeInTheDocument();
    expect(screen.getByText('State fetch failed')).toBeInTheDocument();
  });

  it('@contract falls back to an unknown error label for non-errors', () => {
    render(<DualSyncShellErrorState error="boom" />);

    expect(screen.getByText('Unknown error.')).toBeInTheDocument();
  });

  it('@smoke renders the empty state copy', () => {
    render(<DualSyncShellEmptyState />);

    expect(screen.getByText('No syncable fields in scope yet.')).toBeInTheDocument();
  });
});
