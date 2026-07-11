import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GbpOverviewCard } from '@/components/features/restaurant-settings/google-business-profile/components/GbpOverviewCard';

function renderCard(over: Partial<Parameters<typeof GbpOverviewCard>[0]> = {}) {
  const handlers = {
    onConnect: vi.fn(),
    onChooseLocation: vi.fn(),
    onRefresh: vi.fn(),
    onRequestDisconnect: vi.fn(),
  };
  render(
    <GbpOverviewCard
      status="unlinked"
      stageLabel="Not connected"
      locationTitle="No location selected"
      accountLabel="Not connected"
      lastPullAt={null}
      hasLinkedLocation={false}
      showConnect
      onConnect={handlers.onConnect}
      isConnecting={false}
      showPicker={false}
      onChooseLocation={handlers.onChooseLocation}
      canRefresh={false}
      onRefresh={null}
      isRefreshing={false}
      manageOnGoogleHref={null}
      canDisconnect={false}
      onRequestDisconnect={null}
      isDisconnecting={false}
      {...over}
    />,
  );
  return handlers;
}

describe('GbpOverviewCard', () => {
  it('@contract offers Connect Google for an unlinked profile', async () => {
    const user = userEvent.setup();
    const { onConnect } = renderCard();

    // "Not connected" appears as badge, stage label, and account datum.
    expect(screen.getAllByText('Not connected').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('No location mapped')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Connect Google' }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('@contract shows linked-state actions and routes them', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const onRequestDisconnect = vi.fn();
    renderCard({
      status: 'linked',
      stageLabel: 'Connected',
      accountLabel: 'google-user@example.com',
      locationTitle: 'Old Crown Girton',
      hasLinkedLocation: true,
      showConnect: false,
      canRefresh: true,
      canDisconnect: true,
      manageOnGoogleHref: 'https://business.google.com/locations/1',
      onRefresh,
      onRequestDisconnect,
    });

    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('Location mapped')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage on Google/ })).toHaveAttribute(
      'href',
      'https://business.google.com/locations/1',
    );

    await user.click(screen.getByRole('button', { name: /Refresh connection/ }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Disconnect/ }));
    expect(onRequestDisconnect).toHaveBeenCalledTimes(1);
  });

  it('@contract disables the connect action while connecting', () => {
    renderCard({ isConnecting: true });

    expect(screen.getByRole('button', { name: 'Connecting...' })).toBeDisabled();
  });

  it('@contract offers the location picker in the authorized stage', async () => {
    const user = userEvent.setup();
    const { onChooseLocation } = renderCard({
      status: 'authorized',
      showConnect: false,
      showPicker: true,
    });

    await user.click(screen.getByRole('button', { name: /Choose location/ }));
    expect(onChooseLocation).toHaveBeenCalledTimes(1);
  });
});
