import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GbpWorkflowFrame } from '@/components/features/restaurant-settings/google-business-profile/sections/GbpWorkflowFrame';

import { makeGbpConnection } from '../../testUtils';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

function renderFrame(over: Partial<Parameters<typeof GbpWorkflowFrame>[0]> = {}) {
  const onSelectAnchor = vi.fn();
  render(
    <GbpWorkflowFrame
      data={makeGbpConnection() as unknown as GoogleBusinessProfileConnection}
      stage="location"
      overview={<div data-testid="overview-slot" />}
      hasSyncWorkspace={false}
      onSelectAnchor={onSelectAnchor}
      {...over}
    >
      <div data-testid="frame-children" />
    </GbpWorkflowFrame>,
  );
  return onSelectAnchor;
}

describe('GbpWorkflowFrame', () => {
  it('@smoke renders the command center with overview slot and children', () => {
    renderFrame();

    expect(screen.getAllByText('Google Business Profile').length).toBeGreaterThan(0);
    expect(screen.getByText('Google command center')).toBeInTheDocument();
    expect(screen.getByTestId('overview-slot')).toBeInTheDocument();
    expect(screen.getByTestId('frame-children')).toBeInTheDocument();
    // Pre-linked stages surface the optionality reassurance card.
    expect(screen.getByText('Google integration is 100% optional')).toBeInTheDocument();
  });

  it('@contract navigates workflow steps through the rail', async () => {
    const user = userEvent.setup();
    const onSelectAnchor = renderFrame();

    await user.click(screen.getByRole('button', { name: /Connection/ }));
    expect(onSelectAnchor).toHaveBeenCalledWith('gbp-connection');

    await user.click(screen.getByRole('button', { name: /Business location/ }));
    expect(onSelectAnchor).toHaveBeenCalledWith('gbp-location');
  });

  it('@contract adds the review rail item only when the sync workspace exists', async () => {
    const user = userEvent.setup();
    const onSelectAnchor = renderFrame({
      data: makeGbpConnection({
        status: 'linked',
        externalLocationId: 'location-1',
        externalLocationTitle: 'Old Crown Girton',
      }) as unknown as GoogleBusinessProfileConnection,
      stage: 'linked',
      hasSyncWorkspace: true,
    });

    await user.click(screen.getByRole('button', { name: /Review changes/ }));
    expect(onSelectAnchor).toHaveBeenCalledWith('gbp-sync-review');
    expect(screen.queryByText('Google integration is 100% optional')).not.toBeInTheDocument();
  });
});
