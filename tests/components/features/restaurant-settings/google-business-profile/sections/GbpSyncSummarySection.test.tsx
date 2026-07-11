import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GbpSyncSummarySection } from '@/components/features/restaurant-settings/google-business-profile/sections/GbpSyncSummarySection';

import type { GbpDriftContextValue } from '@/components/features/restaurant-settings/gbp-drift/types';

describe('GbpSyncSummarySection', () => {
  it('@contract surfaces the last sync failure', () => {
    render(
      <GbpSyncSummarySection
        status="sync_error"
        lastError="Google rejected the last write."
        hasSyncWorkspace={false}
        gbpDrift={null}
      />,
    );

    expect(screen.getByText('Last sync failed')).toBeInTheDocument();
    expect(screen.getByText('Google rejected the last write.')).toBeInTheDocument();
  });

  it('@contract points at the sync workspace when it is available', () => {
    render(
      <GbpSyncSummarySection status="linked" lastError={null} hasSyncWorkspace gbpDrift={null} />,
    );

    expect(screen.getByText('Review changes below')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quick compare' })).not.toBeInTheDocument();
  });

  it('@contract offers quick compare through a linked drift context', async () => {
    const user = userEvent.setup();
    const openCompare = vi.fn();
    render(
      <GbpSyncSummarySection
        status="linked"
        lastError={null}
        hasSyncWorkspace={false}
        gbpDrift={{ isLinked: true, openCompare } as unknown as GbpDriftContextValue}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Quick compare' }));

    expect(openCompare).toHaveBeenCalledWith({ filter: 'drifted_only' });
  });
});
