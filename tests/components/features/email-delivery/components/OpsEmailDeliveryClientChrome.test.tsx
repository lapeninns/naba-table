import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  OpsEmailDeliveryAutoRefreshControls,
  OpsEmailDeliveryHeader,
  OpsEmailDeliveryNoAccessState,
} from '@/components/features/email-delivery/components/OpsEmailDeliveryClientChrome';
import { formatRefreshLabel } from '@/components/features/email-delivery/opsEmailDeliveryStateDomain';

import type { OpsEmailDeliveryState } from '@/components/features/email-delivery/useOpsEmailDeliveryState';
import type { OpsEmailDeliveryRefreshOption } from '@/components/features/email-delivery/opsEmailDeliveryTypes';

type StateOptions = {
  availableRestaurants?: { id: string; name: string }[];
  effectiveRestaurantId?: string | null;
  restaurantName?: string | null;
  refresh?: OpsEmailDeliveryRefreshOption;
  autoRefreshActive?: boolean;
  refreshIndicatorText?: string;
  manualRefreshBusy?: boolean;
};

function makeState(options: StateOptions = {}) {
  const handleRestaurantChange = vi.fn();
  const applyRefresh = vi.fn();
  const handleManualRefresh = vi.fn();

  const state = {
    availableRestaurants: options.availableRestaurants ?? [],
    effectiveRestaurantId: options.effectiveRestaurantId ?? null,
    handleRestaurantChange,
    restaurantDetails: {
      data: options.restaurantName ? { name: options.restaurantName } : null,
    },
    timezone: 'Europe/London',
    queryState: {
      refresh: options.refresh ?? 'off',
      applyRefresh,
    },
    formatRefreshLabel,
    autoRefreshActive: options.autoRefreshActive ?? false,
    refreshIndicatorText: options.refreshIndicatorText ?? 'Last updated just now',
    handleManualRefresh,
    manualRefreshBusy: options.manualRefreshBusy ?? false,
  } as unknown as OpsEmailDeliveryState;

  return { state, handleRestaurantChange, applyRefresh, handleManualRefresh };
}

describe('OpsEmailDeliveryClientChrome', () => {
  it('@contract renders the no-access empty state with a route back to ops home', () => {
    render(<OpsEmailDeliveryNoAccessState />);

    expect(screen.getByText('No restaurant access yet')).toBeInTheDocument();
    expect(
      screen.getByText(/ask an owner or manager to send you an invitation/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to ops home' })).toBeInTheDocument();
  });

  it('@contract @a11y switches restaurants through the labeled switcher when multiple exist', async () => {
    const user = userEvent.setup();
    const { state, handleRestaurantChange } = makeState({
      availableRestaurants: [
        { id: 'rest-1', name: 'Cafe One' },
        { id: 'rest-2', name: 'Cafe Two' },
      ],
      effectiveRestaurantId: 'rest-1',
    });

    render(<OpsEmailDeliveryHeader state={state} />);

    expect(screen.getByText('Email Delivery')).toBeInTheDocument();
    expect(screen.getByText('Europe/London')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to bookings' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Restaurant switcher' }));
    await user.click(await screen.findByRole('option', { name: 'Cafe Two' }));

    expect(handleRestaurantChange).toHaveBeenCalledWith('rest-2');
  });

  it('@contract falls back to a static restaurant badge when only one restaurant exists', () => {
    const { state } = makeState({
      availableRestaurants: [{ id: 'rest-1', name: 'Cafe Solo' }],
      effectiveRestaurantId: 'rest-1',
      restaurantName: 'Cafe Solo',
    });

    render(<OpsEmailDeliveryHeader state={state} />);

    expect(screen.getByText('Cafe Solo')).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Restaurant switcher' }),
    ).not.toBeInTheDocument();
  });

  it('@contract @a11y applies a new interval from the auto-refresh toggle and ignores deselects', async () => {
    const user = userEvent.setup();
    const { state, applyRefresh } = makeState({ refresh: 'off' });

    render(<OpsEmailDeliveryAutoRefreshControls state={state} />);

    await user.click(screen.getByRole('radio', { name: 'Refresh every 30s' }));
    expect(applyRefresh).toHaveBeenCalledWith('30s');

    // Clicking the already-selected option emits an empty value, which the
    // isRefreshOption guard drops instead of forwarding.
    applyRefresh.mockClear();
    await user.click(screen.getByRole('radio', { name: 'Refresh every Off' }));
    expect(applyRefresh).not.toHaveBeenCalled();
  });

  it('@contract reflects auto-refresh state through the badge, indicator, and off notice', () => {
    const active = makeState({
      refresh: '1m',
      autoRefreshActive: true,
      refreshIndicatorText: 'Last updated 5 seconds ago',
    });
    const { unmount } = render(<OpsEmailDeliveryAutoRefreshControls state={active.state} />);

    expect(screen.getByText('Auto-refresh 1m')).toBeInTheDocument();
    expect(screen.getByText('Last updated 5 seconds ago')).toBeInTheDocument();
    expect(screen.queryByText('Auto-refresh is off.')).not.toBeInTheDocument();
    unmount();

    const off = makeState({ refresh: 'off', autoRefreshActive: false });
    render(<OpsEmailDeliveryAutoRefreshControls state={off.state} />);

    expect(screen.getByText('Auto-refresh is off.')).toBeInTheDocument();
    expect(screen.queryByText(/^Auto-refresh (30s|1m|5m)$/)).not.toBeInTheDocument();
  });

  it('@contract @a11y fires manual refresh and disables the control while busy', async () => {
    const user = userEvent.setup();
    const idle = makeState();

    const { unmount } = render(<OpsEmailDeliveryAutoRefreshControls state={idle.state} />);
    await user.click(screen.getByRole('button', { name: 'Refresh current tab' }));
    expect(idle.handleManualRefresh).toHaveBeenCalledTimes(1);
    unmount();

    const busy = makeState({ manualRefreshBusy: true });
    render(<OpsEmailDeliveryAutoRefreshControls state={busy.state} />);
    expect(screen.getByRole('button', { name: 'Refresh current tab' })).toBeDisabled();
  });
});
