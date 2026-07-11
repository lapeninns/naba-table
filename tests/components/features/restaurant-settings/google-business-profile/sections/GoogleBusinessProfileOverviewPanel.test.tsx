import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GoogleBusinessProfileOverviewPanel } from '@/components/features/restaurant-settings/google-business-profile/sections/GoogleBusinessProfileOverviewPanel';

import type { PersistentGbpError } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileWorkflow';

function renderPanel(over: Partial<Parameters<typeof GoogleBusinessProfileOverviewPanel>[0]> = {}) {
  render(
    <GoogleBusinessProfileOverviewPanel
      accountLabel="Not connected"
      canDisconnect={false}
      canRefresh={false}
      error={null}
      errorAction={null}
      hasLinkedLocation={false}
      isConnecting={false}
      isDisconnecting={false}
      isRefreshing={false}
      lastPullAt={null}
      locationTitle="No location selected"
      manageOnGoogleHref={null}
      onChooseLocation={vi.fn()}
      onConnect={vi.fn()}
      onRefresh={null}
      onRequestDisconnect={null}
      showConnect
      showPicker={false}
      stageLabel="Not connected"
      status="unlinked"
      {...over}
    />,
  );
}

describe('GoogleBusinessProfileOverviewPanel', () => {
  it('@smoke renders the overview card without an error banner by default', () => {
    renderPanel();

    expect(screen.getByTestId('gbp-overview-card')).toBeInTheDocument();
    expect(screen.queryByText('Google authorization expired')).not.toBeInTheDocument();
  });

  it('@contract stacks the persistent error with its recovery action above the card', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderPanel({
      error: {
        title: 'Google authorization expired',
        message: 'Reconnect to continue syncing.',
      } as unknown as PersistentGbpError,
      errorAction: { label: 'Reconnect', onAction, isPending: false },
    });

    expect(screen.getByText('Google authorization expired')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
